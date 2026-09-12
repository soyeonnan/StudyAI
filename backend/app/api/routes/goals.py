"""공부 목표 & 로드맵 라우터.

- 목표 CRUD, 로드맵 단계 CRUD
- 진도 계산: target_type이 "minutes"면 (기록 공부시간 / 목표시간),
  "steps"면 (완료 단계 / 전체 단계). 0~1 범위로 반환한다.

과목 연동은 기존 루틴/기록과 동일하게 subject_id로 처리하고,
응답에는 build_subject_paths로 만든 전체 경로(subject_path)를 담는다.
"""
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.subject_utils import build_subject_paths
from app.db.session import get_db
from app.models import Goal, RoadmapStep, StudySession, Subject, User
from app.schemas.goal import (
    GoalCreate,
    GoalRead,
    GoalUpdate,
    RoadmapStepCreate,
    RoadmapStepRead,
    RoadmapStepUpdate,
)

router = APIRouter(prefix="/goals", tags=["goals"])


# --- 소유권 검증 헬퍼 ---
def _get_owned_goal(goal_id: int, user: User, db: Session) -> Goal:
    goal = db.get(Goal, goal_id)
    if goal is None or goal.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="목표를 찾을 수 없습니다.")
    return goal


def _get_owned_step(goal: Goal, step_id: int, db: Session) -> RoadmapStep:
    step = db.get(RoadmapStep, step_id)
    if step is None or step.goal_id != goal.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="단계를 찾을 수 없습니다.")
    return step


def _validate_subject(subject_id: int | None, user: User, db: Session) -> None:
    if subject_id is None:
        return
    subject = db.get(Subject, subject_id)
    if subject is None or subject.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="과목을 찾을 수 없습니다.")


def _studied_minutes(goal: Goal, db: Session) -> int:
    """목표 과목에 대해 시작일 이후 기록된 총 공부 시간(분).

    StudySession은 초 단위(study_seconds)로 저장하므로 합산 후 분으로 환산한다.
    """
    if goal.subject_id is None:
        return 0
    total_seconds = db.scalar(
        select(func.coalesce(func.sum(StudySession.study_seconds), 0)).where(
            StudySession.user_id == goal.user_id,
            StudySession.subject_id == goal.subject_id,
            StudySession.started_at >= datetime.combine(goal.start_date, datetime.min.time()),
        )
    )
    return int(total_seconds or 0) // 60


def _to_read(goal: Goal, paths: dict[int, str], db: Session) -> GoalRead:
    """Goal ORM 객체를 진도 계산이 포함된 응답 스키마로 변환한다."""
    total_steps = len(goal.steps)
    done_steps = sum(1 for s in goal.steps if s.is_done)

    if goal.target_type == "minutes" and goal.target_minutes > 0:
        studied = _studied_minutes(goal, db)
        progress = min(studied / goal.target_minutes, 1.0)
    elif total_steps > 0:
        progress = done_steps / total_steps
    else:
        progress = 0.0

    subject_path = paths.get(goal.subject_id) if goal.subject_id else None

    return GoalRead(
        id=goal.id,
        title=goal.title,
        description=goal.description,
        subject_id=goal.subject_id,
        subject_path=subject_path,
        target_type=goal.target_type,
        target_minutes=goal.target_minutes,
        start_date=goal.start_date,
        due_date=goal.due_date,
        importance=goal.importance,
        is_completed=goal.completed_at is not None,
        created_at=goal.created_at,
        progress=round(progress, 4),
        total_steps=total_steps,
        done_steps=done_steps,
        steps=[RoadmapStepRead.model_validate(s) for s in goal.steps],
    )


# --- 목표 CRUD ---
@router.get("", response_model=list[GoalRead])
def list_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GoalRead]:
    goals = db.scalars(
        select(Goal).where(Goal.user_id == current_user.id).order_by(Goal.created_at.desc())
    ).all()
    paths = build_subject_paths(current_user.id, db)
    return [_to_read(g, paths, db) for g in goals]


@router.get("/{goal_id}", response_model=GoalRead)
def get_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalRead:
    goal = _get_owned_goal(goal_id, current_user, db)
    paths = build_subject_paths(current_user.id, db)
    return _to_read(goal, paths, db)


@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalRead:
    _validate_subject(payload.subject_id, current_user, db)

    goal = Goal(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        subject_id=payload.subject_id,
        target_type=payload.target_type,
        target_minutes=payload.target_minutes,
        start_date=payload.start_date or date.today(),
        due_date=payload.due_date,
        importance=payload.importance,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)

    paths = build_subject_paths(current_user.id, db)
    return _to_read(goal, paths, db)


@router.patch("/{goal_id}", response_model=GoalRead)
def update_goal(
    goal_id: int,
    payload: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalRead:
    goal = _get_owned_goal(goal_id, current_user, db)

    if payload.subject_id is not None:
        _validate_subject(payload.subject_id, current_user, db)

    data = payload.model_dump(exclude_unset=True)
    is_completed = data.pop("is_completed", None)

    for field, value in data.items():
        setattr(goal, field, value)

    if is_completed is not None:
        goal.completed_at = datetime.now(timezone.utc) if is_completed else None

    db.commit()
    db.refresh(goal)

    paths = build_subject_paths(current_user.id, db)
    return _to_read(goal, paths, db)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    goal = _get_owned_goal(goal_id, current_user, db)
    db.delete(goal)
    db.commit()


# --- 로드맵 단계 CRUD ---
@router.post(
    "/{goal_id}/steps", response_model=RoadmapStepRead, status_code=status.HTTP_201_CREATED
)
def create_step(
    goal_id: int,
    payload: RoadmapStepCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RoadmapStep:
    goal = _get_owned_goal(goal_id, current_user, db)
    step = RoadmapStep(
        goal_id=goal.id,
        title=payload.title,
        order_index=payload.order_index,
        estimated_minutes=payload.estimated_minutes,
    )
    db.add(step)
    db.commit()
    db.refresh(step)
    return step


@router.patch("/{goal_id}/steps/{step_id}", response_model=RoadmapStepRead)
def update_step(
    goal_id: int,
    step_id: int,
    payload: RoadmapStepUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RoadmapStep:
    goal = _get_owned_goal(goal_id, current_user, db)
    step = _get_owned_step(goal, step_id, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(step, field, value)

    db.commit()
    db.refresh(step)
    return step


@router.delete("/{goal_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_step(
    goal_id: int,
    step_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    goal = _get_owned_goal(goal_id, current_user, db)
    step = _get_owned_step(goal, step_id, db)
    db.delete(step)
    db.commit()
