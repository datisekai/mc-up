"""MockSplitter — ContentSplitPort giả lập (chạy offline không cần key)."""
from __future__ import annotations


class MockSplitter:
    is_mock = True

    async def split(self, raw_text: str, genre: str = "kỹ năng nói") -> dict:
        head = (raw_text.strip().split("\n", 1)[0] or "Nội dung")[:40]
        return {
            "is_mock": True,
            "sessions": [
                {"title": f"Buổi 1 · {head}", "lessons": [
                    {"title": "Bài mở đầu", "tip": "Chia nhỏ nội dung, luyện từng phần.",
                     "prompt": f"Nói 1 phút giới thiệu về: {head}"},
                ]},
            ],
        }
