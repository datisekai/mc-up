"""Chấm phần Xác (AD-5).

ASR chọn qua factory (AD-2): có OPENAI_API_KEY → Whisper thật; rỗng → giả lập.
Nếu Whisper lỗi (vd chưa có file clip thật — Story 3.2) thì tự lùi về giả lập
để pipeline không vỡ; kết quả đánh dấu is_mock=True khi dùng giả lập.

Âm lượng: MVP giả lập (thật = RMS on-device/worker).
Tốc độ:  words / duration * 60 (công thức thật).
Từ đệm:  đếm 'ừm/à/ờ' trên transcript — Whisper hay BỎ fillers → cần POC 3.1.
"""
import array
import logging
import math
import os
import subprocess

from .config import settings

log = logging.getLogger("mcup.scoring")
FILLERS = {"ừm", "à", "ờ", "ơ", "ừ"}


def _volume_label(seed: str) -> str:
    return ["tốt", "hơi nhỏ", "hơi to"][sum(map(ord, seed)) % 3]


def _rms_volume(audio_path: str) -> str | None:
    """Âm lượng THẬT (FR-13): giải mã audio qua ffmpeg → PCM → RMS → dBFS → nhãn."""
    try:
        pcm = subprocess.run(
            ["ffmpeg", "-v", "quiet", "-i", audio_path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
            capture_output=True, timeout=30,
        ).stdout
        if len(pcm) < 400:
            return None
        s = array.array("h")
        s.frombytes(pcm[: len(pcm) - (len(pcm) % 2)])
        if not s:
            return None
        rms = math.sqrt(sum(v * v for v in s) / len(s))
        dbfs = 20 * math.log10(rms / 32768) if rms > 0 else -90
        if dbfs < -32:
            return "hơi nhỏ"
        if dbfs > -12:
            return "hơi to"
        return "tốt"
    except Exception as exc:
        log.warning("RMS âm lượng lỗi (%s) → giả lập", exc)
        return None


def _wpm(words: list, duration_seconds: float) -> float:
    """Tốc độ THẬT (FR-14): tính theo thời gian NÓI (span timestamp), trừ im lặng đầu/cuối."""
    if len(words) >= 2 and isinstance(words[0], dict) and "start" in words[0] and "end" in words[-1]:
        span = words[-1]["end"] - words[0]["start"]
        if span > 0.5:
            return round(len(words) / span * 60, 1)
    return round(len(words) / max(duration_seconds, 1) * 60, 1)


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
    wpm = _wpm(words, duration_seconds)  # FR-14: theo thời gian nói thực
    filler = sum(1 for w in words if w["word"].lower().strip() in FILLERS)
    real_vol = _rms_volume(path) if (path and os.path.exists(path)) else None  # FR-13: RMS thật

    if wpm > 160:
        tip = "Thử chậm lại một nhịp ở câu mở đầu nhé 👏"
    elif filler >= 2:
        tip = "Bạn đang tiến bộ — để ý bớt từ đệm 'ừm/à' một chút nha!"
    else:
        tip = "Giữ nhịp tốt lắm, tiếp tục nào!"

    return {
        "volume_label": real_vol or _volume_label(clip_id),  # thật nếu đo được, không thì giả lập
        "speed_wpm": wpm,
        "filler_count": filler,
        "tip": tip,
        "is_mock": used_mock,
    }
