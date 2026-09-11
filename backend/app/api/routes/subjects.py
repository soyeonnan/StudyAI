"""공부 과목 라우터. 무제한 depth 계층(대>중>소>...)을 지원한다."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Subject, User
from app.schemas.study import SubjectCreate, SubjectRead, SubjectTreeNode

router = APIRouter(prefix="/subjects", tags=["subjects"])


def _build_tree(subjects: list[Subject]) -> list[SubjectTreeNode]:
    """평면 과목 목록을 무제한 depth 트리로 변환한다."""
    children_by_parent: dict[int | None, list[Subject]] = {}
    for s in subjects:
        children_by_parent.setdefault(s.parent_id, []).append(s)

    def build(node: Subject, depth: int) -> SubjectTreeNode:
        kids = children_by_parent.get(node.id, [])
        return SubjectTreeNode(
            id=node.id,
            name=node.name,
            color=node.color,
            parent_id=node.parent_id,
            depth=depth,
            children=[build(k, depth + 1) for k in kids],
        )

    roots = children_by_parent.get(None, [])
    return [build(r, 0) for r in roots]


@router.get("", response_model=list[SubjectRead])
def list_subjects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Subject]:
    """모든 과목을 평면 목록으로 반환한다."""
    return list(db.scalars(select(Subject).where(Subject.user_id == current_user.id)))


@router.get("/tree", response_model=list[SubjectTreeNode])
def list_subject_tree(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SubjectTreeNode]:
    """무제한 depth 트리로 반환한다."""
    subjects = db.scalars(select(Subject).where(Subject.user_id == current_user.id)).all()
    return _build_tree(list(subjects))


@router.post("", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Subject:
    """과목 생성. parent_id가 있으면 그 아래 하위 과목으로 만든다 (depth 제한 없음)."""
    if payload.parent_id is not None:
        parent = db.get(Subject, payload.parent_id)
        if parent is None or parent.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="상위 과목을 찾을 수 없습니다.")

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
    """과목을 삭제한다. 하위 과목도 함께 삭제된다(ondelete CASCADE)."""
    subject = db.get(Subject, subject_id)
    if subject is None or subject.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="과목을 찾을 수 없습니다.")
    db.delete(subject)
    db.commit()
