import json
import logging
from dataclasses import dataclass

from app.core.config import get_settings


logger = logging.getLogger(__name__)
settings = get_settings()


class SmsDeliveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class SmsSendResult:
    expires_seconds: int
    debug_code: str | None = None


def send_verification_code(phone: str, code: str, purpose: str) -> SmsSendResult:
    provider = settings.sms_provider_normalized

    if provider == "aliyun_cloud":
        return send_aliyun_cloud_verification_code(phone=phone)

    if provider == "aliyun":
        send_aliyun_template_sms(phone=phone, code=code)
        return SmsSendResult(expires_seconds=settings.sms_code_expire_minutes * 60)

    if provider != "log":
        raise SmsDeliveryError(f"Unsupported SMS provider: {settings.sms_provider}.")

    if not settings.debug and not settings.debug_expose_otp:
        raise SmsDeliveryError("SMS provider is not configured.")

    logger.warning("SoundTag verification code for %s (%s): %s", phone, purpose, code)
    return SmsSendResult(
        expires_seconds=settings.sms_code_expire_minutes * 60,
        debug_code=code if settings.debug_expose_otp else None,
    )


def verify_cloud_verification_code(phone: str, code: str) -> bool:
    provider = settings.sms_provider_normalized
    if provider != "aliyun_cloud":
        return False

    return check_aliyun_cloud_verification_code(phone=phone, code=code)


