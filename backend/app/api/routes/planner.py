"""오늘 할 일 자동 추천 & 재조정 라우터 (규칙 기반).

외부 LLM 없이 결정론적으로 계산한다. 대상은 미완료 로드맵 단계(RoadmapStep)이며,
소속 목표(Goal)의 마감일/중요도/진도로 점수를 매겨 가용 시간 안에서 조합한다.

계산 로직은 라우트 밖 순수 함수로 분리해 설명 가능성과 테스트 용이성을 확보한다.
"""
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.subject_utils import build_subject_paths
from app.db.session import get_db
from app.models import Goal, User
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


def _goal_progress(goal: Goal) -> float:
    """목표 진도(0~1). 단계 기반으로 계산한다(추천 대상이 단계이므로)."""
    total = len(goal.steps)
    if total == 0:
        return 0.0
    done = sum(1 for s in goal.steps if s.is_done)
    return done / total


def build_candidates(goals: list[Goal], today: date, paths: dict[int, str]) -> list[PlannerItem]:
    """미완료 단계들을 점수화해 정렬된 후보 목록으로 만든다.

    완료 처리된 목표나 이미 완료된 단계는 제외한다. 동점이면
    마감 빠른 순 → goal_id → step order 순으로 안정 정렬한다.
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
                subject_path=paths.get(goal.subject_id) if goal.subject_id else None,
                estimated_minutes=est,
                score=score,
                reason=reason,
            )
            # 정렬 키: 점수 내림차순 → 마감 빠른 순 → goal_id → step order
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


@router.get("/today", response_model=TodayPlan)
def get_today_plan(
    available_minutes: int = Query(default=120, ge=0, le=1440),
    target_date: date | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TodayPlan:
    """오늘 할 일을 규칙 기반으로 추천하고, 목표별 하루 권장량을 함께 반환한다."""
    today = target_date or date.today()

    goals = db.scalars(select(Goal).where(Goal.user_id == current_user.id)).all()
    paths = build_subject_paths(current_user.id, db)

    candidates = build_candidates(list(goals), today, paths)
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
