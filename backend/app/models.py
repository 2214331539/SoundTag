import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.core.security import utcnow


class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    phone: str = Field(index=True, unique=True, nullable=False)
    display_name: str | None = Field(default=None, max_length=64)
    password_hash: str | None = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class Friendship(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_friendship_pair"),
        CheckConstraint("user_id <> friend_id", name="ck_friendship_not_self"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, index=True)
    friend_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, index=True)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class PhoneCode(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    phone: str = Field(index=True, nullable=False)
    code: str = Field(nullable=False, max_length=6)
    expires_at: datetime = Field(nullable=False)
    consumed_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class Tag(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    uid: str = Field(index=True, unique=True, nullable=False, max_length=64)
    owner_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, index=True)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=utcnow, nullable=False)


class AudioRecord(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tag_id: uuid.UUID = Field(foreign_key="tag.id", nullable=False, index=True)
    owner_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, index=True)
    title: str | None = Field(default=None, max_length=100)
    object_key: str = Field(nullable=False, max_length=255)
    file_url: str = Field(nullable=False, max_length=1024)
    image_object_key: str | None = Field(default=None, max_length=255)
    image_url: str | None = Field(default=None, max_length=1024)
    mime_type: str = Field(nullable=False, max_length=64)
    duration_seconds: int = Field(nullable=False, ge=0)
    file_size: int | None = Field(default=None, ge=0)
    is_active: bool = Field(default=True, nullable=False)
    replaced_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class ChatMessage(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sender_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, index=True)
    recipient_id: uuid.UUID = Field(foreign_key="user.id", nullable=False, index=True)
    body: str = Field(nullable=False, max_length=1000)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
