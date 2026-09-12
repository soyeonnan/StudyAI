"""공부 인증 커뮤니티 라우터.

- 목록/상세는 전체 공개(모든 사용자 글 조회)
- 작성은 현재 사용자, 삭제는 작성자만
- 좋아요는 사용자당 1개(토글), 댓글 작성/삭제

인증글에 공부기록(session)을 연결할 때는 본인 소유 세션만 허용한다.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Post, PostComment, PostLike, StudySession, User
from app.schemas.community import CommentCreate, CommentRead, PostCreate, PostRead

router = APIRouter(prefix="/community", tags=["community"])


def _get_post(post_id: int, db: Session) -> Post:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다.")
    return post


def _author_name(user: User | None) -> str:
    return user.display_name if user else "탈퇴한 사용자"


def _like_count(post_id: int, db: Session) -> int:
    return int(
        db.scalar(select(func.count()).select_from(PostLike).where(PostLike.post_id == post_id)) or 0
    )


def _comment_count(post_id: int, db: Session) -> int:
    return int(
        db.scalar(select(func.count()).select_from(PostComment).where(PostComment.post_id == post_id))
        or 0
    )


def _liked_by(post_id: int, user_id: int, db: Session) -> bool:
    return (
        db.scalar(
            select(PostLike.id).where(PostLike.post_id == post_id, PostLike.user_id == user_id)
        )
        is not None
    )


def _to_post_read(post: Post, current_user: User, db: Session, *, with_comments: bool) -> PostRead:
    comments: list[CommentRead] = []
    if with_comments:
        for c in post.comments:
            comments.append(
                CommentRead(
                    id=c.id,
                    user_id=c.user_id,
                    author_name=_author_name(c.user),
                    content=c.content,
                    created_at=c.created_at,
                )
            )

    return PostRead(
        id=post.id,
        user_id=post.user_id,
        author_name=_author_name(post.user),
        content=post.content,
        session_id=post.session_id,
        created_at=post.created_at,
        like_count=_like_count(post.id, db),
        liked_by_me=_liked_by(post.id, current_user.id, db),
        comment_count=_comment_count(post.id, db),
        comments=comments,
    )


@router.get("/posts", response_model=list[PostRead])
def list_posts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PostRead]:
    """모든 인증글을 최신순으로 반환한다(목록에선 댓글 본문 제외)."""
    posts = db.scalars(select(Post).order_by(Post.created_at.desc())).all()
    return [_to_post_read(p, current_user, db, with_comments=False) for p in posts]


@router.get("/posts/{post_id}", response_model=PostRead)
def get_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostRead:
    """인증글 상세(댓글 포함)."""
    post = _get_post(post_id, db)
    return _to_post_read(post, current_user, db, with_comments=True)


@router.post("/posts", response_model=PostRead, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostRead:
    # 공부기록을 연결하는 경우 본인 소유 세션만 허용
    if payload.session_id is not None:
        session = db.get(StudySession, payload.session_id)
        if session is None or session.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="연결할 공부기록을 찾을 수 없습니다."
            )

    post = Post(user_id=current_user.id, content=payload.content, session_id=payload.session_id)
    db.add(post)
    db.commit()
    db.refresh(post)
    return _to_post_read(post, current_user, db, with_comments=True)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    post = _get_post(post_id, db)
    if post.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인 글만 삭제할 수 있습니다.")
    db.delete(post)
    db.commit()


@router.post("/posts/{post_id}/like", response_model=PostRead)
def toggle_like(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostRead:
    """좋아요 토글. 이미 눌렀으면 취소한다."""
    post = _get_post(post_id, db)
    existing = db.scalar(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == current_user.id)
    )
    if existing is None:
        db.add(PostLike(post_id=post_id, user_id=current_user.id))
    else:
        db.delete(existing)
    db.commit()
    return _to_post_read(post, current_user, db, with_comments=False)


@router.post(
    "/posts/{post_id}/comments", response_model=PostRead, status_code=status.HTTP_201_CREATED
)
def create_comment(
    post_id: int,
    payload: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostRead:
    post = _get_post(post_id, db)
    comment = PostComment(post_id=post_id, user_id=current_user.id, content=payload.content)
    db.add(comment)
    db.commit()
    db.refresh(post)
    return _to_post_read(post, current_user, db, with_comments=True)


@router.delete("/posts/{post_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    post_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    comment = db.get(PostComment, comment_id)
    if comment is None or comment.post_id != post_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="댓글을 찾을 수 없습니다.")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인 댓글만 삭제할 수 있습니다.")
    db.delete(comment)
    db.commit()
