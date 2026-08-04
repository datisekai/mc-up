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

import logging
import re
from dataclasses import dataclass, field

log = logging.getLogger("mcup.asr")

# Mồi tiếng Việt: (1) neo NGÔN NGỮ + từ vựng nghề MC → giảm nhận sai & chèn từ tiếng Anh vô cớ,
# (2) giữ tiếng đệm thay vì làm sạch (FR-12).
_FILLER_PROMPT = (
    "Xin chào quý vị và các bạn, chào mừng đến với chương trình. Ừm, à, ờ, ừ thì, kiểu như là... "
    "Bản ghi tiếng Việt, giữ nguyên tiếng đệm khi nói. Sân khấu, tiệc cưới, cô dâu chú rể, "
    "quan khách, sự kiện, gala, khán giả, tiết mục, phần thi, thí sinh."
)


# Câu META trong prompt — KHÔNG học viên nào nói câu này ngoài đời. Nó xuất hiện trong
# transcript = chắc chắn model đang nhả ngược prompt.
_META_MARK = "bản ghi tiếng việt giữ nguyên tiếng đệm khi nói"
# Danh sách từ vựng ở ĐUÔI prompt — đọc ra một lượt gần hết = đang nhả prompt, không phải nói thật
_TAIL_VOCAB = ("sân khấu", "tiệc cưới", "cô dâu", "chú rể", "quan khách",
               "sự kiện", "gala", "khán giả", "tiết mục", "phần thi", "thí sinh")
_PUNCT = re.compile(r"[.,!?;:…“”\"'`()\[\]\-–—]")


def _toks(s: str) -> list[str]:
    return _PUNCT.sub(" ", (s or "").lower()).split()


def _is_prompt_echo(text: str) -> bool:
    """Model NHẢ NGƯỢC prompt thành transcript — xảy ra khi audio khó nghe/lí nhí.

    NGUY HIỂM (bug thật, phát hiện 2026-08-04): prompt chứa lời chào MC hoàn chỉnh +
    danh sách từ vựng nghề (cô dâu, chú rể, quan khách, tiệc cưới...). Nếu để lọt,
    lưới `_looks_unclear` không bắt (52 từ, không dính marker hallucination cũ) và bộ
    chấm 'đủ ý' nhìn thấy toàn từ khoá đúng chủ đề → chấm ĐẠT cho bài học viên thực ra
    nói không nghe ra gì. Đây chính là 'đọc dở mà vẫn đánh giá cao'.

    Bắt được → trả text rỗng để pipeline rơi vào nhánh 'chưa nghe rõ, thử lại' (đúng UX
    đã có sẵn), thay vì chấm bừa.
    """
    toks = _toks(text)
    if len(toks) < 10:  # quá ngắn thì đã có lưới 'ít hơn 3 từ' lo
        return False
    joined = " ".join(toks)

    # (1) Câu meta — bằng chứng chắc chắn nhất.
    if _META_MARK in joined:
        return True

    # (2) Đọc ê a gần hết DANH SÁCH từ vựng ở đuôi prompt. Học viên kể chuyện thật có
    # thể dùng vài từ này (bài đám cưới hay có 'cô dâu chú rể, quan khách'), nhưng
    # không ai liệt kê một lượt gala + thí sinh + tiết mục + tiệc cưới + sân khấu...
    if sum(1 for kw in _TAIL_VOCAB if kw in joined) >= 6:
        return True

    # (3) Bài DÀI mà gần như mọi từ đều lấy từ prompt. Ngưỡng độ dài để không bắt nhầm
    # lời chào MC ngắn (vốn trùng đầu prompt) — đó là câu học viên nói thật rất nhiều.
    if len(toks) < 25:
        return False
    pool = set(_toks(_FILLER_PROMPT))
    return sum(1 for t in toks if t in pool) / len(toks) >= 0.9


@dataclass
class AsrResult:
    text: str
    words: list = field(default_factory=list)  # [{"word","start","end"}]


class WhisperAsr:
    is_mock = False

    def __init__(self, api_key: str, model: str = "gpt-4o-mini-transcribe"):
        self.api_key = api_key
        self.model = model

    async def transcribe(self, audio_path: str, language: str = "vi") -> AsrResult:
        try:
            return await self._call(audio_path, language, self.model)
        except Exception:
            if self.model == "whisper-1":
                raise
            # model mới lỗi (quota/khả dụng) → lùi về whisper-1, không chặn user
            return await self._call(audio_path, language, "whisper-1")

    async def _call(self, audio_path: str, language: str, model: str) -> AsrResult:
        from openai import AsyncOpenAI  # import tại chỗ để demo không cần lib khi chưa dùng

        client = AsyncOpenAI(api_key=self.api_key, timeout=45.0)  # timeout: call treo không giữ slot chấm mãi
        with open(audio_path, "rb") as f:  # raise FileNotFoundError nếu chưa có clip thật
            if model == "whisper-1":
                resp = await client.audio.transcriptions.create(
                    model=model, file=f, language=language,
                    prompt=_FILLER_PROMPT,  # FR-12: giữ 'ừm/à/ờ' thay vì làm sạch
                    response_format="verbose_json",
                    timestamp_granularities=["word"],
                    temperature=0.0,  # giảm hallucination khi audio nhỏ/im lặng
                )
                words = [{"word": w.word, "start": w.start, "end": w.end} for w in (resp.words or [])]
                return self._guard(resp.text, words)
            # gpt-4o-(mini-)transcribe: WER tiếng Việt tốt hơn hẳn whisper-1 nhưng KHÔNG
            # trả word-timestamps → words=[]; scoring tự suy words giả từ text.
            resp = await client.audio.transcriptions.create(
                model=model, file=f, language=language,
                prompt=_FILLER_PROMPT,
                response_format="json",
                temperature=0.0,
            )
            return self._guard(resp.text, [])

    @staticmethod
    def _guard(text: str, words: list) -> AsrResult:
        """Chặn prompt-echo trước khi nó ra khỏi adapter (xem _is_prompt_echo)."""
        if _is_prompt_echo(text):
            log.warning("ASR nhả ngược prompt (audio khó nghe) → coi như chưa nghe rõ: %r", (text or "")[:80])
            return AsrResult(text="", words=[])
        return AsrResult(text=text, words=words)
