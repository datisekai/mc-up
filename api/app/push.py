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


# ===== Push giữ chân (A1 + V5-4): streak · comeback · giải đấu reset =====
async def retention_tick() -> int:
    """Quét & gửi push giữ chân. Gọi định kỳ (scheduler trong lifespan), giờ tối.
    - Streak: chưa luyện hôm nay + có streak → 'chuỗi sắp tắt' (guard streak_pinged_day).
    - Comeback: vắng ≥3 ngày → 'Misa nhớ bạn' (guard last_nudge_day, tối đa 1 nudge/ngày).
    - Giải đấu reset: tối Chủ nhật → 'giải đấu sắp reset, leo hạng đi' (guard last_nudge_day).
    Trả tổng số push đã gửi."""
    from datetime import date, timedelta
    from sqlalchemy import select
    from .db import SessionLocal
    from .models import Progress, User

    sent = 0
    today = date.today()
    is_sunday = today.weekday() == 6
    async with SessionLocal() as s:
        rows = (await s.execute(
            select(Progress, User).join(User, User.id == Progress.user_id)
            .where(User.push_token.is_not(None), User.role == "hoc_vien"))).all()
        for prog, user in rows:
            practiced_today = prog.last_day == today
            # 1) Nhắc streak (ưu tiên cao nhất, guard riêng)
            if prog.streak > 0 and not practiced_today and prog.streak_pinged_day != today:
                if await send_push(user.push_token, f"Chuỗi {prog.streak} ngày sắp tắt! 🔥",
                                   "Luyện 1 bài ngắn thôi là giữ được lửa. Misa đang chờ bạn 🎤",
                                   data={"type": "streak"}):
                    sent += 1
                prog.streak_pinged_day = today
                continue  # 1 người tối đa 1 push/tối
            # 2) các nudge khác — tối đa 1/ngày
            if prog.last_nudge_day == today or practiced_today:
                continue
            gap = (today - prog.last_day).days if prog.last_day else 999
            if gap >= 3:  # comeback — vắng lâu
                if await send_push(user.push_token, "Misa nhớ bạn lắm! 🥺",
                                   "Lâu rồi chưa gặp — quay lại luyện 1 bài cho ấm giọng nhé?",
                                   data={"type": "comeback"}):
                    sent += 1
                prog.last_nudge_day = today
            elif is_sunday and prog.league_xp > 0:  # giải đấu sắp reset tối CN
                if await send_push(user.push_token, "Giải đấu sắp khép lại! 🏆",
                                   "Luyện thêm vài bài tối nay để giữ/leo hạng trước khi reset nhé.",
                                   data={"type": "league"}):
                    sent += 1
                prog.last_nudge_day = today
        await s.commit()
    if sent:
        log.info("Push giữ chân: đã gửi %d", sent)
    return sent


# giữ tên cũ cho tương thích
async def streak_reminder_tick() -> int:
    return await retention_tick()
