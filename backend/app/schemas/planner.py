"""오늘 할 일 자동 추천 & 재조정 스키마.

규칙 기반 계산의 입출력만 정의한다(저장 테이블 없음).
"""
from datetime import date

from pydantic import BaseModel, Field


class PlannerItem(BaseModel):
    """추천된 오늘 할 일 하나 (미완료 로드맵 단계)."""

    goal_id: int
    goal_title: str
    step_id: int
    step_title: str
    subject_path: str | None
    estimated_minutes: int
    score: int
    reason: str  # 왜 추천됐는지 설명 (설명 가능성)


class RebalanceItem(BaseModel):
    """마감이 남은 목표의 하루 권장 진행량 (밀린 공부 재조정)."""

    goal_id: int
    goal_title: str
    days_left: int
    remaining_steps: int
    per_day_steps: float  # 남은 단계 / 남은 일수 (올림 전 값)


class TodayPlan(BaseModel):
    """오늘 플랜 응답."""

    target_date: date
    available_minutes: int
    planned_minutes: int
    items: list[PlannerItem]  # 가용 시간 안에 담긴 추천 항목 (점수순)
    overflow: list[PlannerItem]  # 후보였으나 시간 초과로 못 담은 항목
    rebalance: list[RebalanceItem]  # 목표별 하루 권장 진행량
