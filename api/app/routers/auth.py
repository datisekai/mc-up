import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session
from ..deps import current_user
from ..models import Progress, User
from ..schemas import LoginIn, RegisterIn, TokenOut
from ..security import hash_password, make_token, verify_password
from ..services import utc_day_start

router = APIRouter(prefix="/auth", tags=["auth"])

# Khách trước, đăng ký sau (giá trị trước cam kết — phân tích Mary 2026-07-06).
# Nhận diện khách bằng domain email nội bộ — không cần đổi schema.
_GUEST_DOMAIN = "@guest.mcup"

# Chống farm tài khoản khách (beta hardening): đếm theo IP trong ngày (in-memory,
# đủ cho 1 process beta) + van tổng theo DB. Sau Caddy thì IP thật ở X-Forwarded-For.
_guest_ip: dict[str, tuple[str, int]] = {}


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "?"


def _check_password(pw: str):
    if len(pw or "") < 6:
        raise HTTPException(400, {"error": {"code": "weak_password", "message": "Mật khẩu cần ít nhất 6 ký tự."}})


@router.post("/register", response_model=TokenOut)
async def register(body: RegisterIn, session: AsyncSession = Depends(get_session)):
    _check_password(body.password)
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
async def guest(request: Request, session: AsyncSession = Depends(get_session)):
    """Tạo tài khoản khách ẩn danh — luyện ngay, không cần email/mật khẩu.
    password_hash rỗng → không thể login bằng mật khẩu; nâng cấp qua /auth/upgrade."""
    today = date.today().isoformat()
    ip = _client_ip(request)
    day, cnt = _guest_ip.get(ip, (today, 0))
    if day != today:
        cnt = 0
    if settings.guest_per_ip_daily > 0 and cnt >= settings.guest_per_ip_daily:
        raise HTTPException(429, {"error": {"code": "guest_limit",
            "message": "Bạn thử nhiều rồi đó — tạo tài khoản email để giữ tiến độ nhé!"}})
    if settings.guest_daily_total > 0:
        total = (await session.execute(select(func.count(User.id)).where(
            User.email.like(f"%{_GUEST_DOMAIN}"),
            User.created_at >= utc_day_start(date.today())))).scalar() or 0
        if total >= settings.guest_daily_total:
            raise HTTPException(429, {"error": {"code": "guest_limit",
                "message": "Hôm nay đông khách quá — đăng ký email để vào ngay nhé!"}})
    _guest_ip[ip] = (today, cnt + 1)
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
    _check_password(body.password)
    exists = (await session.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if exists:
        raise HTTPException(409, {"error": {"code": "email_taken", "message": "Email đã được dùng"}})
    user.email = body.email
    user.password_hash = hash_password(body.password)
    if body.display_name:
        user.display_name = body.display_name
    await session.commit()
    return TokenOut(access_token=make_token(user.id, user.role), role=user.role)


# Chống dò mật khẩu (brute-force): tối đa 5 lần sai / 15 phút cho mỗi cặp IP+email.
# In-memory — đủ cho 1 process; sang nhiều worker thì chuyển Redis.
_login_fail: dict[str, tuple[float, int]] = {}
_LOGIN_WINDOW_SEC = 900
_LOGIN_MAX_FAILS = 5


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, request: Request, session: AsyncSession = Depends(get_session)):
    import time

    key = f"{_client_ip(request)}|{body.email.strip().lower()}"
    now = time.time()
    first, fails = _login_fail.get(key, (now, 0))
    if now - first > _LOGIN_WINDOW_SEC:
        first, fails = now, 0
    if fails >= _LOGIN_MAX_FAILS:
        wait_min = max(1, int((_LOGIN_WINDOW_SEC - (now - first)) / 60))
        raise HTTPException(429, {"error": {"code": "too_many_attempts",
            "message": f"Sai quá nhiều lần — thử lại sau {wait_min} phút nhé."}})

    user = (await session.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        if len(_login_fail) > 10_000:  # dọn entry hết hạn, chặn phình bộ nhớ
            _login_fail_clean(now)
        _login_fail[key] = (first, fails + 1)
        raise HTTPException(401, {"error": {"code": "bad_credentials", "message": "Sai email hoặc mật khẩu"}})
    _login_fail.pop(key, None)
    return TokenOut(access_token=make_token(user.id, user.role), role=user.role)


def _login_fail_clean(now: float) -> None:
    for k in [k for k, (t, _) in _login_fail.items() if now - t > _LOGIN_WINDOW_SEC]:
        _login_fail.pop(k, None)
