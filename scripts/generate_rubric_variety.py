"""Sinh ≥20 biến thể lời khen/nhắc cho MỖI loại × MỖI thể loại (gpt-4o-mini) — chạy 1 lần.

    cd mcup && api/.venv/bin/python scripts/generate_rubric_variety.py

- 4 tình huống: good (khen đạt) · fast (nhắc nói nhanh) · slow (nhắc nói chậm) · filler (nhắc từ đệm).
- Giọng theo CHẤT thể loại (đám cưới ấm/trang trọng, sự kiện lửa, livestream bắt tai...).
- Ràng buộc tông McUp: cổ vũ, KHÔNG phán xét, gọi "bạn", emoji tiết chế.
- Xuất db/rubric-variety.json → seed_rubrics() nạp vào bảng rubric_module (admin sửa được).
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.app.config import settings  # noqa: E402

N = 20
GENRES = {
    "Kỹ năng nói": "luyện nói trước đám đông cho người Việt trẻ, nền tảng tự tin",
    "MC đám cưới": "MC lễ cưới: ấm áp, trang trọng, chạm cảm xúc",
    "MC sự kiện": "MC sự kiện/gala: năng lượng, giữ nhịp sân khấu, cuốn hút",
    "MC livestream": "MC livestream bán hàng: bắt tai, tự nhiên, giữ chân người xem",
}
SITU = {
    "good": "KHEN khi bạn nói đạt nhịp tốt",
    "fast": "NHẮC KHÉO khi nói hơi NHANH (gợi ý chậm lại)",
    "slow": "NHẮC KHÉO khi nói hơi CHẬM (gợi ý tăng nhịp cho cuốn)",
    "filler": "NHẮC KHÉO khi có nhiều từ đệm 'ừm/à' (gợi ý bớt)",
}

SYS = ("Bạn viết microcopy cho app luyện MC tiếng Việt. Giọng: huấn luyện viên ấm, cổ vũ, "
       "TUYỆT ĐỐI không phán xét, gọi người dùng là 'bạn', emoji tiết chế (0-1 mỗi câu). "
       "Mỗi câu 6-18 từ, tự nhiên, khác nhau rõ. Trả JSON {\"items\":[...]} đúng số lượng yêu cầu.")


async def gen(client, genre: str, desc: str, situ_key: str, situ_desc: str) -> list[str]:
    for attempt in range(3):
        try:
            resp = await client.chat.completions.create(
                model="gpt-4o-mini", response_format={"type": "json_object"}, temperature=1.0,
                messages=[
                    {"role": "system", "content": SYS},
                    {"role": "user", "content": f"Thể loại: {genre} ({desc}).\n"
                     f"Viết {N} câu {situ_desc}, đúng chất thể loại này."},
                ],
            )
            items = json.loads(resp.choices[0].message.content or "{}").get("items")
            items = [str(x).strip() for x in (items or []) if str(x).strip()]
            # loại trùng, giữ thứ tự
            seen, out = set(), []
            for it in items:
                if it.lower() not in seen:
                    seen.add(it.lower()); out.append(it)
            if len(out) >= N:
                return out[:N]
            print(f"    ! {genre}/{situ_key}: chỉ {len(out)} câu, thử lại")
        except Exception as exc:
            print(f"    ! lỗi {genre}/{situ_key} ({attempt+1}/3): {exc}")
            await asyncio.sleep(2)
    return out[:N] if 'out' in dir() else []


async def main():
    if not settings.openai_api_key:
        print("Thiếu OPENAI_API_KEY."); return
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    result: dict = {}
    for genre, desc in GENRES.items():
        print(f"=== {genre} ===")
        pools = {}
        for k, sd in SITU.items():
            pools[k] = await gen(client, genre, desc, k, sd)
            print(f"  {k}: {len(pools[k])} câu")
        result[genre] = pools
    out = Path(__file__).resolve().parents[1] / "db" / "rubric-variety.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    print("XONG →", out.name)


if __name__ == "__main__":
    asyncio.run(main())
