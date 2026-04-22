from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.core.db import get_session
from app.core.security import utcnow
from app.models import AudioRecord, Tag, User
from app.schemas import (
    AudioRecordRead,
    FinalizeUploadPayload,
    TagStateResponse,
    UploadCredentialRequest,
    UploadCredentialResponse,
)
from app.services.oss import build_access_url, build_object_key, build_public_url, delete_object, issue_upload_credential


router = APIRouter(prefix="/tags", tags=["tags"])


def _fetch_tag_by_uid(session: Session, uid: str) -> Tag | None:
    return session.exec(select(Tag).where(Tag.uid == uid)).first()


def _latest_record_for_tag(session: Session, tag_id: str) -> AudioRecord | None:
    return session.exec(
        select(AudioRecord)
        .where(AudioRecord.tag_id == tag_id, AudioRecord.is_active.is_(True))
        .order_by(AudioRecord.created_at.desc())
    ).first()


def _serialize_audio_record(record: AudioRecord) -> AudioRecordRead:
    payload = AudioRecordRead.model_validate(record)
    return payload.model_copy(update={"file_url": build_access_url(record.object_key)})


@router.get("/{uid}", response_model=TagStateResponse)
def lookup_tag(
    uid: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TagStateResponse:
    tag = _fetch_tag_by_uid(session, uid)
    if tag is None:
        return TagStateResponse(uid=uid, status="new")

    if tag.owner_id != current_user.id:
        return TagStateResponse(uid=uid, status="locked")

    latest_record = _latest_record_for_tag(session, tag.id)
    return TagStateResponse(
        uid=uid,
        status="owned",
        latest_record=_serialize_audio_record(latest_record) if latest_record else None,
    )


@router.post("/uploads/sts", response_model=UploadCredentialResponse)
def create_upload_credential(
    payload: UploadCredentialRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UploadCredentialResponse:
    tag = _fetch_tag_by_uid(session, payload.uid)
    if tag is not None and tag.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This tag belongs to another account.")

    object_key = build_object_key(str(current_user.id), payload.uid, payload.file_extension)
    return issue_upload_credential(object_key, payload.mime_type)


@router.post("/{uid}/bind", response_model=AudioRecordRead)
def bind_uploaded_audio(
    uid: str,
    payload: FinalizeUploadPayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AudioRecordRead:
    tag = _fetch_tag_by_uid(session, uid)
    if tag is None:
        tag = Tag(uid=uid, owner_id=current_user.id)
        session.add(tag)
        session.commit()
        session.refresh(tag)
    elif tag.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This tag belongs to another account.")

    previous_records = session.exec(
        select(AudioRecord).where(AudioRecord.tag_id == tag.id, AudioRecord.is_active.is_(True))
    ).all()

    now = utcnow()
    objects_to_delete = []
    for record in previous_records:
        record.is_active = False
        record.replaced_at = now
        session.add(record)
        objects_to_delete.append(record.object_key)

    new_record = AudioRecord(
        tag_id=tag.id,
        owner_id=current_user.id,
        object_key=payload.object_key,
        file_url=build_public_url(payload.object_key),
        mime_type=payload.mime_type,
        duration_seconds=payload.duration_seconds,
        file_size=payload.file_size,
    )

    tag.updated_at = now
    session.add(tag)
    session.add(new_record)
    session.commit()
    session.refresh(new_record)

    for object_key in objects_to_delete:
        try:
            delete_object(object_key)
        except Exception:
            # Old files should be deleted eventually, but binding must stay successful.
            continue

    return _serialize_audio_record(new_record)
