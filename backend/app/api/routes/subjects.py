"""공부 과목 라우터. 대분류/소분류 2단계 계층을 지원한다."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Subject, User
from app.schemas.study import SubjectCreate, SubjectRead, SubjectTreeNode

router = APIRouter(prefix="/subjects", tags=["subjects"])


@router.get("", response_model=list[SubjectRead])
def list_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Subject]:
    """모든 과목을 평면 목록으로 반환한다 (대분류+소분류)."""
    return list(db.scalars(select(Subject).where(Subject.user_id == current_user.id)))


@router.get("/tree", response_model=list[SubjectTreeNode])
def list_subject_tree(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SubjectTreeNode]:
    """대분류별로 소분류를 묶은 트리 형태로 반환한다."""
    subjects = db.scalars(select(Subject).where(Subject.user_id == current_user.id)).all()

    parents = [s for s in subjects if s.parent_id is None]
    children_by_parent: dict[int, list[Subject]] = {}
    for s in subjects:
        if s.parent_id is not None:
            children_by_parent.setdefault(s.parent_id, []).append(s)

    return [
        SubjectTreeNode(
            id=p.id,
            name=p.name,
            color=p.color,
            children=[
                SubjectRead(id=c.id, name=c.name, color=c.color, parent_id=c.parent_id)
                for c in children_by_parent.get(p.id, [])
            ],
        )
        for p in parents
    ]


@router.post("", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Subject:
    # 소분류로 만들려면 부모가 본인 소유의 '대분류'여야 한다 (2단계 제한).
    if payload.parent_id is not None:
        parent = db.get(Subject, payload.parent_id)
        if parent is None or parent.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="상위 과목을 찾을 수 없습니다.")
        if parent.parent_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="소분류 아래에는 다시 하위 과목을 만들 수 없습니다.",
            )

    subject = Subject(
        user_id=current_user.id,
        name=payload.name,
        color=payload.color,
        parent_id=payload.parent_id,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """과목을 삭제한다. 대분류를 지우면 소속 소분류도 함께 삭제된다."""
    subject = db.get(Subject, subject_id)
    if subject is None or subject.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="과목을 찾을 수 없습니다.")
    db.delete(subject)
    db.commit()
