import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import create_access_token, utcnow
from app.models import PhoneCode, User
from app.schemas import RequestCodePayload, RequestCodeResponse, TokenResponse, UserRead, VerifyCodePayload


router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/request-code", response_model=RequestCodeResponse)
def request_code(payload: RequestCodePayload, session: Session = Depends(get_session)) -> RequestCodeResponse:
    now = utcnow()
    active_codes = session.exec(
        select(PhoneCode).where(
            PhoneCode.phone == payload.phone,
            PhoneCode.consumed_at.is_(None),
            PhoneCode.expires_at > now,
        )
    ).all()

    for code in active_codes:
        code.consumed_at = now
        session.add(code)

    generated_code = "123456" if settings.debug_expose_otp else f"{secrets.randbelow(1000000):06d}"
    expires_at = now + timedelta(minutes=5)

    session.add(PhoneCode(phone=payload.phone, code=generated_code, expires_at=expires_at))
    session.commit()

    return RequestCodeResponse(
        message="Verification code issued.",
        debug_code=generated_code if settings.debug_expose_otp else None,
        expires_at=expires_at,
    )


@router.post("/verify-code", response_model=TokenResponse)
def verify_code(payload: VerifyCodePayload, session: Session = Depends(get_session)) -> TokenResponse:
    now = utcnow()
    code_record = session.exec(
        select(PhoneCode)
        .where(
            PhoneCode.phone == payload.phone,
            PhoneCode.consumed_at.is_(None),
            PhoneCode.expires_at > now,
        )
        .order_by(PhoneCode.created_at.desc())
    ).first()

    if code_record is None or code_record.code != payload.code:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Verification code is invalid.")

    code_record.consumed_at = now
    session.add(code_record)

    user = session.exec(select(User).where(User.phone == payload.phone)).first()
    if user is None:
        user = User(phone=payload.phone, display_name=payload.display_name)
        session.add(user)
    elif payload.display_name and payload.display_name != user.display_name:
        user.display_name = payload.display_name
        session.add(user)

    session.commit()
    session.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
