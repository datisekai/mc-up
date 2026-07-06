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
                     "prompt": f"Nói 1 phút giới thiệu về: {head}",
                     "brief": {
                         "objective": f"Tập nói mạch lạc 1 phút về: {head}.",
                         "context": "Bối cảnh giả lập (chưa cắm LLM thật) — admin sửa lại khi duyệt.",
                         "steps": ["Mở đầu nêu chủ đề", "2–3 ý chính", "Ví dụ ngắn", "Câu kết"],
                         "example": f"Xin chào, hôm nay mình xin chia sẻ về {head}. Đây là chủ đề mình thấy rất thú vị vì..."}},
                ]},
            ],
        }
