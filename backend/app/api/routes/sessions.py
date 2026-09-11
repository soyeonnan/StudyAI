"""공부 기록(세션) 라우터."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import StudySession, Subject, User
from app.schemas.study import StudySessionCreate, StudySessionRead, StudySessionUpdate

router = APIRouter(prefix="/sessions", tags=["study-sessions"])


def _validate_owned_subject(subject_id: int, user: User, db: Session) -> None:
    subject = db.get(Subject, subject_id)
    if subject is None or subject.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="과목을 찾을 수 없습니다.")


@router.get("", response_model=list[StudySessionRead])
def list_sessions(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[StudySession]:
    stmt = select(StudySession).where(StudySession.user_id == current_user.id)
    if start is not None:
        stmt = stmt.where(StudySession.started_at >= start)
    if end is not None:
        stmt = stmt.where(StudySession.started_at <= end)
    return list(db.scalars(stmt.order_by(StudySession.started_at.desc())))


@router.post("", response_model=StudySessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: StudySessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudySession:
    _validate_owned_subject(payload.subject_id, current_user, db)

    study_session = StudySession(
        user_id=current_user.id,
        subject_id=payload.subject_id,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        study_seconds=payload.study_seconds,
        break_seconds=payload.break_seconds,
        focus_level=payload.focus_level,
        memo=payload.memo,
    )
    db.add(study_session)
    db.commit()
    db.refresh(study_session)
    return study_session


@router.patch("/{session_id}", response_model=StudySessionRead)
def update_session(
    session_id: int,
    payload: StudySessionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudySession:
    """공부 기록을 수정한다 (집중도·메모·시간·과목 등)."""
    study_session = db.get(StudySession, session_id)
    if study_session is None or study_session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="기록을 찾을 수 없습니다.")

    updates = payload.model_dump(exclude_unset=True)
    if "subject_id" in updates and updates["subject_id"] is not None:
        _validate_owned_subject(updates["subject_id"], current_user, db)

    for field, value in updates.items():
        setattr(study_session, field, value)
    db.commit()
    db.refresh(study_session)
    return study_session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    study_session = db.get(StudySession, session_id)
    if study_session is None or study_session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="기록을 찾을 수 없습니다.")
    db.delete(study_session)
    db.commit()
