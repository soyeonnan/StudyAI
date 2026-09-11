"""공부 과목과 공부 기록(세션) 모델."""
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Subject(Base):
    """공부 과목. 2단계 계층(대분류 > 소분류)을 지원한다.

    parent_id 가 NULL 이면 대분류, 값이 있으면 그 대분류에 속한 소분류다.
    색상은 캘린더 표시에 사용한다.
    """

    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # 자기참조: 소분류는 대분류를 부모로 가진다. 부모 삭제 시 자식도 함께 삭제.
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#3b82f6")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="subjects")
    # 대분류에서 소분류 목록으로 접근. 소분류에서 부모로도 접근.
    children: Mapped[list["Subject"]] = relationship(
        back_populates="parent", cascade="all, delete-orphan"
    )
    parent: Mapped["Subject | None"] = relationship(back_populates="children", remote_side=[id])
    study_sessions: Mapped[list["StudySession"]] = relationship(
        back_populates="subject", cascade="all, delete-orphan"
    )


class StudySession(Base):
    """실제 타이머로 기록된 공부 기록."""

    __tablename__ = "study_sessions"
    __table_args__ = (
        CheckConstraint("focus_level BETWEEN 1 AND 5", name="ck_focus_level_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), index=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # 초 단위로 저장한다 (표시 계산은 프론트에서).
    study_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    break_seconds: Mapped[int] = mapped_column(Integer, default=0)

    focus_level: Mapped[int] = mapped_column(Integer, nullable=False)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="study_sessions")
    subject: Mapped["Subject"] = relationship(back_populates="study_sessions")
