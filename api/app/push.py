"""Gửi thông báo đẩy qua Expo Push API — best-effort, KHÔNG bao giờ chặn luồng chính.
Lỗi mạng / token hỏng chỉ log rồi bỏ qua. Token do client (expo-notifications) gửi lên,
lưu ở User.push_token. Expo lo APNs (iOS) + FCM (Android) giùm, ta chỉ POST 1 endpoint."""
import logging

import httpx

log = logging.getLogger("mcup.push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _looks_like_expo_token(token: str | None) -> bool:
    return bool(token) and token.startswith(("ExponentPushToken[", "ExpoPushToken["))


async def send_push(token: str | None, title: str, body: str,
                    data: dict | None = None) -> bool:
    """Gửi 1 thông báo tới 1 thiết bị. Trả True nếu Expo nhận (không đảm bảo đã hiển thị)."""
    if not _looks_like_expo_token(token):
        return False
    payload = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
        "priority": "high",
        "channelId": "default",
    }
    if data:
        payload["data"] = data
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(EXPO_PUSH_URL, json=payload,
                                  headers={"Accept": "application/json",
                                           "Content-Type": "application/json"})
        if r.status_code >= 400:
            log.warning("Expo push HTTP %s: %s", r.status_code, r.text[:200])
            return False
        # Expo trả {"data":{"status":"ok"|"error", ...}}
        d = (r.json() or {}).get("data") or {}
        if d.get("status") == "error":
            log.warning("Expo push error: %s", d.get("message"))
            return False
        return True
    except Exception as exc:  # mạng lỗi / timeout — bỏ qua, không ảnh hưởng review
        log.warning("Gửi push lỗi (%s) → bỏ qua", exc)
        return False


# ===== Nhắc streak (A1): bắn 1 lần/ngày cho ai chưa luyện, có streak, sau 19h =====
async def streak_reminder_tick() -> int:
    """Quét user cần nhắc giữ chuỗi. Gọi định kỳ (scheduler trong lifespan).
    Trả số push đã gửi. Idempotent theo ngày qua Progress.streak_pinged_day."""
    from datetime import date
    from sqlalchemy import select
    from .db import SessionLocal
    from .models import Progress, User

    sent = 0
    async with SessionLocal() as s:
        today = date.today()
        rows = (await s.execute(
            select(Progress, User).join(User, User.id == Progress.user_id)
            .where(Progress.streak > 0,
                   Progress.last_day != today,          # chưa luyện hôm nay
                   Progress.streak_pinged_day != today, # chưa nhắc hôm nay
                   User.push_token.is_not(None)))).all()
        for prog, user in rows:
            ok = await send_push(
                user.push_token,
                f"Chuỗi {prog.streak} ngày sắp tắt! 🔥",
                "Luyện 1 bài ngắn thôi là giữ được lửa. Misa đang chờ bạn 🎤",
                data={"type": "streak"})
            prog.streak_pinged_day = today  # đánh dấu dù gửi lỗi — không spam lại trong ngày
            if ok:
                sent += 1
        await s.commit()
    if sent:
        log.info("Nhắc streak: đã gửi %d push", sent)
    return sent
