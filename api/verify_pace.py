"""Kiểm chứng _pace_analysis (V9-1 nhịp nói) bằng dữ liệu tổng hợp.

Chạy:  cd mcup && api/.venv/bin/python api/verify_pace.py
Không cần pytest / không cần server — thuần hàm số học.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.app.scoring import _pace_analysis

def words(times):
    """times = list các mốc start (giây); end = start + 0.25"""
    return [{"word": "x", "start": t, "end": t + 0.25} for t in times]

fails = []
def check(name, cond, extra=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + ("" if cond else f"   {extra}"))
    if not cond:
        fails.append(name)

print("\n=== 1. Nói ĐỀU: 4 âm tiết/giây suốt 30s ===")
even = [i * 0.25 for i in range(120)]  # 30s, đều tăm tắp
r = _pace_analysis(words(even))
print("   ", r)
check("có kết quả", r is not None)
check("label = deu", r and r["label"] == "deu", f"got {r and r['label']}")
check("cv rất thấp", r and r["cv"] < 0.1, f"cv={r and r['cv']}")

print("\n=== 2. Nói DỒN rồi KHỰNG: 10s nhanh, 10s im, 10s nhanh ===")
t = []
t += [i * 0.15 for i in range(66)]              # 0-10s: ~6.6 âm tiết/s (dồn)
t += [10.0 + i * 1.6 for i in range(6)]          # 10-20s: 0.6/s (khựng)
t += [20.0 + i * 0.15 for i in range(66)]        # 20-30s: dồn lại
r2 = _pace_analysis(words(sorted(t)))
print("   ", r2)
check("có kết quả", r2 is not None)
check("label = lech", r2 and r2["label"] == "lech", f"got {r2 and r2['label']}")
check("cv cao hơn case đều", r2 and r and r2["cv"] > r["cv"])
check("slow_at rơi vào vùng khựng (10-20s)", r2 and 9 <= r2["slow_at"] <= 21, f"slow_at={r2 and r2['slow_at']}")

print("\n=== 3. Timestamp GIẢ (Viettel trả 0.0 hết) → phải None ===")
fake = [{"word": "x", "start": 0.0, "end": 0.0} for _ in range(60)]
r3 = _pace_analysis(fake)
print("   ", r3)
check("trả None", r3 is None, f"got {r3}")

print("\n=== 4. KHÔNG có timestamp (gpt-4o-mini-transcribe) → phải None ===")
notime = [{"word": "x"} for _ in range(60)]
r4 = _pace_analysis(notime)
print("   ", r4)
check("trả None", r4 is None, f"got {r4}")

print("\n=== 5. Bài quá NGẮN (15 âm tiết) → phải None ===")
r5 = _pace_analysis(words([i * 0.3 for i in range(15)]))
print("   ", r5)
check("trả None", r5 is None, f"got {r5}")

print("\n=== 6. Đủ từ nhưng span quá ngắn (40 âm tiết trong 6s) → phải None ===")
r6 = _pace_analysis(words([i * 0.15 for i in range(40)]))
print("   ", r6)
check("trả None", r6 is None, f"got {r6}")

print("\n=== 7. Danh sách rỗng → phải None ===")
check("trả None", _pace_analysis([]) is None)

print("\n" + ("TẤT CẢ PASS" if not fails else f"CÓ {len(fails)} LỖI: {fails}"))
sys.exit(1 if fails else 0)
