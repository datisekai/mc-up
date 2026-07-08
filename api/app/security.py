import hashlib
import hmac
import os
import time
from datetime import datetime, timedelta, timezone

import jwt

from .config import settings

_ALGO = "HS256"


# ===== URL ký cho media (clip/giọng) — chống truy cập trái phép file voice nhạy cảm =====
# Trước đây /media/{key} không xác thực → ai có link là nghe được. Giờ URL có chữ ký + hạn.
def sign_media(key: str, ttl: int = 7200) -> str:
    exp = int(time.time()) + ttl
    sig = hmac.new(settings.jwt_secret.encode(), f"{key}.{exp}".encode(), hashlib.sha256).hexdigest()[:24]
    return f"/media/{key}?e={exp}&s={sig}"


def verify_media(key: str, e: str, s: str) -> bool:
    try:
        if int(e) < int(time.time()):
            return False
    except Exception:
        return False
    expected = hmac.new(settings.jwt_secret.encode(), f"{key}.{e}".encode(), hashlib.sha256).hexdigest()[:24]
    return hmac.compare_digest(expected, s or "")


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return f"{salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 200_000)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


def make_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGO)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[_ALGO])
