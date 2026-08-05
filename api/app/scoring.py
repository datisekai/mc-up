"""Chấm phần Xác (AD-5).

ASR chọn qua factory (AD-2): có OPENAI_API_KEY → Whisper thật; rỗng → giả lập.
Nếu Whisper lỗi (vd chưa có file clip thật — Story 3.2) thì tự lùi về giả lập
để pipeline không vỡ; kết quả đánh dấu is_mock=True khi dùng giả lập.

Âm lượng: MVP giả lập (thật = RMS on-device/worker).
Tốc độ:  words / duration * 60 (công thức thật).
Từ đệm:  đếm 'ừm/à/ờ' trên transcript — Whisper hay BỎ fillers → cần POC 3.1.
"""
import array
import asyncio
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
# Gặp các cụm này → coi là "chưa nghe rõ", KHÔNG chấm bừa
# (EXPERIENCE.md State Patterns: âm thanh không đủ → mời thu lại, giọng dịu).

# Tầng 1 — tên kênh/cụm ĐẶC TRƯNG của hallucination: không người học nào nói thật
# → flag BẤT KỂ bài dài ngắn.
_HALLUCINATION_ALWAYS = (
    "lalaschool", "la la school", "ghiền mì gõ", "amara.org", "phụ đề bởi",
    "kênh của mình nhé", "kênh youtube của mình",
)
# Tầng 2 — câu outro phổ biến: người thật LUYỆN MC LIVESTREAM có thể nói thật
# trong bài dài → chỉ nghi khi bài NGẮN (≤25 từ, tức gần như cả clip chỉ có câu đó).
_HALLUCINATION_MARKS = (
    "đăng ký kênh", "đăng ký cho kênh", "ủng hộ kênh", "đừng quên đăng ký",
    "nhấn chuông", "bấm chuông", "subscribe",
    "cảm ơn các bạn đã theo dõi", "cảm ơn đã xem", "cảm ơn các bạn đã lắng nghe",
    "cảm ơn quý vị và các bạn", "hẹn gặp lại các bạn", "video tiếp theo",
    "video mới", "chúc các bạn xem video", "like và share",
    "chào mừng các bạn đến với kênh", "chào mừng quay trở lại với kênh",
)


def _looks_unclear(text: str, words: list) -> bool:
    """Audio không đủ để tin: quá ít từ, hoặc dính câu outro hallucination kinh điển."""
    if len(words) < 3:
        return True
    low = (text or "").lower()
    if any(m in low for m in _HALLUCINATION_ALWAYS):
        return True
    return any(m in low for m in _HALLUCINATION_MARKS) and len(words) <= 25


def _norm_word(w: str) -> str:
    w = w.lower().strip().strip(".,!?;:…“”\"'`()[]-–—")
    return re.sub(r"(.)\1{2,}", r"\1", w)  # co giãn ký tự lặp ≥3: ừmmm→ừm, àaaa→à


def _volume_label(seed: str) -> str:
    return ["tốt", "hơi nhỏ", "hơi to"][sum(map(ord, seed)) % 3]


def _dbfs(samples) -> float:
    if not len(samples):
        return -90.0
    rms = math.sqrt(sum(v * v for v in samples) / len(samples))
    return 20 * math.log10(rms / 32768) if rms > 0 else -90.0


def _arc_from_samples(s) -> dict | None:
    """Energy arc (V9-2 #5): so dBFS 1/3 ĐẦU vs 1/3 CUỐI bài — bắt lỗi 'MC xuống sức',
    giọng nhỏ dần về cuối. Tính trên cùng PCM đã decode cho âm lượng, không tốn thêm ffmpeg."""
    n = len(s)
    if n < 16000 * 6:  # dưới ~6s chia 3 phần là vô nghĩa
        return None
    third = n // 3
    start_db = _dbfs(s[:third])
    end_db = _dbfs(s[-third:])
    delta = round(end_db - start_db, 1)
    label = "duoi_cuoi" if delta <= -6 else ("len_cuoi" if delta >= 6 else "on_dinh")
    return {"start_db": round(start_db, 1), "end_db": round(end_db, 1), "delta_db": delta, "label": label}


