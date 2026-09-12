"""공부 인증 커뮤니티 스키마."""
from datetime import datetime

from pydantic import BaseModel, Field


class PostCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    session_id: int | None = None  # 연결할 공부기록(선택)


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class CommentRead(BaseModel):
    id: int
    user_id: int
    author_name: str
    content: str
    created_at: datetime


class PostRead(BaseModel):
    id: int
    user_id: int
    author_name: str
    content: str
    session_id: int | None
    created_at: datetime
    like_count: int
    liked_by_me: bool
    comment_count: int
    comments: list[CommentRead]  # 목록에서는 비어있고 상세에서 채운다
