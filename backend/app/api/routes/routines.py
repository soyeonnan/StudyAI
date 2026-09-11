"""공부 루틴 라우터 (effective date 버전 관리).

- 생성: 정의 + 첫 버전(오늘부터 유효)
- 수정: 현재 버전을 닫고 새 버전 생성 (과거 보존)
- 날짜별 조회: 그 날짜에 유효했던 버전 + 요일 매칭 + 완료 여부
- 토글: 그 날짜에 유효한 버전에 완료 기록 (version_id로 고정)
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import RoutineCompletion, RoutineDefinition, RoutineVersion, Subject, User
from app.schemas.routine import (
    RoutineCreate,
    RoutineRead,
    RoutineToggle,
    RoutineUpdate,
    RoutineVersionRead,
    RoutineWithStatus,
)

router = APIRouter(prefix="/routines", tags=["routines"])


def _weekday_bit(target: date) -> int:
    """date.weekday()는 월=0 이므로 일=0 기준 비트로 변환한다."""
    return 1 << ((target.weekday() + 1) % 7)


def _get_owned_definition(definition_id: int, user: User, db: Session) -> RoutineDefinition:
    definition = db.get(RoutineDefinition, definition_id)
    if definition is None or definition.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="루틴을 찾을 수 없습니다.")
    return definition


def _active_version(definition: RoutineDefinition, db: Session) -> RoutineVersion | None:
    """현재 열려 있는(effective_to IS NULL) 버전을 반환한다."""
    return db.scalar(
        select(RoutineVersion).where(
            RoutineVersion.definition_id == definition.id,
            RoutineVersion.effective_to.is_(None),
        )
    )


def _version_on_date(definition_id: int, target: date, db: Session) -> RoutineVersion | None:
    """특정 날짜에 유효한 버전을 반환한다."""
    return db.scalar(
        select(RoutineVersion).where(
            RoutineVersion.definition_id == definition_id,
            RoutineVersion.effective_from <= target,
            or_(RoutineVersion.effective_to.is_(None), RoutineVersion.effective_to >= target),
        )
    )


def _validate_subject(subject_id: int | None, user: User, db: Session) -> None:
    if subject_id is None:
        return
    subject = db.get(Subject, subject_id)
    if subject is None or subject.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="과목을 찾을 수 없습니다.")


@router.get("", response_model=list[RoutineRead])
def list_routines(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RoutineRead]:
    """보관되지 않은 루틴들의 현재 유효 버전을 반환한다."""
    definitions = db.scalars(
        select(RoutineDefinition).where(
            RoutineDefinition.user_id == current_user.id,
            RoutineDefinition.archived_at.is_(None),
        )
    ).all()

    result: list[RoutineRead] = []
    for definition in definitions:
        version = _active_version(definition, db)
        if version is None:
            continue
        result.append(
            RoutineRead(
                definition_id=definition.id,
                version_id=version.id,
                title=version.title,
                weekday_mask=version.weekday_mask,
                subject_id=version.subject_id,
                effective_from=version.effective_from,
                effective_to=version.effective_to,
            )
        )
    return result


@router.get("/on/{target_date}", response_model=list[RoutineWithStatus])
def list_routines_for_date(
    target_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RoutineWithStatus]:
    """해당 날짜에 유효했던 버전 중, 그 날짜 요일에 반복되는 루틴을 완료 여부와 함께 반환한다."""
    bit = _weekday_bit(target_date)

    # 해당 날짜에 유효한 모든 버전 (사용자 소유, 요일 매칭)
    versions = db.scalars(
        select(RoutineVersion)
        .join(RoutineDefinition, RoutineVersion.definition_id == RoutineDefinition.id)
        .where(
            RoutineDefinition.user_id == current_user.id,
            RoutineVersion.effective_from <= target_date,
            or_(RoutineVersion.effective_to.is_(None), RoutineVersion.effective_to >= target_date),
        )
    ).all()

    matched = [v for v in versions if v.weekday_mask & bit]
    version_ids = [v.id for v in matched]

    completed_ids: set[int] = set()
    if version_ids:
        completed_ids = set(
            db.scalars(
                select(RoutineCompletion.version_id).where(
                    RoutineCompletion.completed_date == target_date,
                    RoutineCompletion.version_id.in_(version_ids),
                )
            )
        )

    # 과목명 매핑
    subject_ids = {v.subject_id for v in matched if v.subject_id is not None}
    subject_names: dict[int, str] = {}
    if subject_ids:
        rows = db.execute(
            select(Subject.id, Subject.name).where(Subject.id.in_(subject_ids))
        ).all()
        subject_names = {row[0]: row[1] for row in rows}

    result: list[RoutineWithStatus] = []
    for version in matched:
        result.append(
            RoutineWithStatus(
                definition_id=version.definition_id,
                version_id=version.id,
                title=version.title,
                weekday_mask=version.weekday_mask,
                subject_id=version.subject_id,
                subject_name=subject_names.get(version.subject_id) if version.subject_id else None,
                is_done=version.id in completed_ids,
            )
        )
    return result


@router.get("/{definition_id}/history", response_model=list[RoutineVersionRead])
def routine_history(
    definition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RoutineVersion]:
    """루틴의 모든 버전 이력을 반환한다 (변경 추적/모니터링용)."""
    definition = _get_owned_definition(definition_id, current_user, db)
    return list(
        db.scalars(
            select(RoutineVersion)
            .where(RoutineVersion.definition_id == definition.id)
            .order_by(RoutineVersion.effective_from)
        )
    )


@router.post("", response_model=RoutineRead, status_code=status.HTTP_201_CREATED)
def create_routine(
    payload: RoutineCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RoutineRead:
    _validate_subject(payload.subject_id, current_user, db)

    definition = RoutineDefinition(user_id=current_user.id)
    db.add(definition)
    db.flush()  # definition.id 확보

    version = RoutineVersion(
        definition_id=definition.id,
        title=payload.title,
        weekday_mask=payload.weekday_mask,
        subject_id=payload.subject_id,
        effective_from=payload.effective_from or date.today(),
        effective_to=None,
    )
    db.add(version)
    db.commit()
    db.refresh(version)

    return RoutineRead(
        definition_id=definition.id,
        version_id=version.id,
        title=version.title,
        weekday_mask=version.weekday_mask,
        subject_id=version.subject_id,
        effective_from=version.effective_from,
        effective_to=version.effective_to,
    )


@router.patch("/{definition_id}", response_model=RoutineRead)
def update_routine(
    definition_id: int,
    payload: RoutineUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RoutineRead:
    """루틴 수정. 지정일(기본 오늘)부터 새 버전이 적용되고 과거 버전은 보존된다."""
    definition = _get_owned_definition(definition_id, current_user, db)
    current = _active_version(definition, db)
    if current is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="활성 루틴 버전이 없습니다.")

    _validate_subject(payload.subject_id, current_user, db)

    new_from = payload.effective_from or date.today()

    # 새 버전 값: 전달되지 않은 필드는 현재 버전 값을 승계한다.
    new_version = RoutineVersion(
        definition_id=definition.id,
        title=payload.title if payload.title is not None else current.title,
        weekday_mask=payload.weekday_mask if payload.weekday_mask is not None else current.weekday_mask,
        subject_id=payload.subject_id if payload.subject_id is not None else current.subject_id,
        effective_from=new_from,
        effective_to=None,
    )

    if current.effective_from >= new_from:
        # 현재 버전이 새 적용일 이후에 시작했다면(같은 날 중복 수정 등) 현재 버전을 대체한다.
        current.effective_to = current.effective_from - timedelta(days=1)
    else:
        current.effective_to = new_from - timedelta(days=1)

    db.add(new_version)
    db.commit()
    db.refresh(new_version)

    return RoutineRead(
        definition_id=definition.id,
        version_id=new_version.id,
        title=new_version.title,
        weekday_mask=new_version.weekday_mask,
        subject_id=new_version.subject_id,
        effective_from=new_version.effective_from,
        effective_to=new_version.effective_to,
    )


@router.delete("/{definition_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_routine(
    definition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """루틴을 오늘부로 보관 처리한다. 과거 이력과 완료 기록은 보존된다."""
    definition = _get_owned_definition(definition_id, current_user, db)
    # 현재 열린 버전을 어제부로 닫아 오늘 이후로는 나타나지 않게 한다.
    current = _active_version(definition, db)
    if current is not None:
        current.effective_to = date.today() - timedelta(days=1)
    definition.archived_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/{definition_id}/toggle", status_code=status.HTTP_204_NO_CONTENT)
def toggle_routine_completion(
    definition_id: int,
    payload: RoutineToggle,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """특정 날짜의 루틴 완료 상태를 설정한다. 그 날짜에 유효한 버전에 기록한다."""
    definition = _get_owned_definition(definition_id, current_user, db)
    version = _version_on_date(definition.id, payload.completed_date, db)
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="해당 날짜에 유효한 루틴이 없습니다.",
        )

    existing = db.scalar(
        select(RoutineCompletion).where(
            RoutineCompletion.version_id == version.id,
            RoutineCompletion.completed_date == payload.completed_date,
        )
    )

    if payload.done and existing is None:
        db.add(RoutineCompletion(version_id=version.id, completed_date=payload.completed_date))
        db.commit()
    elif not payload.done and existing is not None:
        db.delete(existing)
        db.commit()
