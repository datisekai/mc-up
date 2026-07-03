from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..models import Progress, User
from ..schemas import LoginIn, RegisterIn, TokenOut
from ..security import hash_password, make_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


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


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, session: AsyncSession = Depends(get_session)):
    user = (await session.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, {"error": {"code": "bad_credentials", "message": "Sai email hoặc mật khẩu"}})
    return TokenOut(access_token=make_token(user.id, user.role), role=user.role)
