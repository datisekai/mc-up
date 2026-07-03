"""Chấm phần Xác (AD-5).

ASR chọn qua factory (AD-2): có OPENAI_API_KEY → Whisper thật; rỗng → giả lập.
Nếu Whisper lỗi (vd chưa có file clip thật — Story 3.2) thì tự lùi về giả lập
để pipeline không vỡ; kết quả đánh dấu is_mock=True khi dùng giả lập.

Âm lượng: MVP giả lập (thật = RMS on-device/worker).
Tốc độ:  words / duration * 60 (công thức thật).
Từ đệm:  đếm 'ừm/à/ờ' trên transcript — Whisper hay BỎ fillers → cần POC 3.1.
"""
import logging
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[3] / "mcup"))

from .config import settings  # noqa: E402

log = logging.getLogger("mcup.scoring")
FILLERS = {"ừm", "à", "ờ", "ơ", "ừ"}


def _volume_label(seed: str) -> str:
    return ["tốt", "hơi nhỏ", "hơi to"][sum(map(ord, seed)) % 3]


async def score_clip(clip_id: str, duration_seconds: float, audio_path: str | None = None):
    from adapters.asr_factory import get_asr  # type: ignore
    from adapters.asr_mock import MockAsr  # type: ignore

    asr = get_asr(
        settings.asr_provider,
        openai_key=settings.openai_api_key,
        google_key=settings.google_stt_api_key,
        viettel_token=settings.viettel_stt_token,
    )
    path = audio_path or f"clip://{clip_id}"  # clip thật đến từ MediaStore (Story 3.2)
    try:
        result = await asr.transcribe(audio_path=path, language="vi")
        used_mock = getattr(asr, "is_mock", False)
    except Exception as exc:  # vd chưa có file clip thật → lùi về giả lập
        log.warning("ASR thật lỗi (%s) → dùng giả lập", exc)
        result = await MockAsr().transcribe(audio_path=path, language="vi")
        used_mock = True

    words = result.words
    wpm = round(len(words) / max(duration_seconds, 1) * 60, 1)
    filler = sum(1 for w in words if w["word"].lower().strip() in FILLERS)

    if wpm > 160:
        tip = "Thử chậm lại một nhịp ở câu mở đầu nhé 👏"
    elif filler >= 2:
        tip = "Bạn đang tiến bộ — để ý bớt từ đệm 'ừm/à' một chút nha!"
    else:
        tip = "Giữ nhịp tốt lắm, tiếp tục nào!"

    return {
        "volume_label": _volume_label(clip_id),
        "speed_wpm": wpm,
        "filler_count": filler,
        "tip": tip,
        "is_mock": used_mock,
    }
