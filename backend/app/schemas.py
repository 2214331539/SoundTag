from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing_extensions import Annotated


PhoneNumber = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\+?\d{7,15}$")]
TagStatus = Literal["new", "owned", "locked"]
AuthPurpose = Literal["login", "register", "reset_password"]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    phone: str
    display_name: str | None = None
    created_at: datetime


class FriendRead(UserRead):
    friendship_created_at: datetime


class FriendSearchResponse(BaseModel):
    user: UserRead
    is_friend: bool


class FriendAddPayload(BaseModel):
    phone: PhoneNumber


class ChatMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sender_id: UUID
    recipient_id: UUID
    body: str
    created_at: datetime


class RequestCodePayload(BaseModel):
    phone: PhoneNumber
    purpose: AuthPurpose


class RequestCodeResponse(BaseModel):
    message: str
    debug_code: str | None = None
    expires_at: datetime


class VerifyCodePayload(BaseModel):
    phone: PhoneNumber
    purpose: AuthPurpose
    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=6)]
    display_name: str | None = Field(default=None, max_length=64)
    password: Password | None = None


class PasswordLoginPayload(BaseModel):
    phone: PhoneNumber
    password: Password


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class AudioRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tag_id: UUID
    owner_id: UUID
    title: str | None = None
    object_key: str
    file_url: str
    image_object_key: str | None = None
    image_url: str | None = None
    mime_type: str
    duration_seconds: int
    file_size: int | None = None
    is_active: bool
    replaced_at: datetime | None = None
    created_at: datetime


class TagStateResponse(BaseModel):
    uid: str
    status: TagStatus
    latest_record: AudioRecordRead | None = None


class UploadCredentialRequest(BaseModel):
    uid: str = Field(min_length=4, max_length=64)
    file_extension: str = Field(min_length=2, max_length=10)
    mime_type: str = Field(min_length=3, max_length=64)


class UploadCredentialResponse(BaseModel):
    access_key_id: str
    access_key_secret: str
    security_token: str
    expiration: str
    bucket: str
    upload_url: str
    object_key: str
    file_url: str
    mime_type: str


class FinalizeUploadPayload(BaseModel):
    title: str | None = Field(default=None, max_length=100)
    object_key: str = Field(min_length=1, max_length=255)
    file_url: str = Field(min_length=1, max_length=1024)
    image_object_key: str | None = Field(default=None, max_length=255)
    image_url: str | None = Field(default=None, max_length=1024)
    mime_type: str = Field(min_length=3, max_length=64)
    duration_seconds: int = Field(ge=0)
    file_size: int | None = Field(default=None, ge=0)


class UpdateRecordTitlePayload(BaseModel):
    title: str = Field(min_length=1, max_length=100)


class TimelineRecord(BaseModel):
    id: UUID
    uid: str
    title: str | None = None
    object_key: str
    file_url: str
    image_object_key: str | None = None
    image_url: str | None = None
    mime_type: str
    duration_seconds: int
    file_size: int | None = None
    is_active: bool
    replaced_at: datetime | None = None
    created_at: datetime


class FriendProfileResponse(BaseModel):
    user: UserRead
    records: list[TimelineRecord]
