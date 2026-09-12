"""공부 목표 & 로드맵 스키마."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


# --- 로드맵 단계 ---
class RoadmapStepCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    order_index: int = Field(default=0, ge=0)
    estimated_minutes: int = Field(default=0, ge=0)


class RoadmapStepUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    order_index: int | None = Field(default=None, ge=0)
    estimated_minutes: int | None = Field(default=None, ge=0)
    is_done: bool | None = None


class RoadmapStepRead(BaseModel):
    id: int
    title: str
    order_index: int
    estimated_minutes: int
    is_done: bool

    model_config = {"from_attributes": True}


# --- 목표 ---
class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    subject_id: int | None = None
    target_type: Literal["steps", "minutes"] = "steps"
    target_minutes: int = Field(default=0, ge=0)
    start_date: date | None = None  # 미지정 시 오늘
    due_date: date | None = None
    importance: int = Field(default=3, ge=1, le=5)


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    subject_id: int | None = None
    target_type: Literal["steps", "minutes"] | None = None
    target_minutes: int | None = Field(default=None, ge=0)
    start_date: date | None = None
    due_date: date | None = None
    importance: int | None = Field(default=None, ge=1, le=5)
    is_completed: bool | None = None  # 수동 완료/해제


class GoalRead(BaseModel):
    id: int
    title: str
    description: str | None
    subject_id: int | None
    subject_path: str | None  # 전체 경로 (예: "CS > 네트워크")
    target_type: str
    target_minutes: int
    start_date: date
    due_date: date | None
    importance: int
    is_completed: bool
    created_at: datetime

    # 진도 관련 계산 필드
    progress: float  # 0.0 ~ 1.0
    total_steps: int
    done_steps: int

    steps: list[RoadmapStepRead]
