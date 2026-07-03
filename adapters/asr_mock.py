"""MockAsr — hiện thực AsrPort để chạy offline không cần key (AD-2).

Trả về transcript + word timestamps giả lập, có vài từ đệm để pipeline
đếm được. Thay bằng adapter Whisper thật (asr_whisper.py) khi có key —
domain KHÔNG đổi.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class MockAsrResult:
    text: str
    words: list = field(default_factory=list)


class MockAsr:
    is_mock = True

    async def transcribe(self, audio_path: str, language: str = "vi") -> MockAsrResult:
        # Câu mẫu có 2 từ đệm ("ừm", "à") để minh họa đếm.
        tokens = ["Xin", "chào", "ừm", "tôi", "là", "MC", "à", "hôm", "nay"]
        words = [{"word": w, "start": i * 0.4, "end": i * 0.4 + 0.35} for i, w in enumerate(tokens)]
        return MockAsrResult(text=" ".join(tokens), words=words)
