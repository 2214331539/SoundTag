from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_
from sqlmodel import Session, select

from app.api.auth import normalize_mainland_phone
from app.api.deps import get_current_user
from app.api.records import _serialize_timeline_record
from app.core.db import get_session
from app.models import AudioRecord, ChatMessage, Friendship, Tag, User
from app.schemas import (
    ChatMessageCreate,
    ChatMessageRead,
    FriendAddPayload,
    FriendProfileResponse,
    FriendRead,
    FriendSearchResponse,
    TimelineRecord,
    UserRead,
)


router = APIRouter(prefix="/friends", tags=["friends"])


def _get_friendship(session: Session, user_id: UUID, friend_id: UUID) -> Friendship | None:
    return session.exec(
        select(Friendship).where(Friendship.user_id == user_id, Friendship.friend_id == friend_id)
    ).first()


def _serialize_friend(user: User, friendship: Friendship) -> FriendRead:
    return FriendRead(
        id=user.id,
        phone=user.phone,
        display_name=user.display_name,
        created_at=user.created_at,
        friendship_created_at=friendship.created_at,
    )


def _create_friendship_pair(session: Session, current_user: User, friend: User) -> Friendship:
    friendship = _get_friendship(session, current_user.id, friend.id)
    reverse_friendship = _get_friendship(session, friend.id, current_user.id)

    if friendship is None:
        friendship = Friendship(user_id=current_user.id, friend_id=friend.id)
        session.add(friendship)

    if reverse_friendship is None:
        session.add(Friendship(user_id=friend.id, friend_id=current_user.id))

    session.commit()
    session.refresh(friendship)
    return friendship


def _ensure_friend(session: Session, current_user: User, friend_id: UUID) -> User:
    friend = session.get(User, friend_id)
    if friend is None or _get_friendship(session, current_user.id, friend_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friend not found.")

    return friend


def _list_friend_records(session: Session, friend: User) -> list[TimelineRecord]:
    results = session.exec(
        select(AudioRecord, Tag.uid)
        .join(Tag, AudioRecord.tag_id == Tag.id)
        .where(AudioRecord.owner_id == friend.id, AudioRecord.is_active.is_(True))
        .order_by(AudioRecord.created_at.desc())
    ).all()

    return [_serialize_timeline_record(record, uid) for record, uid in results]


@router.get("", response_model=list[FriendRead])
def list_friends(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[FriendRead]:
    results = session.exec(
        select(User, Friendship)
        .join(Friendship, Friendship.friend_id == User.id)
        .where(Friendship.user_id == current_user.id)
        .order_by(Friendship.created_at.desc())
    ).all()

    return [_serialize_friend(user, friendship) for user, friendship in results]


@router.get("/search", response_model=FriendSearchResponse)
def search_friend(
    phone: str = Query(min_length=7, max_length=20),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FriendSearchResponse:
    normalized_phone = normalize_mainland_phone(phone)
    user = session.exec(select(User).where(User.phone == normalized_phone)).first()

    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot add yourself.")

    return FriendSearchResponse(
        user=UserRead.model_validate(user),
        is_friend=_get_friendship(session, current_user.id, user.id) is not None,
    )


@router.post("", response_model=FriendRead, status_code=status.HTTP_201_CREATED)
def add_friend(
    payload: FriendAddPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FriendRead:
    normalized_phone = normalize_mainland_phone(payload.phone)
    friend = session.exec(select(User).where(User.phone == normalized_phone)).first()

    if friend is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if friend.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot add yourself.")

    friendship = _create_friendship_pair(session, current_user, friend)
    return _serialize_friend(friend, friendship)


@router.get("/{friend_id}/records", response_model=list[TimelineRecord])
def list_friend_records(
    friend_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[TimelineRecord]:
    friend = _ensure_friend(session, current_user, friend_id)
    return _list_friend_records(session, friend)


@router.get("/{friend_id}/profile", response_model=FriendProfileResponse)
def get_friend_profile(
    friend_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FriendProfileResponse:
    friend = _ensure_friend(session, current_user, friend_id)
    return FriendProfileResponse(user=UserRead.model_validate(friend), records=_list_friend_records(session, friend))


@router.get("/{friend_id}/messages", response_model=list[ChatMessageRead])
def list_friend_messages(
    friend_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[ChatMessageRead]:
    friend = _ensure_friend(session, current_user, friend_id)
    messages = session.exec(
        select(ChatMessage)
        .where(
            or_(
                and_(ChatMessage.sender_id == current_user.id, ChatMessage.recipient_id == friend.id),
                and_(ChatMessage.sender_id == friend.id, ChatMessage.recipient_id == current_user.id),
            )
        )
        .order_by(ChatMessage.created_at.asc())
    ).all()

    return [ChatMessageRead.model_validate(message) for message in messages]


@router.post("/{friend_id}/messages", response_model=ChatMessageRead, status_code=status.HTTP_201_CREATED)
def send_friend_message(
    friend_id: UUID,
    payload: ChatMessageCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ChatMessageRead:
    friend = _ensure_friend(session, current_user, friend_id)
    message = ChatMessage(sender_id=current_user.id, recipient_id=friend.id, body=payload.body.strip())

    session.add(message)
    session.commit()
    session.refresh(message)

    return ChatMessageRead.model_validate(message)
