"""ViettelAsr — AsrPort qua Viettel AI STT (chuyên tiếng Việt, 3 giọng vùng miền).

Cần VIETTEL_STT_TOKEN. Lưu ý: word-level timestamp không được ghi rõ trong
tài liệu công khai → nếu API không trả timestamp, ta tách từ theo transcript
(đếm từ đệm kém chính xác hơn — cần xác minh ở POC 3.1). Xem ENV-SETUP.md §3b.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class AsrResult:
    text: str
    words: list = field(default_factory=list)


class ViettelAsr:
    is_mock = False
    ENDPOINT = "https://viettelgroup.ai/voice/api/asr/v1/rest/decode_file"

    def __init__(self, token: str):
        self.token = token

    async def transcribe(self, audio_path: str, language: str = "vi") -> AsrResult:
        import httpx

        with open(audio_path, "rb") as f:
            files = {"file": f}
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(self.ENDPOINT, headers={"token": self.token}, files=files)
                r.raise_for_status()
                data = r.json()

        # Chuẩn hóa: lấy transcript, ưu tiên timestamp nếu có.
        text = data.get("result", {}).get("hypotheses", [{}])[0].get("transcript") \
            if isinstance(data.get("result"), dict) else data.get("transcript", "")
        text = text or ""
        words = [{"word": w, "start": 0.0, "end": 0.0} for w in text.split()]  # fallback không timestamp
        return AsrResult(text=text, words=words)
