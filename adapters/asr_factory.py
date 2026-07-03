"""Chọn adapter ASR theo cấu hình (AD-2) — đa nhà cung cấp.

provider:
  auto    → ưu tiên GIỮ-FILLER cho tiếng Việt (FR-12): viettel > google > whisper,
            không có key nào thì mock. Thêm key Viettel/Google là tự nâng cấp.
  mock    → luôn giả lập
  whisper → OpenAI Whisper (cần openai_key)
  google  → Google Cloud STT vi-VN (cần google_key)
  viettel → Viettel AI STT (cần viettel_token)

Domain/pipeline chỉ gọi get_asr(...); không biết adapter cụ thể.
"""
from __future__ import annotations


def get_asr(provider: str = "auto", *, openai_key: str = "",
            google_key: str = "", viettel_token: str = ""):
    provider = (provider or "auto").lower()

    if provider == "auto":  # xếp theo độ giữ tiếng đệm tiếng Việt (FR-12)
        if viettel_token:
            provider = "viettel"
        elif google_key:
            provider = "google"
        elif openai_key:
            provider = "whisper"
        else:
            provider = "mock"

    if provider == "whisper" and openai_key:
        from .asr_whisper import WhisperAsr
        return WhisperAsr(openai_key)
    if provider == "google" and google_key:
        from .asr_google import GoogleAsr
        return GoogleAsr(google_key)
    if provider == "viettel" and viettel_token:
        from .asr_viettel import ViettelAsr
        return ViettelAsr(viettel_token)

    from .asr_mock import MockAsr
    return MockAsr()
