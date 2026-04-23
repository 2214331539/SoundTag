import argparse
import sys
from collections import OrderedDict
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.db import engine
from app.core.security import utcnow
from app.models import AudioRecord
from app.services.oss import delete_object


def main() -> None:
    parser = argparse.ArgumentParser(description="Delete uploaded audio objects from OSS.")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually delete OSS objects and mark active audio records as inactive.",
    )
    args = parser.parse_args()

    settings = get_settings()
    if not settings.oss_enabled:
        raise SystemExit("OSS is not configured; cleanup was not executed.")

    with Session(engine) as session:
        records = session.exec(select(AudioRecord).where(AudioRecord.object_key != "")).all()
        object_keys = list(OrderedDict.fromkeys(record.object_key for record in records if record.object_key))
        active_records = [record for record in records if record.is_active]

        print(
            {
                "bucket": settings.oss_bucket,
                "total_records": len(records),
                "active_records": len(active_records),
                "unique_objects": len(object_keys),
                "mode": "execute" if args.execute else "dry-run",
            }
        )

        for object_key in object_keys:
            print(object_key)

        if not args.execute:
            print("Dry run only. Re-run with --execute to delete these OSS objects.")
            return

        deleted_keys: set[str] = set()
        failed: list[tuple[str, str]] = []

        for object_key in object_keys:
            try:
                delete_object(object_key)
                deleted_keys.add(object_key)
            except Exception as exc:
                failed.append((object_key, str(exc)))

        now = utcnow()
        deactivated = 0
        for record in active_records:
            if record.object_key in deleted_keys:
                record.is_active = False
                record.replaced_at = now
                session.add(record)
                deactivated += 1

        session.commit()

        print(
            {
                "deleted_objects": len(deleted_keys),
                "failed_objects": len(failed),
                "deactivated_records": deactivated,
            }
        )

        if failed:
            print("Failed objects:")
            for object_key, error in failed:
                print(f"{object_key}: {error}")


if __name__ == "__main__":
    main()
