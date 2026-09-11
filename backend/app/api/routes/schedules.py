"""일정 라우터. 날짜별 할 일을 관리하고 완료 여부를 토글한다."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import ScheduleItem, User
from app.schemas.schedule import ScheduleItemCreate, ScheduleItemRead, ScheduleItemUpdate

router = APIRouter(prefix="/schedules", tags=["schedules"])


def _get_owned_item(item_id: int, user: User, db: Session) -> ScheduleItem:
    item = db.get(ScheduleItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="일정을 찾을 수 없습니다.")
    return item


@router.get("", response_model=list[ScheduleItemRead])
def list_schedules(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ScheduleItem]:
    stmt = select(ScheduleItem).where(ScheduleItem.user_id == current_user.id)
    if start is not None:
        stmt = stmt.where(ScheduleItem.scheduled_date >= start)
    if end is not None:
        stmt = stmt.where(ScheduleItem.scheduled_date <= end)
    return list(db.scalars(stmt.order_by(ScheduleItem.scheduled_date)))


@router.post("", response_model=ScheduleItemRead, status_code=status.HTTP_201_CREATED)
def create_schedule(
    payload: ScheduleItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleItem:
    item = ScheduleItem(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        scheduled_date=payload.scheduled_date,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ScheduleItemRead)
def update_schedule(
    item_id: int,
    payload: ScheduleItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleItem:
    item = _get_owned_item(item_id, current_user, db)
    # 전달된 필드만 부분 갱신한다.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    item = _get_owned_item(item_id, current_user, db)
    db.delete(item)
    db.commit()
