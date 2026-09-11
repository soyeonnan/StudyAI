"""공부 과목·공부 기록 스키마."""
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class SubjectCreate(BaseModel):
    """과목 생성. parent_id 가 있으면 소분류로 생성된다."""

    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#3b82f6", max_length=20)
    parent_id: int | None = None


class SubjectRead(BaseModel):
    id: int
    name: str
    color: str
    parent_id: int | None

    model_config = {"from_attributes": True}


class SubjectTreeNode(BaseModel):
    """대분류 + 그 아래 소분류 목록(트리 형태)."""

    id: int
    name: str
    color: str
    children: list[SubjectRead]


class StudySessionCreate(BaseModel):
    subject_id: int
    started_at: datetime
    ended_at: datetime
    study_seconds: int = Field(ge=0)
    break_seconds: int = Field(default=0, ge=0)
    focus_level: int = Field(ge=1, le=5)
    memo: str | None = Field(default=None, max_length=2000)

    @field_validator("ended_at")
    @classmethod
    def _end_after_start(cls, ended_at: datetime, info):
        started_at = info.data.get("started_at")
        if started_at is not None and ended_at < started_at:
            raise ValueError("종료 시각은 시작 시각보다 빠를 수 없습니다.")
        return ended_at


class StudySessionUpdate(BaseModel):
    """공부 기록 부분 수정. 전달된 필드만 갱신한다."""

    subject_id: int | None = None
    study_seconds: int | None = Field(default=None, ge=0)
    break_seconds: int | None = Field(default=None, ge=0)
    focus_level: int | None = Field(default=None, ge=1, le=5)
    memo: str | None = Field(default=None, max_length=2000)


class StudySessionRead(BaseModel):
    id: int
    subject_id: int
    started_at: datetime
    ended_at: datetime
    study_seconds: int
    break_seconds: int
    focus_level: int
    memo: str | None

    model_config = {"from_attributes": True}
