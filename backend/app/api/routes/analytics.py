"""대시보드 집계 라우터.

각 탭(공부기록/루틴/일정)의 실제 데이터를 DB에서 집계해 정확한 통계를 제공한다.
- /stats/daily?date=YYYY-MM-DD : 특정 날짜(오늘) 요약
- /stats/monthly?year=&month= : 특정 월 요약 + 그래프 데이터

루틴은 effective date 버전 관리를 따르므로, 각 날짜에 '그 시점 유효했던 버전'을 기준으로 센다.
"""
from calendar import monthrange
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import (
    Goal,
    RoutineCompletion,
    RoutineDefinition,
    RoutineVersion,
    ScheduleItem,
    StudySession,
    Subject,
    User,
)
from app.schemas.analytics import (
    AchievementStats,
    DailyStats,
    DailyStudy,
    GoalProgressPoint,
    MonthlyStats,
    SubjectBreakdown,
    WeeklyPoint,
)

router = APIRouter(prefix="/stats", tags=["analytics"])


def _weekday_bit(target: date) -> int:
    """date.weekday()는 월=0 이므로 일=0 기준 비트로 변환한다."""
    return 1 << ((target.weekday() + 1) % 7)


def _routine_counts_for_date(user_id: int, target: date, db: Session) -> tuple[int, int]:
    """특정 날짜에 유효+요일 매칭되는 루틴 수(total)와 완료 수(done)를 반환한다."""
    bit = _weekday_bit(target)
    versions = db.scalars(
        select(RoutineVersion)
        .join(RoutineDefinition, RoutineVersion.definition_id == RoutineDefinition.id)
        .where(
            RoutineDefinition.user_id == user_id,
            RoutineVersion.effective_from <= target,
            or_(RoutineVersion.effective_to.is_(None), RoutineVersion.effective_to >= target),
        )
    ).all()

    matched = [v for v in versions if v.weekday_mask & bit]
    total = len(matched)
    if total == 0:
        return 0, 0

    version_ids = [v.id for v in matched]
    done = db.scalar(
        select(func.count())
        .select_from(RoutineCompletion)
        .where(
            RoutineCompletion.completed_date == target,
            RoutineCompletion.version_id.in_(version_ids),
        )
    )
    return int(done or 0), total


