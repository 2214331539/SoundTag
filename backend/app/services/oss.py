import logging
import json
import os
import re
import uuid
from contextlib import contextmanager

import oss2
from alibabacloud_tea_openapi.exceptions import ClientException
from fastapi import HTTPException, status

from alibabacloud_sts20150401 import models as sts_models
from alibabacloud_sts20150401.client import Client as StsClient
from alibabacloud_tea_openapi import models as open_api_models

from app.core.config import get_settings
from app.schemas import UploadCredentialResponse


settings = get_settings()
logger = logging.getLogger(__name__)

SAFE_EXTENSION_PATTERN = re.compile(r"^[a-zA-Z0-9]+$")
PROXY_ENV_KEYS = (
    "ALL_PROXY",
    "all_proxy",
    "HTTP_PROXY",
    "http_proxy",
    "HTTPS_PROXY",
    "https_proxy",
    "GIT_HTTP_PROXY",
    "GIT_HTTPS_PROXY",
    "git_http_proxy",
    "git_https_proxy",
)


def _normalize_endpoint(endpoint: str) -> str:
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    return f"https://{endpoint}"


def _bucket_host() -> str:
    return f"https://{settings.oss_bucket}.{settings.oss_endpoint}"


@contextmanager
def _without_proxy_env():
    original_values = {key: os.environ.pop(key, None) for key in PROXY_ENV_KEYS}
    try:
        yield
    finally:
        for key, value in original_values.items():
            if value is not None:
                os.environ[key] = value


def build_public_url(object_key: str) -> str:
    base = settings.oss_cdn_base_url.rstrip("/") if settings.oss_cdn_base_url else _bucket_host()
    return f"{base}/{object_key}"


def _bucket() -> oss2.Bucket:
    auth = oss2.Auth(settings.aliyun_access_key_id, settings.aliyun_access_key_secret)
    return oss2.Bucket(auth, _normalize_endpoint(settings.oss_endpoint), settings.oss_bucket)


def build_access_url(object_key: str, expires_seconds: int = 3600) -> str:
    if settings.oss_cdn_base_url:
        return build_public_url(object_key)

    if not settings.oss_enabled:
        return build_public_url(object_key)

    with _without_proxy_env():
        return _bucket().sign_url("GET", object_key, expires_seconds, slash_safe=True)


def build_object_key(user_id: str, uid: str, file_extension: str) -> str:
    extension = file_extension.lower().lstrip(".")
    if not SAFE_EXTENSION_PATTERN.match(extension):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file extension.")

    safe_uid = re.sub(r"[^0-9A-Za-z_-]", "", uid).upper()
    if not safe_uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tag UID.")

    return (
        f"{settings.oss_object_prefix.strip('/')}/{user_id}/{safe_uid}/"
        f"{uuid.uuid4().hex}.{extension}"
    )


def _sts_client() -> StsClient:
    if not settings.oss_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OSS STS is not configured.",
        )

    config = open_api_models.Config(
        access_key_id=settings.aliyun_access_key_id,
        access_key_secret=settings.aliyun_access_key_secret,
        endpoint=settings.aliyun_sts_endpoint,
    )
    return StsClient(config)


def issue_upload_credential(object_key: str, mime_type: str) -> UploadCredentialResponse:
    policy = {
        "Version": "1",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": ["oss:PutObject"],
                "Resource": [f"acs:oss:*:*:{settings.oss_bucket}/{object_key}"],
            }
        ],
    }

    request = sts_models.AssumeRoleRequest(
        role_arn=settings.oss_role_arn,
        role_session_name=f"soundtag-{uuid.uuid4().hex[:12]}",
        duration_seconds=settings.oss_sts_duration_seconds,
        policy=json.dumps(policy, separators=(",", ":")),
    )

    try:
        with _without_proxy_env():
            response = _sts_client().assume_role(request)
        credentials = response.body.credentials
    except ClientException as exc:
        logger.exception("OSS STS rejected the AssumeRole request.")
        detail = "OSS STS rejected the request. Check RAM permissions and role trust policy."
        if "Roles may not be assumed by root accounts" in str(exc):
            detail = (
                "OSS STS rejected the current AccessKey. Alibaba Cloud root-account AccessKeys "
                "cannot AssumeRole. Replace them with a RAM user AccessKey that has "
                "sts:AssumeRole permission on the configured OSS role."
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to issue OSS upload credential.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OSS STS is unavailable. Check backend network access and proxy settings.",
        ) from exc

    return UploadCredentialResponse(
        access_key_id=credentials.access_key_id,
        access_key_secret=credentials.access_key_secret,
        security_token=credentials.security_token,
        expiration=credentials.expiration,
        bucket=settings.oss_bucket,
        upload_url=_bucket_host(),
        object_key=object_key,
        file_url=build_public_url(object_key),
        mime_type=mime_type,
    )


def delete_object(object_key: str) -> None:
    if not settings.oss_enabled or not object_key:
        return

    with _without_proxy_env():
        _bucket().delete_object(object_key)
