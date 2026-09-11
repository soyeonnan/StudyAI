"""과목 경로 계산 유틸.

무제한 depth 계층에서 특정 과목의 전체 경로(예: "CS > 네트워크 > TCP/IP")를 만든다.
루틴·공부 기록 응답에서 과목을 사람이 알아보기 쉽게 보여주는 데 사용한다.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Subject


def build_subject_paths(user_id: int, db: Session) -> dict[int, str]:
    """사용자의 모든 과목에 대해 {id: 전체경로} 매핑을 반환한다.

    한 번에 전부 로드해 부모를 따라 경로를 만든다(N+1 쿼리 방지).
    """
    subjects = db.scalars(select(Subject).where(Subject.user_id == user_id)).all()
    by_id = {s.id: s for s in subjects}

    cache: dict[int, str] = {}

    def resolve(subject_id: int) -> str:
        if subject_id in cache:
            return cache[subject_id]
        node = by_id.get(subject_id)
        if node is None:
            return ""
        if node.parent_id is None:
            path = node.name
        else:
            parent_path = resolve(node.parent_id)
            path = f"{parent_path} > {node.name}" if parent_path else node.name
        cache[subject_id] = path
        return path

    return {s.id: resolve(s.id) for s in subjects}
