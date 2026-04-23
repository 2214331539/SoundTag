from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.core.db import get_session
from app.core.security import utcnow
from app.models import AudioRecord, Tag, User
from app.schemas import TimelineRecord, UpdateRecordTitlePayload
from app.services.oss import build_access_url, delete_object


router = APIRouter(prefix="/records", tags=["records"])


def _serialize_timeline_record(record: AudioRecord, uid: str) -> TimelineRecord:
    return TimelineRecord(
        id=record.id,
        uid=uid,
        title=record.title,
        object_key=record.object_key,
        file_url=build_access_url(record.object_key),
        mime_type=record.mime_type,
        duration_seconds=record.duration_seconds,
        file_size=record.file_size,
        is_active=record.is_active,
        replaced_at=record.replaced_at,
        created_at=record.created_at,
    )


def _fetch_active_record_with_tag(
    session: Session,
    record_id: UUID,
    current_user: User,
) -> tuple[AudioRecord, Tag]:
    result = session.exec(
        select(AudioRecord, Tag)
        .join(Tag, AudioRecord.tag_id == Tag.id)
        .where(
            AudioRecord.id == record_id,
            AudioRecord.owner_id == current_user.id,
            AudioRecord.is_active.is_(True),
        )
    ).first()

    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found.")

    return result


@router.get("", response_model=list[TimelineRecord])
def list_records(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[TimelineRecord]:
    results = session.exec(
        select(AudioRecord, Tag.uid)
        .join(Tag, AudioRecord.tag_id == Tag.id)
        .where(AudioRecord.owner_id == current_user.id, AudioRecord.is_active.is_(True))
        .order_by(AudioRecord.created_at.desc())
    ).all()

    return [_serialize_timeline_record(record, uid) for record, uid in results]


@router.patch("/{record_id}", response_model=TimelineRecord)
def rename_record(
    record_id: UUID,
    payload: UpdateRecordTitlePayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TimelineRecord:
    record, tag = _fetch_active_record_with_tag(session, record_id, current_user)

    record.title = payload.title.strip()
    tag.updated_at = utcnow()
    session.add(record)
    session.add(tag)
    session.commit()
    session.refresh(record)

    return _serialize_timeline_record(record, tag.uid)


@router.delete("/{record_id}")
def delete_record(
    record_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    record, tag = _fetch_active_record_with_tag(session, record_id, current_user)

    now = utcnow()
    record.is_active = False
    record.replaced_at = now
    tag.updated_at = now
    session.add(record)
    session.add(tag)
    session.commit()

    try:
        delete_object(record.object_key)
    except Exception:
        pass

    return {"message": "Recording deleted."}
