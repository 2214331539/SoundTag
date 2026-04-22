from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.core.db import get_session
from app.models import AudioRecord, Tag, User
from app.schemas import TimelineRecord
from app.services.oss import build_access_url


router = APIRouter(prefix="/records", tags=["records"])


@router.get("", response_model=list[TimelineRecord])
def list_records(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[TimelineRecord]:
    results = session.exec(
        select(AudioRecord, Tag.uid)
        .join(Tag, AudioRecord.tag_id == Tag.id)
        .where(AudioRecord.owner_id == current_user.id)
        .order_by(AudioRecord.created_at.desc())
    ).all()

    return [
        TimelineRecord(
            id=record.id,
            uid=uid,
            object_key=record.object_key,
            file_url=build_access_url(record.object_key),
            mime_type=record.mime_type,
            duration_seconds=record.duration_seconds,
            file_size=record.file_size,
            is_active=record.is_active,
            replaced_at=record.replaced_at,
            created_at=record.created_at,
        )
        for record, uid in results
    ]
