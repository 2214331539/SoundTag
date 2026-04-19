from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "SoundTag API"
    api_v1_prefix: str = "/api/v1"
    debug: bool = True
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:8081",
            "http://localhost:19006",
            "http://127.0.0.1:19006",
        ]
    )

    jwt_secret: str = "replace-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_hours: int = 24 * 7
    debug_expose_otp: bool = True

    database_url: str = "sqlite:///./soundtag.db"

    aliyun_access_key_id: str | None = None
    aliyun_access_key_secret: str | None = None
    aliyun_sts_endpoint: str = "sts.cn-shanghai.aliyuncs.com"
    oss_endpoint: str = "oss-cn-shanghai.aliyuncs.com"
    oss_bucket: str | None = None
    oss_role_arn: str | None = None
    oss_cdn_base_url: str | None = None
    oss_sts_duration_seconds: int = 1800
    oss_object_prefix: str = "audio"

    @property
    def oss_enabled(self) -> bool:
        return all(
            [
                self.aliyun_access_key_id,
                self.aliyun_access_key_secret,
                self.oss_bucket,
                self.oss_role_arn,
                self.oss_endpoint,
            ]
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
