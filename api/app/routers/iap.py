"""In-App Purchase Pro qua RevenueCat.

Hai đường vào, BỔ SUNG cho nhau:
  1. POST /iap/refresh          — client gọi sau khi mua/khôi phục. Backend GỌI NGƯỢC
                                   RevenueCat REST để XÁC MINH entitlement (không tin client mù quáng).
  2. POST /iap/revenuecat/hook  — RevenueCat gọi ta khi có sự kiện (gia hạn, hết hạn...).
                                   Nguồn sự thật lâu dài; cần server public (domain) + token.

App_user_id ở RevenueCat = McUp user.id (client set khi configure) → nối mua với tài khoản.
Nếu chưa cấu hình secret key → endpoint trả ok=False, KHÔNG lỗi (Pro vẫn bật tay qua admin được)."""
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session
from ..deps import current_user
from ..models import User

log = logging.getLogger("mcup.iap")
router = APIRouter(prefix="/iap", tags=["iap"])

RC_BASE = "https://api.revenuecat.com/v1"

# Sự kiện RC làm Pro BẬT / TẮT
GRANT = {"INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE",
         "NON_RENEWING_PURCHASE", "SUBSCRIPTION_EXTENDED"}
REVOKE = {"EXPIRATION"}  # CANCELLATION = tắt tự gia hạn, VẪN dùng tới hết hạn → không revoke ngay


def _entitlement_active(subscriber: dict) -> bool:
    """True nếu entitlement Pro còn hiệu lực (expires_date null = vĩnh viễn, hoặc > bây giờ)."""
    ent = (subscriber or {}).get("entitlements") or {}
    e = ent.get(settings.revenuecat_entitlement)
    if not e:
        return False
    exp = e.get("expires_date")
    if not exp:
        return True  # lifetime / non-expiring
    try:
        dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        return dt > datetime.now(timezone.utc)
    except Exception:
        return True  # không parse được → coi như còn hạn (an toàn cho người mua)


async def _set_pro(session: AsyncSession, user: User, active: bool, source: str) -> None:
    # Không đụng Pro do admin cấp tay (pro_source=admin) — chỉ quản Pro từ IAP.
    if user.pro_source == "admin":
        return
    user.is_pro = active
    user.pro_source = source if active else None
    await session.commit()


@router.post("/refresh")
async def refresh_entitlement(user: User = Depends(current_user),
                              session: AsyncSession = Depends(get_session)):
    """Client gọi sau khi mua/khôi phục. Backend hỏi RC 'user này có Pro không?' rồi cập nhật."""
    if not settings.revenuecat_secret_key:
        return {"ok": False, "reason": "iap_chua_cau_hinh", "is_pro": user.is_pro}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{RC_BASE}/subscribers/{user.id}",
                headers={"Authorization": f"Bearer {settings.revenuecat_secret_key}"},
            )
        if r.status_code >= 400:
            log.warning("RC subscribers HTTP %s: %s", r.status_code, r.text[:200])
            return {"ok": False, "reason": "rc_loi", "is_pro": user.is_pro}
        sub = (r.json() or {}).get("subscriber") or {}
        active = _entitlement_active(sub)
        db_user = await session.get(User, user.id)
        await _set_pro(session, db_user, active, "iap")
        return {"ok": True, "is_pro": db_user.is_pro}
    except Exception as exc:
        log.warning("refresh entitlement lỗi (%s)", exc)
        return {"ok": False, "reason": "mang_loi", "is_pro": user.is_pro}


@router.post("/revenuecat/hook")
async def revenuecat_webhook(request: Request,
                             authorization: str | None = Header(default=None),
                             session: AsyncSession = Depends(get_session)):
    """RevenueCat → ta. Xác thực bằng Authorization header trùng REVENUECAT_WEBHOOK_TOKEN."""
    expected = settings.revenuecat_webhook_token
    if expected:
        if authorization not in (expected, f"Bearer {expected}"):
            raise HTTPException(401, {"error": {"code": "bad_auth", "message": "unauthorized"}})
    body = await request.json()
    event = (body or {}).get("event") or {}
    etype = event.get("type")
    app_user_id = event.get("app_user_id")
    if not app_user_id:
        return {"ok": True}  # sự kiện không gắn user → bỏ qua êm
    user = await session.get(User, app_user_id)
    if not user:
        log.info("RC webhook: user %s không tồn tại (có thể id ẩn danh) — bỏ qua", app_user_id)
        return {"ok": True}
    if etype in GRANT:
        await _set_pro(session, user, True, "iap")
    elif etype in REVOKE:
        await _set_pro(session, user, False, "iap")
    # các loại khác (CANCELLATION, BILLING_ISSUE, TEST...) không đổi trạng thái ngay
    return {"ok": True}
