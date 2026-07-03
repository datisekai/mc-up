"""GoogleAsr — AsrPort qua Google Cloud Speech-to-Text (vi-VN).

Ưu điểm cho McUp: hỗ trợ tiếng Việt tốt, GIỮ nhiều từ đệm hơn Whisper, có
word timestamps (enableWordTimeOffsets) → hợp để đếm 'ừm/à' ở POC 3.1.
Cần GOOGLE_STT_API_KEY. Xem mcup/ENV-SETUP.md §3b.
"""
from __future__ import annotations

import base64
from dataclasses import dataclass, field


@dataclass
class AsrResult:
    text: str
    words: list = field(default_factory=list)


def _sec(t: str | None) -> float:
    # Google trả "1.200s"
    if not t:
        return 0.0
    return float(str(t).rstrip("s"))


class GoogleAsr:
    is_mock = False

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def transcribe(self, audio_path: str, language: str = "vi") -> AsrResult:
        import httpx

        with open(audio_path, "rb") as f:
            content = base64.b64encode(f.read()).decode()

        payload = {
            "config": {
                "languageCode": "vi-VN",
                "enableWordTimeOffsets": True,
                "enableAutomaticPunctuation": True,
                # encoding/sampleRate: để Google tự dò với ENCODING_UNSPECIFIED cho file phổ biến
            },
            "audio": {"content": content},
        }
        url = f"https://speech.googleapis.com/v1/speech:recognize?key={self.api_key}"
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()

        text_parts, words = [], []
        for res in data.get("results", []):
            alt = (res.get("alternatives") or [{}])[0]
            text_parts.append(alt.get("transcript", ""))
            for w in alt.get("words", []):
                words.append({"word": w.get("word", ""),
                              "start": _sec(w.get("startTime")), "end": _sec(w.get("endTime"))})
        return AsrResult(text=" ".join(text_parts).strip(), words=words)
