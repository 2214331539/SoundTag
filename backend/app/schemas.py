from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing_extensions import Annotated


PhoneNumber = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\+?\d{7,15}$")]
TagStatus = Literal["new", "owned", "locked"]


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    phone: str
    display_name: str | None = None
    created_at: datetime


class RequestCodePayload(BaseModel):
    phone: PhoneNumber


class RequestCodeResponse(BaseModel):
    message: str
    debug_code: str | None = None
    expires_at: datetime


class VerifyCodePayload(BaseModel):
    phone: PhoneNumber
    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=6)]
    display_name: str | None = Field(default=None, max_length=64)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class AudioRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tag_id: str
    owner_id: str
    object_key: str
    file_url: str
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
    object_key: str = Field(min_length=1, max_length=255)
    file_url: str = Field(min_length=1, max_length=1024)
    mime_type: str = Field(min_length=3, max_length=64)
    duration_seconds: int = Field(ge=0)
    file_size: int | None = Field(default=None, ge=0)


class TimelineRecord(BaseModel):
    id: str
    uid: str
    object_key: str
    file_url: str
    mime_type: str
    duration_seconds: int
    file_size: int | None = None
    is_active: bool
    replaced_at: datetime | None = None
    created_at: datetime
