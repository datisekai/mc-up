"""WhisperAsr — hiện thực AsrPort bằng OpenAI Whisper API (AD-2).

Cần OPENAI_API_KEY và một file audio thật (clip đã upload — Story 3.2).
Domain KHÔNG biết đây là Whisper; đổi sang PhoWhisper/Google chỉ là viết
adapter khác cùng interface.

⚠️ Whisper hay BỎ từ đệm ("ừm/à/ờ"). Cách giảm thiểu KHÔNG cần đổi provider
   (FR-12): truyền `prompt` gợi phong cách có ngập ngừng → model thiên về GIỮ
   lại các tiếng đệm thay vì làm sạch. Không tuyệt đối; Google/Viettel giữ tốt
   hơn nên `auto` sẽ ưu tiên chúng khi có key. Xem mcup/ENV-SETUP.md §3.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# Mồi để Whisper KHÔNG lược bỏ tiếng đệm (bias từ vựng/phong cách).
_FILLER_PROMPT = "Ừm, à, ờ, ừ thì, ậm ừ, kiểu như là... Bản ghi giữ nguyên tiếng đệm khi nói."


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

        client = AsyncOpenAI(api_key=self.api_key, timeout=45.0)  # timeout: call treo không giữ slot chấm mãi
        with open(audio_path, "rb") as f:  # raise FileNotFoundError nếu chưa có clip thật
            resp = await client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language=language,
                prompt=_FILLER_PROMPT,  # FR-12: giữ 'ừm/à/ờ' thay vì làm sạch
                response_format="verbose_json",
                timestamp_granularities=["word"],
                temperature=0.0,  # giảm hallucination ("hãy đăng ký kênh...") khi audio nhỏ/im lặng
            )
        words = [{"word": w.word, "start": w.start, "end": w.end} for w in (resp.words or [])]
        return AsrResult(text=resp.text, words=words)
