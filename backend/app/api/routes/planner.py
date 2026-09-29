"""오늘 할 일 자동 추천 & 재조정 라우터 (규칙 기반).

외부 LLM 없이 결정론적으로 계산한다. 대상은 미완료 로드맵 단계(RoadmapStep)이며,
소속 목표(Goal)의 마감일/중요도/진도로 점수를 매겨 가용 시간 안에서 조합한다.

계산 로직은 라우트 밖 순수 함수로 분리해 설명 가능성과 테스트 용이성을 확보한다.
"""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.subject_utils import build_subject_paths
from app.db.session import get_db
from app.models import Goal, StudySession, Subject, User
from app.schemas.planner import PlannerItem, RebalanceItem, TodayPlan

router = APIRouter(prefix="/planner", tags=["planner"])

# 예상 소요시간이 지정되지 않은 단계의 기본값(분).
DEFAULT_STEP_MINUTES = 30


def _deadline_score(days_left: int | None) -> int:
    """마감 임박도 점수. 임박할수록 높다."""
    if days_left is None:
        return 1
    if days_left <= 0:
        return 5
    if days_left <= 2:
        return 4
    if days_left <= 6:
        return 3
    if days_left <= 13:
        return 2
    return 1


def _progress_score(progress: float) -> int:
    """남은 진도 점수(0~2). 많이 남을수록 높다."""
    return round((1 - progress) * 2)


# 시간목표 항목이 하루에 채우기를 권장하는 기본 조각 시간(분).
# 목표 시간이 이보다 크면 이 크기로 잘라 오늘 분량으로 제안한다.
TIME_GOAL_CHUNK_MINUTES = 60


def _goal_progress(goal: Goal) -> float:
    """목표 진도(0~1).

    - 단계형(steps): 완료 단계 / 전체 단계
    - 시간형(minutes): 진도는 여기선 0으로 둔다(공부 시간 집계는 달성률에서 별도 계산).
      플래너에서는 '아직 남았다'고 보고 후보에 포함시키는 것이 목적이다.
    """
    if goal.target_type == "minutes":
        return 0.0
    total = len(goal.steps)
    if total == 0:
        return 0.0
    done = sum(1 for s in goal.steps if s.is_done)
    return done / total


def build_candidates(goals: list[Goal], today: date, paths: dict[int, str]) -> list[PlannerItem]:
    """미완료 항목들을 점수화해 정렬된 후보 목록으로 만든다.

    - 단계형 목표: 미완료 단계 각각을 후보로.
    - 시간형 목표: 목표 자체를 하나의 후보로(step_id=0). "시간이 남으면 채우는" 용도라
      우선순위 계산에 포함하되, 예상시간은 목표시간을 조각(chunk) 크기로 자른다.

    완료 처리된 목표나 이미 완료된 단계는 제외한다.
    동점이면 마감 빠른 순 → goal_id → order 순으로 안정 정렬한다.
    """
    candidates: list[tuple[tuple, PlannerItem]] = []

    for goal in goals:
        if goal.completed_at is not None:
            continue

        days_left = (goal.due_date - today).days if goal.due_date else None
        progress = _goal_progress(goal)
        deadline_pts = _deadline_score(days_left)
        progress_pts = _progress_score(progress)
        importance_pts = goal.importance
        score = importance_pts + deadline_pts + progress_pts

        due_text = f"마감 {days_left}일 남음" if days_left is not None else "마감 없음"
        if days_left is not None and days_left < 0:
            due_text = f"마감 {abs(days_left)}일 지남"
        subject_path = paths.get(goal.subject_id) if goal.subject_id else None

        if goal.target_type == "minutes":
            # 시간형: 목표 자체를 오늘 분량으로 제안(조각 크기 또는 목표 시간 중 작은 값).
            est = min(goal.target_minutes, TIME_GOAL_CHUNK_MINUTES) if goal.target_minutes > 0 else TIME_GOAL_CHUNK_MINUTES
            reason = f"시간 목표 · 중요도 {importance_pts}, {due_text}"
            item = PlannerItem(
                goal_id=goal.id,
                goal_title=goal.title,
                step_id=0,  # 0 = 시간형 목표(단계 없음)
                step_title=f"{goal.title} 공부",
                subject_path=subject_path,
                estimated_minutes=est,
                score=score,
                reason=reason,
            )
            due_key = days_left if days_left is not None else 10**6
            sort_key = (-score, due_key, goal.id, 0, 0)
            candidates.append((sort_key, item))
            continue

        # 단계형: 미완료 단계 각각
        reason = f"중요도 {importance_pts}, {due_text}, 진도 {round(progress * 100)}%"
        for step in goal.steps:
            if step.is_done:
                continue
            est = step.estimated_minutes or DEFAULT_STEP_MINUTES
            item = PlannerItem(
                goal_id=goal.id,
                goal_title=goal.title,
                step_id=step.id,
                step_title=step.title,
                subject_path=subject_path,
                estimated_minutes=est,
                score=score,
                reason=reason,
            )
            due_key = days_left if days_left is not None else 10**6
            sort_key = (-score, due_key, goal.id, step.order_index, step.id)
            candidates.append((sort_key, item))

    candidates.sort(key=lambda x: x[0])
    return [item for _, item in candidates]


