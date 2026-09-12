"""대시보드 집계 스키마."""
from pydantic import BaseModel


class SubjectBreakdown(BaseModel):
    """과목별 공부 시간 비중."""

    subject_id: int
    subject_name: str
    study_seconds: int


class DailyStudy(BaseModel):
    """일별 공부량 (그래프용)."""

    day: int  # 해당 월의 일(1~31)
    study_seconds: int


class DailyStats(BaseModel):
    """오늘(특정 날짜) 요약."""

    date: str
    total_study_seconds: int
    total_break_seconds: int
    session_count: int
    avg_focus: float  # 0이면 기록 없음
    routine_done: int
    routine_total: int
    schedule_done: int
    schedule_total: int


class MonthlyStats(BaseModel):
    """이번 달 요약 + 그래프 데이터."""

    year: int
    month: int
    total_study_seconds: int
    avg_focus: float
    study_days: int  # 공부한 날 수
    daily: list[DailyStudy]
    subjects: list[SubjectBreakdown]
    routine_done: int
    routine_total: int


class WeeklyPoint(BaseModel):
    """주별 공부량 + 루틴 달성률 (주간 추이 그래프용)."""

    week_start: str  # 그 주 월요일 (ISO date)
    study_seconds: int
    routine_done: int
    routine_total: int


class GoalProgressPoint(BaseModel):
    """목표별 진도 요약."""

    goal_id: int
    title: str
    progress: float  # 0.0 ~ 1.0 (단계 기반)
    is_completed: bool


class AchievementStats(BaseModel):
    """달성률 확장 통계: 주간 추이 + 목표 달성 요약."""

    weeks: list[WeeklyPoint]
    total_goals: int
    completed_goals: int
    active_goals: int
    goals: list[GoalProgressPoint]
