"""공부 루틴 스키마 (버전 관리)."""
from datetime import date

from pydantic import BaseModel, Field


class RoutineCreate(BaseModel):
    """새 루틴을 만든다. effective_from 미지정 시 오늘부터 유효."""

    title: str = Field(min_length=1, max_length=200)
    weekday_mask: int = Field(default=127, ge=0, le=127)
    subject_id: int | None = None
    effective_from: date | None = None


class RoutineUpdate(BaseModel):
    """루틴을 수정한다. 지정한 날짜부터 새 버전이 적용되고, 과거는 보존된다.

    effective_from 미지정 시 오늘부터 새 버전이 적용된다.
    """

    title: str | None = Field(default=None, min_length=1, max_length=200)
    weekday_mask: int | None = Field(default=None, ge=0, le=127)
    subject_id: int | None = None
    effective_from: date | None = None


class RoutineToggle(BaseModel):
    """특정 날짜의 루틴 완료 상태를 설정한다."""

    completed_date: date
    done: bool


class RoutineVersionRead(BaseModel):
    """루틴 버전 정보(이력 조회용)."""

    id: int
    title: str
    weekday_mask: int
    subject_id: int | None
    effective_from: date
    effective_to: date | None

    model_config = {"from_attributes": True}


class RoutineRead(BaseModel):
    """루틴 정의 + 현재 유효한 버전 정보."""

    definition_id: int
    version_id: int
    title: str
    weekday_mask: int
    subject_id: int | None
    effective_from: date
    effective_to: date | None


class RoutineWithStatus(BaseModel):
    """특정 날짜 기준 루틴 목록. 그 날짜에 유효한 버전 + 완료 여부."""

    definition_id: int
    version_id: int
    title: str
    weekday_mask: int
    subject_id: int | None
    subject_name: str | None
    is_done: bool