@router.get("/daily", response_model=DailyStats)
def daily_stats(
    date_param: date = Query(alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DailyStats:
    # 공부 기록 집계 (해당 날짜에 시작된 세션)
    sessions = db.scalars(
        select(StudySession).where(
            StudySession.user_id == current_user.id,
            func.date(StudySession.started_at) == date_param,
        )
    ).all()

    total_study = sum(s.study_seconds for s in sessions)
    total_break = sum(s.break_seconds for s in sessions)
    avg_focus = round(sum(s.focus_level for s in sessions) / len(sessions), 1) if sessions else 0.0

    # 루틴 집계 (버전 관리 반영)
    routine_done, routine_total = _routine_counts_for_date(current_user.id, date_param, db)

    # 일정 집계
    schedule_total = db.scalar(
        select(func.count()).select_from(ScheduleItem).where(
            ScheduleItem.user_id == current_user.id,
            ScheduleItem.scheduled_date == date_param,
        )
    )
    schedule_done = db.scalar(
        select(func.count()).select_from(ScheduleItem).where(
            ScheduleItem.user_id == current_user.id,
            ScheduleItem.scheduled_date == date_param,
            ScheduleItem.is_done.is_(True),
        )
    )

    return DailyStats(
        date=date_param.isoformat(),
        total_study_seconds=total_study,
        total_break_seconds=total_break,
        session_count=len(sessions),
        avg_focus=avg_focus,
        routine_done=routine_done,
        routine_total=routine_total,
        schedule_done=int(schedule_done or 0),
        schedule_total=int(schedule_total or 0),
    )


@router.get("/monthly", response_model=MonthlyStats)
def monthly_stats(
    year: int = Query(ge=1970, le=3000),
    month: int = Query(ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MonthlyStats:
    first_day = date(year, month, 1)
    last_dom = monthrange(year, month)[1]
    last_day = date(year, month, last_dom)

    sessions = db.scalars(
        select(StudySession).where(
            StudySession.user_id == current_user.id,
            func.date(StudySession.started_at) >= first_day,
            func.date(StudySession.started_at) <= last_day,
        )
    ).all()

    total_study = sum(s.study_seconds for s in sessions)
    avg_focus = round(sum(s.focus_level for s in sessions) / len(sessions), 1) if sessions else 0.0

    # 일별 공부량 (1일~말일 채워서 그래프에 빈 날도 0으로 표시)
    per_day: dict[int, int] = {d: 0 for d in range(1, last_dom + 1)}
    study_days_set: set[int] = set()
    for s in sessions:
        day = s.started_at.day
        per_day[day] = per_day.get(day, 0) + s.study_seconds
        if s.study_seconds > 0:
            study_days_set.add(day)
    daily = [DailyStudy(day=d, study_seconds=sec) for d, sec in sorted(per_day.items())]

    # 과목별 비중
    subj_seconds: dict[int, int] = {}
    for s in sessions:
        subj_seconds[s.subject_id] = subj_seconds.get(s.subject_id, 0) + s.study_seconds
    subject_names: dict[int, str] = {}
    if subj_seconds:
        rows = db.execute(
            select(Subject.id, Subject.name).where(Subject.id.in_(subj_seconds.keys()))
        ).all()
        subject_names = {r[0]: r[1] for r in rows}
    subjects = [
        SubjectBreakdown(
            subject_id=sid,
            subject_name=subject_names.get(sid, "삭제된 과목"),
            study_seconds=sec,
        )
        for sid, sec in sorted(subj_seconds.items(), key=lambda x: x[1], reverse=True)
    ]

    # 월간 루틴 달성률: 각 날짜별 완료/전체를 합산
    routine_done_total = 0
    routine_total_total = 0
    for d in range(1, last_dom + 1):
        done, total = _routine_counts_for_date(current_user.id, date(year, month, d), db)
        routine_done_total += done
        routine_total_total += total

    return MonthlyStats(
        year=year,
        month=month,
        total_study_seconds=total_study,
        avg_focus=avg_focus,
        study_days=len(study_days_set),
        daily=daily,
        subjects=subjects,
        routine_done=routine_done_total,
        routine_total=routine_total_total,
    )


def _goal_step_progress(goal: Goal) -> float:
    """목표의 단계 기반 진도(0~1). 단계가 없으면 0."""
    total = len(goal.steps)
    if total == 0:
        return 0.0
    done = sum(1 for s in goal.steps if s.is_done)
    return round(done / total, 4)


@router.get("/achievement", response_model=AchievementStats)
def achievement_stats(
    date_param: date = Query(default=None, alias="date"),
    weeks: int = Query(default=8, ge=1, le=26),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AchievementStats:
    """달성률 확장 통계: 최근 N주 공부시간·루틴 달성률 추이 + 목표 달성 요약.

    주 시작은 월요일. 기준일이 속한 주부터 과거로 weeks개 주를 집계한다.
    """
    today = date_param or date.today()
    # 기준일이 속한 주의 월요일
    this_monday = today - timedelta(days=today.weekday())

    weekly: list[WeeklyPoint] = []
    # 과거→현재 순서로 담기 위해 역순으로 계산 후 뒤집는다.
    for i in range(weeks):
        week_start = this_monday - timedelta(weeks=i)
        week_end = week_start + timedelta(days=6)

        study_seconds = db.scalar(
            select(func.coalesce(func.sum(StudySession.study_seconds), 0)).where(
                StudySession.user_id == current_user.id,
                func.date(StudySession.started_at) >= week_start,
                func.date(StudySession.started_at) <= week_end,
            )
        )

        done_sum = 0
        total_sum = 0
        for d in range(7):
            day = week_start + timedelta(days=d)
            done, total = _routine_counts_for_date(current_user.id, day, db)
            done_sum += done
            total_sum += total

        weekly.append(
            WeeklyPoint(
                week_start=week_start.isoformat(),
                study_seconds=int(study_seconds or 0),
                routine_done=done_sum,
                routine_total=total_sum,
            )
        )

    weekly.reverse()  # 과거 → 현재

    # 목표 달성 요약
    goals = db.scalars(
        select(Goal).where(Goal.user_id == current_user.id).order_by(Goal.created_at.desc())
    ).all()

    goal_points: list[GoalProgressPoint] = []
    completed = 0
    for goal in goals:
        is_completed = goal.completed_at is not None
        if is_completed:
            completed += 1
        goal_points.append(
            GoalProgressPoint(
                goal_id=goal.id,
                title=goal.title,
                progress=_goal_step_progress(goal),
                is_completed=is_completed,
            )
        )

    total_goals = len(goals)
    return AchievementStats(
        weeks=weekly,
        total_goals=total_goals,
        completed_goals=completed,
        active_goals=total_goals - completed,
        goals=goal_points,
    )
