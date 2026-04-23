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
    sms_provider: str = "log"
    sms_code_expire_minutes: int = 5
    sms_resend_cooldown_seconds: int = 60
    sms_sign_name: str | None = None
    sms_template_code: str | None = None
    sms_template_code_key: str = "code"
    aliyun_sms_endpoint: str = "dysmsapi.aliyuncs.com"
    aliyun_pnvs_endpoint: str = "dypnsapi.aliyuncs.com"
    aliyun_verify_scheme_name: str | None = None
    aliyun_verify_code_length: int = 6
    aliyun_verify_code_type: int = 1
    aliyun_verify_valid_time_seconds: int = 300
    aliyun_verify_duplicate_policy: int = 1
    aliyun_verify_interval_seconds: int = 60
    aliyun_verify_return_code: bool = False
    aliyun_verify_auto_retry: int = 1

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

    @property
    def aliyun_sms_enabled(self) -> bool:
        return all(
            [
                self.aliyun_access_key_id,
                self.aliyun_access_key_secret,
                self.sms_sign_name,
                self.sms_template_code,
                self.aliyun_sms_endpoint,
            ]
        )

    @property
    def sms_provider_normalized(self) -> str:
        provider = self.sms_provider.strip().lower().replace("-", "_")
        aliases = {
            "aliyuncloud": "aliyun_cloud",
            "aliyun_cloud_verify": "aliyun_cloud",
            "aliyun_verify": "aliyun_cloud",
            "aliyun_pnvs": "aliyun_cloud",
            "dypns": "aliyun_cloud",
            "dypnsapi": "aliyun_cloud",
            "pnvs": "aliyun_cloud",
        }
        return aliases.get(provider, provider)

    @property
    def effective_aliyun_pnvs_endpoint(self) -> str:
        if self.aliyun_sms_endpoint and self.aliyun_sms_endpoint.startswith("dypns"):
            return self.aliyun_sms_endpoint

        return self.aliyun_pnvs_endpoint

    @property
    def aliyun_cloud_verify_enabled(self) -> bool:
        return all(
            [
                self.aliyun_access_key_id,
                self.aliyun_access_key_secret,
                self.sms_sign_name,
                self.sms_template_code,
                self.aliyun_pnvs_endpoint,
            ]
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
