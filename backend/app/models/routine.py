"""공부 루틴 모델 (effective date 버전 관리).

시간 독립성이 핵심이다. 루틴을 수정해도 과거 날짜가 본 루틴은 바뀌면 안 된다.
이를 위해 루틴을 '정의(RoutineDefinition)'와 '버전(RoutineVersion)'으로 분리한다.

- RoutineDefinition : 루틴의 정체성(하나의 루틴). 사용자에 속한다.
- RoutineVersion    : 특정 기간 동안 유효한 루틴의 상태(제목, 요일, 과목).
                      수정하면 이전 버전을 닫고(effective_to 설정) 새 버전을 만든다.
- RoutineCompletion : 특정 날짜에 특정 '버전'을 완료했다는 기록.

특정 날짜 D의 루틴 = effective_from <= D 이고 (effective_to IS NULL 또는 D <= effective_to)
인 버전들. 과거 날짜는 그 시점에 유효했던 버전을 그대로 본다.
"""
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RoutineDefinition(Base):
    """루틴의 정체성. 실제 내용은 버전(RoutineVersion)에 담긴다."""

    __tablename__ = "routine_definitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    # 완전 삭제 대신 보관 종료일을 두면 과거 이력이 보존된다.
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="routines")
    versions: Mapped[list["RoutineVersion"]] = relationship(
        back_populates="definition", cascade="all, delete-orphan", order_by="RoutineVersion.effective_from"
    )


class RoutineVersion(Base):
    """특정 기간 동안 유효한 루틴 상태의 스냅샷.

    effective_to 가 NULL 이면 '현재까지 유효'를 의미한다.
    수정 시 기존 버전의 effective_to 를 (수정일 - 1일)로 닫고 새 버전을 만든다.
    """

    __tablename__ = "routine_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    definition_id: Mapped[int] = mapped_column(
        ForeignKey("routine_definitions.id", ondelete="CASCADE"), index=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # 반복 요일: 0=일 ~ 6=토 비트마스크. 127이면 매일.
    weekday_mask: Mapped[int] = mapped_column(Integer, default=127)
    # 연동 과목(선택). 소분류 과목까지 지정 가능.
    subject_id: Mapped[int | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )

    effective_from: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    definition: Mapped["RoutineDefinition"] = relationship(back_populates="versions")
    subject: Mapped["Subject | None"] = relationship()
    completions: Mapped[list["RoutineCompletion"]] = relationship(
        back_populates="version", cascade="all, delete-orphan"
    )


class RoutineCompletion(Base):
    """특정 날짜에 특정 버전을 완료했다는 기록.

    version_id로 어떤 버전을 완료했는지 고정하므로, 이후 루틴을 수정해도
    과거 완료 기록은 그대로 유지된다. (version, date) 조합은 유일하다.
    """

    __tablename__ = "routine_completions"
    __table_args__ = (
        UniqueConstraint("version_id", "completed_date", name="uq_version_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    version_id: Mapped[int] = mapped_column(
        ForeignKey("routine_versions.id", ondelete="CASCADE"), index=True
    )
    completed_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    version: Mapped["RoutineVersion"] = relationship(back_populates="completions")
