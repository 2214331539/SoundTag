from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings


settings = get_settings()

connect_args: dict[str, bool] = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(settings.database_url, echo=settings.debug, connect_args=connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_audio_record_title_column()


def _ensure_audio_record_title_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("audiorecord"):
        return

    columns = {column["name"] for column in inspector.get_columns("audiorecord")}
    if "title" in columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE audiorecord ADD COLUMN title VARCHAR(100)"))


def get_session() -> Session:
    with Session(engine) as session:
        yield session
