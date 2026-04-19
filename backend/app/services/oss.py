import json
import re
import uuid

import oss2
from fastapi import HTTPException, status

from alibabacloud_sts20150401 import models as sts_models
from alibabacloud_sts20150401.client import Client as StsClient
from alibabacloud_tea_openapi import models as open_api_models

from app.core.config import get_settings
from app.schemas import UploadCredentialResponse


settings = get_settings()

SAFE_EXTENSION_PATTERN = re.compile(r"^[a-zA-Z0-9]+$")


def _normalize_endpoint(endpoint: str) -> str:
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    return f"https://{endpoint}"


def _bucket_host() -> str:
    return f"https://{settings.oss_bucket}.{settings.oss_endpoint}"


def build_public_url(object_key: str) -> str:
    base = settings.oss_cdn_base_url.rstrip("/") if settings.oss_cdn_base_url else _bucket_host()
    return f"{base}/{object_key}"


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

    response = _sts_client().assume_role(request)
    credentials = response.body.credentials

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

    auth = oss2.Auth(settings.aliyun_access_key_id, settings.aliyun_access_key_secret)
    bucket = oss2.Bucket(auth, _normalize_endpoint(settings.oss_endpoint), settings.oss_bucket)
    bucket.delete_object(object_key)