def pack_by_time(candidates: list[PlannerItem], available_minutes: int) -> tuple[list[PlannerItem], list[PlannerItem]]:
    """점수순 후보를 가용 시간 안에서 그리디로 담는다. 담긴 것/못 담은 것을 반환."""
    planned: list[PlannerItem] = []
    overflow: list[PlannerItem] = []
    remaining = available_minutes

    for item in candidates:
        if item.estimated_minutes <= remaining:
            planned.append(item)
            remaining -= item.estimated_minutes
        else:
            overflow.append(item)

    return planned, overflow


def build_rebalance(goals: list[Goal], today: date) -> list[RebalanceItem]:
    """마감이 남은 목표에 대해 하루 권장 단계 수를 계산한다.

    남은 단계 / 남은 일수. 마감이 지났거나 없는 목표, 남은 단계가 없으면 제외.
    """
    result: list[RebalanceItem] = []

    for goal in goals:
        if goal.completed_at is not None or goal.due_date is None:
            continue
        days_left = (goal.due_date - today).days
        if days_left <= 0:
            continue
        remaining_steps = sum(1 for s in goal.steps if not s.is_done)
        if remaining_steps == 0:
            continue
        result.append(
            RebalanceItem(
                goal_id=goal.id,
                goal_title=goal.title,
                days_left=days_left,
                remaining_steps=remaining_steps,
                per_day_steps=round(remaining_steps / days_left, 2),
            )
        )

    result.sort(key=lambda r: r.days_left)
    return result


# 과목 기반 추천에서 한 과목당 제안하는 기본 공부 시간(분).
SUBJECT_CHUNK_MINUTES = 40
# 최근 공부량을 볼 기간(일). 이 기간에 적게 한 과목을 우선 추천한다.
RECENT_DAYS = 14


def build_subject_candidates(
    user_id: int,
    today: date,
    paths: dict[int, str],
    exclude_subject_ids: set[int],
    db: Session,
) -> list[PlannerItem]:
    """목표와 무관하게, 등록한 과목만으로 오늘 할 일 후보를 만든다.

    리프(하위가 없는) 과목을 대상으로, 최근 RECENT_DAYS 동안 공부 시간이 적은 과목을
    우선 추천한다(오래 손 안 댄 과목 챙기기). 이미 목표에 연결된 과목은 중복을 피해 제외한다.
    점수는 목표 후보보다 낮게 잡아, 목표가 있으면 목표가 먼저 오도록 한다.
    """
    subjects = db.scalars(select(Subject).where(Subject.user_id == user_id)).all()
    parent_ids = {s.parent_id for s in subjects if s.parent_id is not None}
    # 리프 = 다른 과목의 부모가 아닌 과목
    leaves = [s for s in subjects if s.id not in parent_ids]

    since = datetime.combine(today - timedelta(days=RECENT_DAYS), datetime.min.time())

    scored: list[tuple[tuple, PlannerItem]] = []
    for subj in leaves:
        if subj.id in exclude_subject_ids:
            continue
        recent = db.scalar(
            select(func.coalesce(func.sum(StudySession.study_seconds), 0)).where(
                StudySession.user_id == user_id,
                StudySession.subject_id == subj.id,
                StudySession.started_at >= since,
            )
        )
        recent_minutes = int(recent or 0) // 60
        # 최근 공부량이 적을수록 점수가 높다(최대 3점).
        if recent_minutes == 0:
            score = 3
        elif recent_minutes < 60:
            score = 2
        else:
            score = 1

        path = paths.get(subj.id) or subj.name
        item = PlannerItem(
            goal_id=0,
            goal_title="과목 추천",
            step_id=-subj.id,  # 음수 = 과목 기반 항목(목표/단계와 구분)
            step_title=f"{subj.name} 공부",
            subject_path=path,
            estimated_minutes=SUBJECT_CHUNK_MINUTES,
            score=score,
            reason=f"최근 {RECENT_DAYS}일 공부 {recent_minutes}분 · 오래 안 한 과목 챙기기",
        )
        # 점수 높은 순 → 최근 공부량 적은 순 → 과목 id
        scored.append(((-score, recent_minutes, subj.id), item))

    scored.sort(key=lambda x: x[0])
    return [item for _, item in scored]


@router.get("/today", response_model=TodayPlan)
def get_today_plan(
    available_minutes: int = Query(default=120, ge=0, le=1440),
    target_date: date | None = Query(default=None),
    include_subjects: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TodayPlan:
    """오늘 할 일을 규칙 기반으로 추천하고, 목표별 하루 권장량을 함께 반환한다.

    목표가 없어도 include_subjects=True면 등록한 과목만으로 추천한다.
    목표 후보가 먼저 오고, 과목 후보는 그 뒤(보조)로 정렬된다.
    """
    today = target_date or date.today()

    goals = db.scalars(select(Goal).where(Goal.user_id == current_user.id)).all()
    paths = build_subject_paths(current_user.id, db)

    goal_candidates = build_candidates(list(goals), today, paths)

    if include_subjects:
        # 목표에 이미 연결된 과목은 중복 추천하지 않는다.
        used_subject_ids = {g.subject_id for g in goals if g.subject_id is not None}
        subject_candidates = build_subject_candidates(
            current_user.id, today, paths, used_subject_ids, db
        )
    else:
        subject_candidates = []

    # 목표 후보를 앞에, 과목 후보를 뒤에 둔다.
    candidates = goal_candidates + subject_candidates
    planned, overflow = pack_by_time(candidates, available_minutes)
    rebalance = build_rebalance(list(goals), today)

    return TodayPlan(
        target_date=today,
        available_minutes=available_minutes,
        planned_minutes=sum(i.estimated_minutes for i in planned),
        items=planned,
        overflow=overflow,
        rebalance=rebalance,
    )
