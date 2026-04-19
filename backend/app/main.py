from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.records import router as records_router
from app.api.tags import router as tags_router
from app.core.config import get_settings
from app.core.db import init_db


settings = get_settings()
app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(tags_router, prefix=settings.api_v1_prefix)
app.include_router(records_router, prefix=settings.api_v1_prefix)
