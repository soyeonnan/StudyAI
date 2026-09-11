"""관리자 전용 라우터. role='admin' 사용자만 접근할 수 있다.

보안 학습 가이드(교육·방어 중심)를 제공한다.
"""
from fastapi import APIRouter, Depends

from app.api.deps import get_current_admin
from app.content.learning_guides import LEARNING_GUIDES
from app.models import User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/guides")
def list_guides(_: User = Depends(get_current_admin)) -> list[dict]:
    """학습 가이드 전체 목록을 반환한다 (관리자 전용)."""
    return LEARNING_GUIDES
