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
