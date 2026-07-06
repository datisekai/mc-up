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
import re
import subprocess

from .config import settings

log = logging.getLogger("mcup.scoring")

# Từ đệm/ngập ngừng tiếng Việt (FR-12). Whisper hay BỎ chúng → (1) adapter bias
# prompt để giữ lại, (2) ở đây chuẩn hóa co giãn "ừmmm"→"ừm" và bỏ dấu câu bám
# quanh token trước khi khớp, nên "À," / "ừmmm" / "Ờ." đều đếm đúng.
FILLERS = {"ừm", "à", "ờ", "ơ", "ừ", "ừa", "hử", "hửm", "ậm", "ầy"}

# Whisper HALLUCINATION khi audio im lặng/quá nhỏ: bịa câu outro YouTube tiếng Việt.
# Gặp các cụm này trong bản chấm ngắn → coi là "chưa nghe rõ", KHÔNG chấm bừa
# (EXPERIENCE.md State Patterns: âm thanh không đủ → mời thu lại, giọng dịu).
_HALLUCINATION_MARKS = (
    "đăng ký kênh", "subscribe", "cảm ơn các bạn đã theo dõi", "cảm ơn đã xem",
    "hẹn gặp lại các bạn", "video tiếp theo", "video mới", "chúc các bạn xem video",
    "like và share", "ghiền mì gõ",
)


def _looks_unclear(text: str, words: list) -> bool:
    """Audio không đủ để tin: quá ít từ, hoặc dính câu outro hallucination kinh điển."""
    if len(words) < 3:
        return True
    low = (text or "").lower()
    return any(m in low for m in _HALLUCINATION_MARKS) and len(words) <= 25


def _norm_word(w: str) -> str:
    w = w.lower().strip().strip(".,!?;:…“”\"'`()[]-–—")
    return re.sub(r"(.)\1{2,}", r"\1", w)  # co giãn ký tự lặp ≥3: ừmmm→ừm, àaaa→à


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


async def score_clip(clip_id: str, duration_seconds: float, audio_path: str | None = None,
                     rubric: dict | None = None):
    from adapters.asr_factory import get_asr  # type: ignore
    from adapters.asr_mock import MockAsr  # type: ignore

    from .rubrics import CORE
    rb = rubric or CORE  # FR-15: rubric lõi + module theo thể loại

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
    real_vol = _rms_volume(path) if (path and os.path.exists(path)) else None  # FR-13: RMS thật

    # ASR thật nhưng nghe không ra (im lặng/quá nhỏ → Whisper hay bịa) → KHÔNG chấm bừa
    if not used_mock and _looks_unclear(result.text, words):
        log.warning("ASR không tin được (hallucination/quá ít từ): %r → mời thu lại", (result.text or "")[:80])
        return {
            "volume_label": real_vol or "hơi nhỏ",
            "speed_wpm": 0.0,
            "filler_count": 0,
            "tip": "Mình chưa nghe rõ giọng bạn — thử lại gần mic hơn, nói to rõ một chút nhé? 🎙",
            "is_mock": False,
            "transcript": None,  # tuyệt đối không hiện câu Whisper bịa
        }

    wpm = _wpm(words, duration_seconds)  # FR-14: theo thời gian nói thực
    filler = sum(1 for w in words if _norm_word(w["word"]) in FILLERS)  # FR-12: bền với co giãn/dấu câu

    tips = rb["tips"]  # gợi ý theo thể loại (FR-15)
    if wpm > rb["wpm_max"]:
        tip = tips["fast"]
    elif wpm < rb["wpm_min"]:
        tip = tips["slow"]
    elif filler >= 2:
        tip = tips["filler"]
    else:
        tip = tips["good"]

    return {
        "volume_label": real_vol or _volume_label(clip_id),  # thật nếu đo được, không thì giả lập
        "speed_wpm": wpm,
        "filler_count": filler,
        "tip": tip,
        "is_mock": used_mock,
        # transcript CHỈ khi ASR thật — hiện text giả lập là phá niềm tin
        "transcript": ((result.text or "").strip() or None) if not used_mock else None,
    }
