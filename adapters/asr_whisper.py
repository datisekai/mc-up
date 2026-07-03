"""WhisperAsr — hiện thực AsrPort bằng OpenAI Whisper API (AD-2).

Cần OPENAI_API_KEY và một file audio thật (clip đã upload — Story 3.2).
Domain KHÔNG biết đây là Whisper; đổi sang PhoWhisper/Google chỉ là viết
adapter khác cùng interface.

⚠️ Whisper thường BỎ từ đệm ("ừm/à/ờ") khỏi transcript → phần đếm từ đệm
   cần xử lý riêng (POC Story 3.1). Xem mcup/ENV-SETUP.md §3.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class AsrResult:
    text: str
    words: list = field(default_factory=list)  # [{"word","start","end"}]


class WhisperAsr:
    is_mock = False

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def transcribe(self, audio_path: str, language: str = "vi") -> AsrResult:
        from openai import AsyncOpenAI  # import tại chỗ để demo không cần lib khi chưa dùng

        client = AsyncOpenAI(api_key=self.api_key)
        with open(audio_path, "rb") as f:  # raise FileNotFoundError nếu chưa có clip thật
            resp = await client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language=language,
                response_format="verbose_json",
                timestamp_granularities=["word"],
            )
        words = [{"word": w.word, "start": w.start, "end": w.end} for w in (resp.words or [])]
        return AsrResult(text=resp.text, words=words)
