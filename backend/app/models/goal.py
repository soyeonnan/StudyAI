"""공부 목표 & 로드맵 모델.

- Goal        : 하나의 공부 목표. 제목, 과목(선택), 목표량, 기간, 중요도를 가진다.
- RoadmapStep : 목표를 달성하기 위한 단계. 순서(order_index)와 완료 여부를 가진다.

진도(progress)는 두 가지 방식으로 계산할 수 있다.
1) 단계 기반  : 완료된 step 수 / 전체 step 수
2) 시간 기반  : 기록된 공부 시간 / 목표 시간(target_minutes)

목표량 단위(target_type)에 따라 어느 방식을 쓸지 결정한다. 계산 로직은 라우터에 둔다.
과목 연동은 기존 루틴/기록과 동일하게 subject_id(어느 레벨이든)로 처리한다.
"""
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Goal(Base):
    """공부 목표. 사용자에 속하며 여러 로드맵 단계를 가질 수 있다."""

    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 연동 과목(선택). 소분류까지 지정 가능.
    subject_id: Mapped[int | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # 목표량 단위: "minutes"(공부 시간) 또는 "steps"(단계 완료).
    target_type: Mapped[str] = mapped_column(String(20), default="steps", nullable=False)
    # target_type이 "minutes"일 때 목표 공부 시간(분). "steps"면 미사용(0).
    target_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    # 중요도 1~5.
    importance: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    # 완료 처리 시각(수동 완료). 진도 100%와 별개로 사용자가 종료할 수 있다.
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="goals")
    subject: Mapped["Subject | None"] = relationship()
    steps: Mapped[list["RoadmapStep"]] = relationship(
        back_populates="goal",
        cascade="all, delete-orphan",
        order_by="RoadmapStep.order_index",
    )


class RoadmapStep(Base):
    """목표를 달성하기 위한 단계. 순서대로 진행하며 완료 여부를 기록한다."""

    __tablename__ = "roadmap_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    goal_id: Mapped[int] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"), index=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # 단계 정렬 순서. 작을수록 먼저.
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 예상 소요 시간(분). 오늘 할 일 추천(today-planner)에서 활용 예정.
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    goal: Mapped["Goal"] = relationship(back_populates="steps")
