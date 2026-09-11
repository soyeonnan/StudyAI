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
