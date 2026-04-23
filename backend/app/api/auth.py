import re
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import create_access_token, hash_password, utcnow, verify_password
from app.models import PhoneCode, User
from app.schemas import (
    PasswordLoginPayload,
    RequestCodePayload,
    RequestCodeResponse,
    TokenResponse,
    UserRead,
    VerifyCodePayload,
)
from app.services.sms import SmsDeliveryError, send_verification_code, verify_cloud_verification_code


router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/request-code", response_model=RequestCodeResponse)
def request_code(payload: RequestCodePayload, session: Session = Depends(get_session)) -> RequestCodeResponse:
    now = utcnow()
    phone = normalize_mainland_phone(payload.phone)
    existing_user = session.exec(select(User).where(User.phone == phone)).first()
    use_cloud_verification = settings.sms_provider_normalized == "aliyun_cloud"

    if payload.purpose == "login" and existing_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="账号不存在，请先注册。")

    if payload.purpose == "register" and existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该手机号已注册，请直接登录。")

    if payload.purpose == "reset_password" and existing_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="账号不存在，请先注册。")

    if not use_cloud_verification:
        latest_code = session.exec(
            select(PhoneCode)
            .where(PhoneCode.phone == phone)
            .order_by(PhoneCode.created_at.desc())
        ).first()

        if latest_code and within_cooldown(latest_code.created_at, now):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"验证码发送过于频繁，请 {settings.sms_resend_cooldown_seconds} 秒后再试。",
            )

    generated_code = f"{secrets.randbelow(1000000):06d}"

    try:
        send_result = send_verification_code(phone=phone, code=generated_code, purpose=payload.purpose)
    except SmsDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"短信发送失败：{exc}",
        ) from exc

    expires_at = now + timedelta(seconds=send_result.expires_seconds)

    if not use_cloud_verification:
        active_codes = session.exec(
            select(PhoneCode).where(
                PhoneCode.phone == phone,
                PhoneCode.consumed_at.is_(None),
                PhoneCode.expires_at > now,
            )
        ).all()
        for code in active_codes:
            code.consumed_at = now
            session.add(code)

        session.add(PhoneCode(phone=phone, code=generated_code, expires_at=expires_at))
        session.commit()

    return RequestCodeResponse(
        message="验证码已发送。",
        debug_code=send_result.debug_code,
        expires_at=expires_at,
    )


@router.post("/verify-code", response_model=TokenResponse)
def verify_code(payload: VerifyCodePayload, session: Session = Depends(get_session)) -> TokenResponse:
    now = utcnow()
    phone = normalize_mainland_phone(payload.phone)
    user = session.exec(select(User).where(User.phone == phone)).first()

    if payload.purpose == "login" and user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="账号不存在，请先注册。")

    if payload.purpose == "register" and user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该手机号已注册，请直接登录。")

    if payload.purpose == "reset_password" and user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="账号不存在，请先注册。")

    if payload.purpose in {"register", "reset_password"} and not payload.password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="请设置至少 8 位登录密码。")

    if settings.sms_provider_normalized == "aliyun_cloud":
        try:
            is_valid_code = verify_cloud_verification_code(phone=phone, code=payload.code)
        except SmsDeliveryError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"验证码校验失败：{exc}",
            ) from exc

        if not is_valid_code:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="验证码无效或已过期。")
    else:
        code_record = session.exec(
            select(PhoneCode)
            .where(
                PhoneCode.phone == phone,
                PhoneCode.consumed_at.is_(None),
                PhoneCode.expires_at > now,
            )
            .order_by(PhoneCode.created_at.desc())
        ).first()

        if code_record is None or code_record.code != payload.code:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="验证码无效或已过期。")

        code_record.consumed_at = now
        session.add(code_record)

    if payload.purpose == "register":
        user = User(
            phone=phone,
            display_name=payload.display_name or f"SoundTag 用户 {phone[-4:]}",
            password_hash=hash_password(payload.password or ""),
        )
        session.add(user)
    elif payload.purpose == "reset_password":
        user.password_hash = hash_password(payload.password or "")
        session.add(user)

    session.commit()
    session.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/password-login", response_model=TokenResponse)
def password_login(payload: PasswordLoginPayload, session: Session = Depends(get_session)) -> TokenResponse:
    phone = normalize_mainland_phone(payload.phone)
    user = session.exec(select(User).where(User.phone == phone)).first()

    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="账号不存在，请先注册。")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="手机号或密码不正确。")

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


def normalize_mainland_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)

    if digits.startswith("86") and len(digits) == 13:
        digits = digits[2:]

    if len(digits) != 11 or not digits.startswith("1"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="请输入有效的中国大陆手机号。")

    return f"+86{digits}"


def as_utc_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def within_cooldown(created_at: datetime, now: datetime) -> bool:
    normalized_created_at = as_utc_aware(created_at)

    if normalized_created_at > now + timedelta(minutes=5):
        return False

    return normalized_created_at + timedelta(seconds=settings.sms_resend_cooldown_seconds) > now
