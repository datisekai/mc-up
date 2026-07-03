"""Ports — AD-2: mọi phụ thuộc ngoài nằm sau interface.

Domain phụ thuộc các Protocol này, KHÔNG phụ thuộc adapter cụ thể.
Adapter (Whisper, MinIO/S3, Expo Push, RevenueCat...) hiện thực chúng ở `adapters/`
và được tiêm vào từ ngoài. Đổi vendor = viết adapter mới, không sửa domain.
"""
from __future__ import annotations

from typing import Protocol


class AsrPort(Protocol):
    """Chuyển giọng → chữ + word-level timestamps (Whisper hôm nay, PhoWhisper sau)."""
    async def transcribe(self, audio_path: str, language: str = "vi") -> "AsrResult": ...


class MediaStore(Protocol):
    """Lưu clip nhạy cảm (AD-4): trả URL có ký & hết hạn, không public trực tiếp."""
    async def put(self, key: str, data: bytes, content_type: str) -> None: ...
    async def signed_url(self, key: str, expires_seconds: int = 3600) -> str: ...


class PushPort(Protocol):
    """Gửi thông báo đẩy (Expo) — nhắc streak, 'MC đã nghe bạn dẫn'."""
    async def send(self, user_id: str, title: str, body: str) -> None: ...


class BillingPort(Protocol):
    """Thanh toán freemium (RevenueCat) — mua Vé Vàng, gói Super..."""
    async def verify_purchase(self, user_id: str, receipt: str) -> bool: ...


class AsrResult(Protocol):
    text: str
    words: list  # [{"word": str, "start": float, "end": float}]
