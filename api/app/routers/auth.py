import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..deps import current_user
from ..models import Progress, User
from ..schemas import LoginIn, RegisterIn, TokenOut
from ..security import hash_password, make_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Khách trước, đăng ký sau (giá trị trước cam kết — phân tích Mary 2026-07-06).
# Nhận diện khách bằng domain email nội bộ — không cần đổi schema.
_GUEST_DOMAIN = "@guest.mcup"


@router.post("/register", response_model=TokenOut)
async def register(body: RegisterIn, session: AsyncSession = Depends(get_session)):
    exists = (await session.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if exists:
        raise HTTPException(409, {"error": {"code": "email_taken", "message": "Email đã được dùng"}})
    role = body.role if body.role in ("hoc_vien", "mc") else "hoc_vien"
    user = User(email=body.email, password_hash=hash_password(body.password),
                role=role, display_name=body.display_name)
    session.add(user)
    await session.flush()
    session.add(Progress(user_id=user.id))
    await session.commit()
    return TokenOut(access_token=make_token(user.id, user.role), role=user.role)


@router.post("/guest", response_model=TokenOut)
async def guest(session: AsyncSession = Depends(get_session)):
    """Tạo tài khoản khách ẩn danh — luyện ngay, không cần email/mật khẩu.
    password_hash rỗng → không thể login bằng mật khẩu; nâng cấp qua /auth/upgrade."""
    user = User(email=f"khach-{uuid.uuid4().hex[:10]}{_GUEST_DOMAIN}",
                password_hash="", role="hoc_vien", display_name="Khách")
    session.add(user)
    await session.flush()
    session.add(Progress(user_id=user.id))
    await session.commit()
    return TokenOut(access_token=make_token(user.id, user.role), role=user.role)


@router.post("/upgrade", response_model=TokenOut)
async def upgrade(body: RegisterIn, user: User = Depends(current_user),
                  session: AsyncSession = Depends(get_session)):
    """Nâng cấp khách → tài khoản thật. GIỮ NGUYÊN user_id → streak/XP/clip/vé không mất."""
    if not user.email.endswith(_GUEST_DOMAIN):
        raise HTTPException(400, {"error": {"code": "not_guest", "message": "Tài khoản đã đăng ký rồi"}})
    exists = (await session.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if exists:
        raise HTTPException(409, {"error": {"code": "email_taken", "message": "Email đã được dùng"}})
    user.email = body.email
    user.password_hash = hash_password(body.password)
    if body.display_name:
        user.display_name = body.display_name
    await session.commit()
    return TokenOut(access_token=make_token(user.id, user.role), role=user.role)


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, session: AsyncSession = Depends(get_session)):
    user = (await session.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, {"error": {"code": "bad_credentials", "message": "Sai email hoặc mật khẩu"}})
    return TokenOut(access_token=make_token(user.id, user.role), role=user.role)
