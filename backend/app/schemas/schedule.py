"""일정 스키마."""
from datetime import date

from pydantic import BaseModel, Field


class ScheduleItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    scheduled_date: date


class ScheduleItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    scheduled_date: date | None = None
    is_done: bool | None = None


class ScheduleItemRead(BaseModel):
    id: int
    title: str
    description: str | None
    scheduled_date: date
    is_done: bool

    model_config = {"from_attributes": True}