def _volume_and_arc(audio_path: str) -> tuple[str | None, dict | None]:
    """Âm lượng THẬT (FR-13) + energy arc — MỘT lần decode ffmpeg cho cả hai."""
    try:
        pcm = subprocess.run(
            ["ffmpeg", "-v", "quiet", "-i", audio_path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
            capture_output=True, timeout=30,
        ).stdout
        if len(pcm) < 400:
            return None, None
        s = array.array("h")
        s.frombytes(pcm[: len(pcm) - (len(pcm) % 2)])
        if not s:
            return None, None
        dbfs = _dbfs(s)
        label = "hơi nhỏ" if dbfs < -32 else ("hơi to" if dbfs > -12 else "tốt")
        return label, _arc_from_samples(s)
    except Exception as exc:
        log.warning("RMS âm lượng lỗi (%s) → giả lập", exc)
        return None, None


def _rms_volume(audio_path: str) -> str | None:
    """Giữ cho tương thích (verify script cũ) — dùng _volume_and_arc."""
    return _volume_and_arc(audio_path)[0]


# ===== Nhịp độ nói ĐỀU hay KHÔNG (V9-1) =====
# WPM trung bình che mất "nói dồn rồi khựng" — lỗi kinh điển của người mới. Đo bằng
# tốc độ CỤC BỘ theo cửa sổ trượt rồi lấy hệ số biến thiên (CV = std/mean).
# Chỉ chạy khi có word-timestamp THẬT (Google STT / whisper-1). gpt-4o-*-transcribe
# và Viettel không trả timestamp thật → trả None, client không hiện gì (thà im lặng
# còn hơn phán bừa).
_PACE_WIN = 4.0        # cửa sổ 4 giây
_PACE_STEP = 2.0       # trượt 2 giây (chồng nửa cửa sổ)
_PACE_MIN_WORDS = 20   # dưới ngưỡng này bài quá ngắn để nói về "nhịp"
_PACE_MIN_SPAN = 10.0  # giây — cần đủ dài mới có ≥3 cửa sổ
# NGƯỠNG TẠM (V9-1): chưa calibrate trên giọng Việt thật. Đang thu dữ liệu để chỉnh —
# xem research-mo-rong-phan-tich-giong-noi.md §"Làm trước tiên".
_PACE_CV_STEADY = 0.25
_PACE_CV_ROUGH = 0.40


def _pace_analysis(words: list) -> dict | None:
    """Nhịp độ đều/không đều + mốc nói nhanh nhất & chậm nhất (giây).

    Tiếng Việt tách âm tiết bằng khoảng trắng → mỗi 'word' của ASR thực chất là một
    ÂM TIẾT, mịn hơn tiếng Anh, rất hợp để đo nhịp cục bộ.
    """
    pts = [w for w in words
           if isinstance(w, dict)
           and isinstance(w.get("start"), (int, float))
           and isinstance(w.get("end"), (int, float))]
    if len(pts) < _PACE_MIN_WORDS:
        return None
    starts = [float(w["start"]) for w in pts]
    span = float(pts[-1]["end"]) - starts[0]
    # Timestamp GIẢ (adapter trả 0.0 hết) → span vô nghĩa, bỏ qua
    if span < _PACE_MIN_SPAN or all(s == 0 for s in starts):
        return None

    t0 = starts[0]
    rates: list[tuple[float, float]] = []  # (mốc giữa cửa sổ, âm tiết/giây)
    t = t0
    while t + _PACE_WIN <= starts[-1] + 0.01:
        n = sum(1 for s in starts if t <= s < t + _PACE_WIN)
        rates.append((t + _PACE_WIN / 2, n / _PACE_WIN))
        t += _PACE_STEP
    if len(rates) < 3:
        return None

    vals = [r for _, r in rates]
    mean = sum(vals) / len(vals)
    if mean <= 0:
        return None
    var = sum((v - mean) ** 2 for v in vals) / len(vals)
    cv = math.sqrt(var) / mean

    label = "deu" if cv < _PACE_CV_STEADY else ("hoi_lech" if cv < _PACE_CV_ROUGH else "lech")
    fastest = max(rates, key=lambda x: x[1])
    slowest = min(rates, key=lambda x: x[1])
    return {
        "cv": round(cv, 3),
        "label": label,
        "fast_at": round(fastest[0] - t0, 1),  # giây tính từ lúc bắt đầu nói
        "slow_at": round(slowest[0] - t0, 1),
        "windows": len(rates),
    }


# ===== Khoảng lặng bất thường (V9-2 #2) =====
# Đo gap giữa các âm tiết liên tiếp từ word-timestamp. Pause tự nhiên (lấy hơi, hết ý)
# ~0.2-0.6s; "đứng hình" giữa cụm từ >1.5s là dấu hiệu quên bài/mất bình tĩnh.
# Cùng điều kiện dữ liệu với _pace_analysis: cần timestamp THẬT.
_PAUSE_LONG = 1.5      # giây — ngưỡng "đứng hình" (TẠM, chưa calibrate giọng Việt thật)
_PAUSE_MIN_WORDS = 20
_PAUSE_MIN_SPAN = 10.0


def _pause_analysis(words: list) -> dict | None:
    pts = [w for w in words
           if isinstance(w, dict)
           and isinstance(w.get("start"), (int, float))
           and isinstance(w.get("end"), (int, float))]
    if len(pts) < _PAUSE_MIN_WORDS:
        return None
    t0 = float(pts[0]["start"])
    span = float(pts[-1]["end"]) - t0
    if span < _PAUSE_MIN_SPAN or all(float(w["start"]) == 0 for w in pts):
        return None

    longs: list[tuple[float, float]] = []  # (mốc bắt đầu pause tính từ t0, độ dài)
    silence = 0.0
    for a, b in zip(pts, pts[1:]):
        gap = float(b["start"]) - float(a["end"])
        if gap > 0.3:
            silence += gap
        if gap >= _PAUSE_LONG:
            longs.append((round(float(a["end"]) - t0, 1), round(gap, 1)))
    label = "tot" if not longs else ("ngap_ngung" if len(longs) <= 2 else "dut_quang")
    worst = max(longs, key=lambda x: x[1]) if longs else None
    return {
        "label": label,
        "long_count": len(longs),
        "longest": worst[1] if worst else 0.0,
        "longest_at": worst[0] if worst else None,
        "silence_ratio": round(silence / span, 2),
    }


# ===== Lặp cụm từ / tự sửa lời (V9-2 #4 — gate ĐÃ PASS trên cả OpenAI lẫn Google) =====
# Rule n-gram trên transcript: cụm 2-4 ÂM TIẾT lặp lại NGAY liền kề ("chương trình
# chương trình", "xin mời xin mời"). KHÔNG bắt lặp 1 âm tiết — tiếng Việt có từ láy
# hợp lệ (nho nhỏ, xa xa, người người) sẽ thành false positive; chỉ bắt 1 âm tiết khi
# lặp ≥3 lần liên tục ("cái cái cái") — chắc chắn là vấp.
_REP_MIN_TOKS = 10


def _repetition_analysis(text: str) -> dict | None:
    toks = re.sub(r"[.,!?;:…“”\"'`()\[\]\-–—]", " ", (text or "").lower()).split()
    if len(toks) < _REP_MIN_TOKS:
        return None
    hits: list[str] = []
    i = 0
    while i < len(toks):
        matched = 0
        for n in (4, 3, 2):  # cụm dài trước để "a b a b a b" không bị đếm đôi
            if i + 2 * n <= len(toks) and toks[i:i + n] == toks[i + n:i + 2 * n]:
                hits.append(" ".join(toks[i:i + n]))
                matched = n
                break
        if not matched and i + 2 < len(toks) and toks[i] == toks[i + 1] == toks[i + 2]:
            k = 3  # 1 âm tiết lặp ≥3 — vấp thật, không phải từ láy; nuốt trọn cả chuỗi lặp
            while i + k < len(toks) and toks[i + k] == toks[i]:
                k += 1
            hits.append(toks[i])
            i += k
            continue
        i += matched * 2 if matched else 1
    if not hits:
        return {"count": 0, "examples": []}
    return {"count": len(hits), "examples": hits[:3]}


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
        asr_model=settings.asr_model,
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
    # Model không trả word-timestamps (gpt-4o-*-transcribe) → suy words giả từ text:
    # đủ cho đếm từ đệm + WPM theo duration + ngưỡng "quá ít từ"; mất mỗi span nói thực.
    if not words and (result.text or "").strip():
        words = [{"word": w} for w in result.text.split()]
    # ffmpeg là subprocess CHẶN — chạy trong thread để không nghẽn event loop khi nhiều user
    real_vol, energy_arc = (await asyncio.to_thread(_volume_and_arc, path)
                            if (path and os.path.exists(path)) else (None, None))

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
            "pace": None,        # chưa nghe rõ thì không bàn nhịp
            "delivery": None,
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
        # V9-1: nhịp đều/không đều — None khi ASR không có word-timestamp thật hoặc bài quá ngắn
        "pace": _pace_analysis(words) if not used_mock else None,
        # V9-2: bộ tín hiệu "cách bạn nói" — THAM KHẢO, chưa tính đạt/rớt. Từng mảnh tự
        # None khi thiếu dữ liệu (timestamp giả, bài ngắn, không decode được audio).
        "delivery": ({
            "pauses": _pause_analysis(words),
            "repetition": _repetition_analysis(result.text),
            "energy_arc": energy_arc,
        } if not used_mock else None),
    }
