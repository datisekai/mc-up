"""OpenAISplitter — hiện thực ContentSplitPort bằng LLM (AD-10, AI thứ 2).

Nhận tài liệu giáo trình thô → trả cây Buổi → Bài → Đề (JSON) NHÁP.
Output luôn là draft; phải qua admin duyệt trước khi publish (AD-12).
"""
from __future__ import annotations

import json

_SYS = (
    "Bạn là trợ lý thiết kế giáo trình luyện nói/MC tiếng Việt. "
    "Nhận một tài liệu thô, hãy chia thành các BUỔI học; mỗi buổi gồm vài BÀI; "
    "mỗi bài có 'tip' (mẹo ngắn ≤1 câu) và 'prompt' (đề thực hành để học viên quay clip nói). "
    "Trả về DUY NHẤT JSON hợp lệ dạng: "
    '{"sessions":[{"title":"...","lessons":[{"title":"...","tip":"...","prompt":"..."}]}]}. '
    "Tiếng Việt tự nhiên, bám sát nội dung tài liệu, không bịa quá xa."
)


class OpenAISplitter:
    is_mock = False

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.model = model

    async def split(self, raw_text: str, genre: str = "kỹ năng nói") -> dict:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self.api_key)
        resp = await client.chat.completions.create(
            model=self.model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SYS},
                {"role": "user", "content": f"Thể loại: {genre}\n\nTÀI LIỆU:\n{raw_text[:8000]}"},
            ],
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        data["is_mock"] = False
        return data