def send_aliyun_template_sms(phone: str, code: str) -> None:
    if not settings.aliyun_sms_enabled:
        raise SmsDeliveryError(
            "Aliyun SMS is not fully configured. Set SMS_SIGN_NAME, SMS_TEMPLATE_CODE, "
            "ALIYUN_ACCESS_KEY_ID and ALIYUN_ACCESS_KEY_SECRET."
        )

    try:
        from alibabacloud_dysmsapi20170525.client import Client as DysmsapiClient
        from alibabacloud_dysmsapi20170525 import models as dysmsapi_models
        from alibabacloud_tea_openapi import models as open_api_models
        from alibabacloud_tea_util import models as util_models
    except ImportError as exc:
        raise SmsDeliveryError(
            "Aliyun SMS SDK is not installed. Run `pip install -r requirements.txt`."
        ) from exc

    config = open_api_models.Config(
        access_key_id=settings.aliyun_access_key_id,
        access_key_secret=settings.aliyun_access_key_secret,
    )
    config.endpoint = settings.aliyun_sms_endpoint

    client = DysmsapiClient(config)
    template_param = json.dumps(
        {settings.sms_template_code_key: code},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    request = dysmsapi_models.SendSmsRequest(
        phone_numbers=_to_mainland_sms_number(phone),
        sign_name=settings.sms_sign_name,
        template_code=settings.sms_template_code,
        template_param=template_param,
    )

    try:
        response = client.send_sms_with_options(request, util_models.RuntimeOptions())
    except Exception as exc:
        raise SmsDeliveryError(f"Aliyun SMS request failed: {exc}") from exc

    response_code, response_message = _extract_response_code_and_message(response)
    if response_code != "OK":
        raise SmsDeliveryError(f"Aliyun SMS rejected the request: {response_code} {response_message}")


def send_aliyun_cloud_verification_code(phone: str) -> SmsSendResult:
    if not settings.aliyun_cloud_verify_enabled:
        raise SmsDeliveryError(
            "Aliyun cloud verification is not fully configured. Set SMS_SIGN_NAME, SMS_TEMPLATE_CODE, "
            "ALIYUN_ACCESS_KEY_ID and ALIYUN_ACCESS_KEY_SECRET."
        )

    try:
        from alibabacloud_dypnsapi20170525.client import Client as DypnsapiClient
        from alibabacloud_dypnsapi20170525 import models as dypns_models
        from alibabacloud_tea_openapi import models as open_api_models
        from alibabacloud_tea_util import models as util_models
    except ImportError as exc:
        raise SmsDeliveryError(
            "Aliyun Phone Number Verification SDK is not installed. Run `pip install -r requirements.txt`."
        ) from exc

    client = _dypns_client(DypnsapiClient, open_api_models)
    request = dypns_models.SendSmsVerifyCodeRequest(
        auto_retry=settings.aliyun_verify_auto_retry,
        code_length=settings.aliyun_verify_code_length,
        code_type=settings.aliyun_verify_code_type,
        country_code="86",
        duplicate_policy=settings.aliyun_verify_duplicate_policy,
        interval=settings.aliyun_verify_interval_seconds,
        phone_number=_to_mainland_sms_number(phone),
        return_verify_code=settings.aliyun_verify_return_code,
        scheme_name=settings.aliyun_verify_scheme_name,
        sign_name=settings.sms_sign_name,
        template_code=settings.sms_template_code,
        template_param=_cloud_template_param(),
        valid_time=settings.aliyun_verify_valid_time_seconds,
    )

    try:
        response = client.send_sms_verify_code_with_options(request, util_models.RuntimeOptions())
    except Exception as exc:
        raise SmsDeliveryError(f"Aliyun cloud verification send request failed: {exc}") from exc

    response_code, response_message = _extract_response_code_and_message(response)
    if response_code != "OK" or not _response_success(response):
        raise SmsDeliveryError(
            f"Aliyun cloud verification rejected the send request: {response_code} {response_message}"
        )

    return SmsSendResult(
        expires_seconds=settings.aliyun_verify_valid_time_seconds,
        debug_code=_extract_verify_code(response) if settings.aliyun_verify_return_code else None,
    )


def check_aliyun_cloud_verification_code(phone: str, code: str) -> bool:
    if not settings.aliyun_cloud_verify_enabled:
        raise SmsDeliveryError(
            "Aliyun cloud verification is not fully configured. Set SMS_SIGN_NAME, SMS_TEMPLATE_CODE, "
            "ALIYUN_ACCESS_KEY_ID and ALIYUN_ACCESS_KEY_SECRET."
        )

    try:
        from alibabacloud_dypnsapi20170525.client import Client as DypnsapiClient
        from alibabacloud_dypnsapi20170525 import models as dypns_models
        from alibabacloud_tea_openapi import models as open_api_models
        from alibabacloud_tea_util import models as util_models
    except ImportError as exc:
        raise SmsDeliveryError(
            "Aliyun Phone Number Verification SDK is not installed. Run `pip install -r requirements.txt`."
        ) from exc

    client = _dypns_client(DypnsapiClient, open_api_models)
    request = dypns_models.CheckSmsVerifyCodeRequest(
        country_code="86",
        phone_number=_to_mainland_sms_number(phone),
        scheme_name=settings.aliyun_verify_scheme_name,
        verify_code=code,
    )

    try:
        response = client.check_sms_verify_code_with_options(request, util_models.RuntimeOptions())
    except Exception as exc:
        raise SmsDeliveryError(f"Aliyun cloud verification check request failed: {exc}") from exc

    response_code, response_message = _extract_response_code_and_message(response)
    if response_code != "OK" or not _response_success(response):
        logger.warning(
            "Aliyun cloud verification rejected the check request: %s %s",
            response_code,
            response_message,
        )
        return False

    response_body = getattr(response, "body", None)
    response_model = getattr(response_body, "model", None)
    verify_result = getattr(response_model, "verify_result", None)

    if isinstance(verify_result, bool):
        return verify_result

    if verify_result is not None:
        return str(verify_result).lower() in {"true", "pass", "success", "ok", "1", "verify_pass"}

    return True


def _dypns_client(client_class, open_api_models):
    config = open_api_models.Config(
        access_key_id=settings.aliyun_access_key_id,
        access_key_secret=settings.aliyun_access_key_secret,
    )
    config.endpoint = settings.effective_aliyun_pnvs_endpoint
    return client_class(config)


def _cloud_template_param() -> str:
    return json.dumps(
        {
            settings.sms_template_code_key: "##code##",
            "min": str(max(1, settings.aliyun_verify_valid_time_seconds // 60)),
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _extract_response_code_and_message(response) -> tuple[str | None, str | None]:
    response_body = getattr(response, "body", None)
    response_code = getattr(response_body, "code", None)
    response_message = getattr(response_body, "message", None)

    if response_code is None:
        response_code = getattr(response_body, "Code", None)

    if response_message is None:
        response_message = getattr(response_body, "Message", None)

    return response_code, response_message


def _extract_verify_code(response) -> str | None:
    response_body = getattr(response, "body", None)
    if response_body is None:
        return None

    for attribute in ("verify_code", "verifyCode", "code"):
        value = getattr(response_body, attribute, None)
        if value:
            return str(value)

    response_model = getattr(response_body, "model", None)
    if response_model is not None:
        value = getattr(response_model, "verify_code", None)
        if value:
            return str(value)

    data = getattr(response_body, "data", None)
    if isinstance(data, dict):
        for key in ("verifyCode", "verify_code", "code"):
            if data.get(key):
                return str(data[key])

    return None


def _response_success(response) -> bool:
    response_body = getattr(response, "body", None)
    success = getattr(response_body, "success", None)

    if success is None:
        return True

    return bool(success)


def _to_mainland_sms_number(phone: str) -> str:
    if phone.startswith("+86"):
        return phone[3:]

    return phone
