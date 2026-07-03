from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .models import User
from .security import decode_token


async def current_user(
    authorization: str = Header(default=""),
    session: AsyncSession = Depends(get_session),
) -> User:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, {"error": {"code": "no_token", "message": "Thiếu token"}})
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(401, {"error": {"code": "bad_token", "message": "Token không hợp lệ"}})
    user = await session.get(User, payload["sub"])
    if not user:
        raise HTTPException(401, {"error": {"code": "no_user", "message": "Không tìm thấy người dùng"}})
    return user
