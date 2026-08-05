"""Kiểm chứng bộ tín hiệu V9-2 "cách bạn nói": pause / repetition / energy arc.

Chạy:  cd mcup && api/.venv/bin/python api/verify_delivery.py
Không cần server / không gọi API trả tiền — dữ liệu tổng hợp.
"""
import array
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.app.scoring import _arc_from_samples, _pause_analysis, _repetition_analysis  # noqa: E402

fails = []


def check(name, cond, extra=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + ("" if cond else f"   {extra}"))
    if not cond:
        fails.append(name)


def words(times):
    return [{"word": "x", "start": t, "end": t + 0.25} for t in times]


print("=== PAUSE ===")
r = _pause_analysis(words([i * 0.3 for i in range(100)]))
check("liên tục → tot", r and r["label"] == "tot" and r["long_count"] == 0, str(r))
t = [i * 0.3 for i in range(40)]           # 0-11.95s
t += [14.5 + i * 0.3 for i in range(40)]   # gap 2.55s tại 11.95
t += [30.0 + i * 0.3 for i in range(40)]   # gap 3.55s tại ~26.45 (lớn nhất)
r2 = _pause_analysis(words(sorted(t)))
check("2 quãng dài → ngap_ngung", r2 and r2["label"] == "ngap_ngung" and r2["long_count"] == 2, str(r2))
check("longest_at đúng vùng gap lớn nhất", r2 and 25 < (r2["longest_at"] or 0) < 28, str(r2))
check("timestamp giả → None", _pause_analysis([{"word": "x", "start": 0.0, "end": 0.0}] * 60) is None)
check("quá ngắn → None", _pause_analysis(words([i * 0.3 for i in range(10)])) is None)

print("=== REPETITION ===")
r = _repetition_analysis("xin chào quý vị chương trình chương trình hôm nay rất đặc biệt")
check("bắt lặp cụm 2 âm tiết", r and r["count"] == 1 and "chương trình" in r["examples"][0], str(r))
r = _repetition_analysis("những ngôi nhà nho nhỏ xa xa phía chân trời trông thật đẹp và yên bình")
check("KHÔNG bắt từ láy (nho nhỏ, xa xa)", r and r["count"] == 0, str(r))
r = _repetition_analysis("và tiếp theo là cái cái cái tiết mục văn nghệ đến từ đội hai")
check("bắt lặp 1 âm tiết x3 (vấp thật)", r and r["count"] == 1 and r["examples"] == ["cái"], str(r))
r = _repetition_analysis("xin mời quý vị xin mời quý vị cùng hướng lên sân khấu ạ")
check("bắt lặp cụm 3-4 âm tiết", r and r["count"] == 1, str(r))
check("bài ngắn → None", _repetition_analysis("xin chào") is None)
r = _repetition_analysis("kính thưa quý vị đại biểu hôm nay chúng ta có mặt tại đây để chung vui")
check("bài sạch → count 0", r and r["count"] == 0, str(r))

print("=== ENERGY ARC ===")


def tone(db, sec, sr=16000):
    amp = 32768 * (10 ** (db / 20)) * math.sqrt(2)
    return [int(amp * math.sin(2 * math.pi * 220 * i / sr)) for i in range(int(sec * sr))]


r = _arc_from_samples(array.array("h", tone(-20, 8) + tone(-30, 4)))
check("giọng đuối cuối → duoi_cuoi", r and r["label"] == "duoi_cuoi", str(r))
r = _arc_from_samples(array.array("h", tone(-20, 12)))
check("giọng đều → on_dinh", r and r["label"] == "on_dinh", str(r))
check("quá ngắn → None", _arc_from_samples(array.array("h", tone(-20, 3))) is None)

print("\n" + ("TẤT CẢ PASS" if not fails else f"CÓ {len(fails)} LỖI: {fails}"))
sys.exit(1 if fails else 0)
