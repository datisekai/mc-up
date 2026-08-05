"""GoogleAsr — AsrPort qua Google Cloud Speech-to-Text (vi-VN).

Ưu điểm cho McUp: hỗ trợ tiếng Việt tốt, GIỮ nhiều từ đệm hơn Whisper, có
word timestamps (enableWordTimeOffsets) → tín hiệu Nhịp nói (V9-1) hoạt động.
Cần GOOGLE_STT_API_KEY. Xem mcup/ENV-SETUP.md §3b.

⚠️ ĐỊNH DẠNG (bug 2026-08-05): app upload .m4a (AAC) nhưng Speech API v1 KHÔNG
tự dò được AAC → 400 Bad Request → pipeline lặng lẽ rơi về chấm giả lập. Fix:
transcode qua ffmpeg (đã có sẵn trong image cho RMS) sang FLAC 16kHz mono rồi
mới gửi — lossless, nhỏ hơn WAV ~3 lần, Google khuyến nghị.

⚠️ THỜI LƯỢNG: `speech:recognize` (sync) chỉ nhận ≤60s. Bài luyện không có trần
cứng (TARGET_SEC=60 chỉ là mốc gợi ý) → bài dài dùng `speech:longrunningrecognize`
+ poll operation. FLAC 16k mono 90s ≈ 1.5MB, thoải mái dưới trần 10MB inline.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import subprocess
from dataclasses import dataclass, field

log = logging.getLogger("mcup.asr")

_SYNC_MAX_SEC = 55.0   # dưới trần 60s của sync API một khoảng an toàn
_LRO_POLL_SEC = 2.0    # chu kỳ poll operation
_LRO_TIMEOUT_SEC = 120.0


@dataclass
class AsrResult:
    text: str
    words: list = field(default_factory=list)


def _sec(t: str | None) -> float:
    # Google trả "1.200s"
    if not t:
        return 0.0
    return float(str(t).rstrip("s"))


def _to_flac(audio_path: str) -> tuple[bytes, float]:
    """m4a/bất kỳ → FLAC 16kHz mono (bytes) + thời lượng (giây). Chạy trong thread."""
    flac = subprocess.run(
        ["ffmpeg", "-v", "quiet", "-i", audio_path, "-ac", "1", "-ar", "16000", "-f", "flac", "-"],
        capture_output=True, timeout=60,
    ).stdout
    if len(flac) < 400:
        raise RuntimeError(f"ffmpeg không decode được audio ({audio_path})")
    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", audio_path],
        capture_output=True, timeout=30, text=True,
    ).stdout.strip()
    try:
        duration = float(probe)
    except ValueError:
        duration = 0.0  # không đọc được → coi như ngắn, đi nhánh sync
    return flac, duration


class GoogleAsr:
    is_mock = False

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def transcribe(self, audio_path: str, language: str = "vi") -> AsrResult:
        import httpx

        # ffmpeg là subprocess chặn → thread, không nghẽn event loop khi nhiều user
        flac, duration = await asyncio.to_thread(_to_flac, audio_path)
        payload = {
            "config": {
                "languageCode": "vi-VN",
                "encoding": "FLAC",
                "sampleRateHertz": 16000,
                "audioChannelCount": 1,
                "enableWordTimeOffsets": True,
                "enableAutomaticPunctuation": True,
            },
            "audio": {"content": base64.b64encode(flac).decode()},
        }

        async with httpx.AsyncClient(timeout=90) as client:
            if duration <= _SYNC_MAX_SEC:
                r = await client.post(
                    f"https://speech.googleapis.com/v1/speech:recognize?key={self.api_key}",
                    json=payload)
                r.raise_for_status()
                data = r.json()
            else:
                # Bài dài: tạo operation rồi poll tới khi xong
                r = await client.post(
                    f"https://speech.googleapis.com/v1/speech:longrunningrecognize?key={self.api_key}",
                    json=payload)
                r.raise_for_status()
                op = r.json()["name"]
                waited = 0.0
                while True:
                    await asyncio.sleep(_LRO_POLL_SEC)
                    waited += _LRO_POLL_SEC
                    r = await client.get(
                        f"https://speech.googleapis.com/v1/operations/{op}?key={self.api_key}")
                    r.raise_for_status()
                    body = r.json()
                    if body.get("done"):
                        if "error" in body:
                            raise RuntimeError(f"Google LRO lỗi: {body['error']}")
                        data = body.get("response", {})
                        break
                    if waited >= _LRO_TIMEOUT_SEC:
                        raise TimeoutError(f"Google LRO quá {_LRO_TIMEOUT_SEC}s (bài {duration:.0f}s)")

        text_parts, words = [], []
        for res in data.get("results", []):
            alt = (res.get("alternatives") or [{}])[0]
            text_parts.append(alt.get("transcript", ""))
            for w in alt.get("words", []):
                words.append({"word": w.get("word", ""),
                              "start": _sec(w.get("startTime")), "end": _sec(w.get("endTime"))})
        return AsrResult(text=" ".join(text_parts).strip(), words=words)
