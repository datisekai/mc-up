"""Sinh giáo trình ĐẦY ĐỦ cho các thể loại bằng OpenAI (gpt-4o-mini) — chạy 1 lần.

    cd mcup && api/.venv/bin/python scripts/generate_curriculum.py

- GIỮ nguyên các buổi tay đã có (seed) → chỉ BỔ SUNG: thêm buổi cho Cơ bản +
  tạo cấp Trung cấp / Nâng cao. Idempotent: cấp đã tồn tại thì bỏ qua.
- Mỗi bài đủ Thẻ nhiệm vụ (mục tiêu/tình huống/dàn ý/ví dụ mẫu lời dẫn thật).
- Nội dung sinh ra ở trạng thái PUBLISHED (Finn yêu cầu đầy data ngay) —
  admin sửa/gỡ được từng bài trên /admin-web như thường.
- Kết quả export JSON (format mcup-path-v1) vào db/curriculum/*.json →
  seed_curriculum() nhập lại khi DB reset. KHÔNG mất công sinh lại.
"""
import asyncio
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # mcup/

from sqlalchemy import func, select  # noqa: E402

from api.app.config import settings  # noqa: E402
from api.app.db import SessionLocal, init_db  # noqa: E402
from api.app.models import ContentLesson, ContentSession, Genre, LearningPath, Level  # noqa: E402
from api.app.services import export_path  # noqa: E402

LESSONS_PER_SESSION = 3

# {genre: (mô tả chất nghề, số buổi BỔ SUNG cho Cơ bản, {cấp mới: số buổi})}
PLAN: dict = {
    "Kỹ năng nói": (
        "nền tảng nói trước đám đông cho người Việt trẻ: giọng, hơi thở, cấu trúc bài nói, "
        "kể chuyện, phản biện, ứng biến",
        0, {"Trung cấp": 4, "Nâng cao": 4},
    ),
    "MC đám cưới": (
        "MC lễ cưới Việt Nam: trang trọng, ấm áp, chạm cảm xúc; nghi thức truyền thống "
        "(rước dâu, trao nhẫn, rót rượu, cắt bánh, trao của hồi môn), ứng xử với gia đình hai họ",
        3, {"Trung cấp": 4, "Nâng cao": 4},
    ),
    "MC sự kiện": (
        "MC sự kiện/hội nghị/khai trương/gala: năng lượng sân khấu, giới thiệu đại biểu đúng "
        "nghi thức, giữ nhịp chương trình, xử lý sự cố, tương tác khán giả, dẫn song ngữ cơ bản",
        3, {"Trung cấp": 4, "Nâng cao": 4},
    ),
    "MC livestream": (
        "MC/host livestream bán hàng & giải trí: giữ chân người xem, tương tác bình luận, "
        "giới thiệu sản phẩm, chốt đơn, xử lý anti/troll, xây nhân vật riêng",
        3, {"Trung cấp": 4, "Nâng cao": 4},
    ),
}

_SYSTEM = """Bạn là giáo viên đào tạo MC người Việt 15 năm kinh nghiệm, viết giáo trình thực chiến.
Trả về DUY NHẤT JSON: {"sessions":[{"title":"...","lessons":[{"title":"...","tip":"...","prompt":"...",
"brief":{"objective":"...","context":"...","steps":["...","...","..."],"example":"..."}}]}]}
Yêu cầu chất lượng:
- "prompt" (đề bài): bài THỰC HÀNH NÓI 30-60 giây, cụ thể, làm được ngay một mình với điện thoại.
- "tip": một mẹo nghề ngắn, sắc.
- "objective": mục tiêu học 1 câu. "context": tình huống sân khấu sống động 1-2 câu.
- "steps": dàn ý 3-4 bước ngắn. "example": LỜI DẪN MẪU THẬT 2-4 câu, giọng tự nhiên đúng nghề, tiếng Việt.
- Buổi sau khó hơn buổi trước. KHÔNG trùng lặp với danh sách buổi đã có."""


def _slug(name: str) -> str:
    s = unicodedata.normalize("NFD", name)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


async def gen_sessions(client, genre: str, level: str, n: int, existing: list[str], desc: str) -> list[dict]:
    user = (f"Thể loại: {genre} ({desc}). Cấp độ: {level}.\n"
            f"Các buổi ĐÃ CÓ (tránh trùng): {', '.join(existing) or '(chưa có)'}.\n"
            f"Hãy viết {n} buổi MỚI, mỗi buổi đúng {LESSONS_PER_SESSION} bài.")
    for attempt in range(3):
        try:
            resp = await client.chat.completions.create(
                model="gpt-4o-mini", response_format={"type": "json_object"},
                messages=[{"role": "system", "content": _SYSTEM}, {"role": "user", "content": user}],
            )
            data = json.loads(resp.choices[0].message.content or "{}")
            sessions = data.get("sessions") or []
            ok = [se for se in sessions if se.get("title") and isinstance(se.get("lessons"), list) and se["lessons"]]
            if ok:
                return ok[:n]
        except Exception as exc:  # rate limit / JSON hỏng → thử lại
            print(f"    ! thử lại ({attempt + 1}/3): {exc}")
            await asyncio.sleep(2)
    return []


async def main() -> None:
    if not settings.openai_api_key:
        print("Thiếu OPENAI_API_KEY trong mcup/.env — không sinh được.")
        return
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    await init_db()
    out_dir = Path(__file__).resolve().parents[1] / "db" / "curriculum"
    out_dir.mkdir(parents=True, exist_ok=True)

    async with SessionLocal() as s:
        for genre_name, (desc, extra_basic, new_levels) in PLAN.items():
            print(f"\n=== {genre_name} ===")
            genre = (await s.execute(select(Genre).where(Genre.name == genre_name))).scalar_one_or_none()
            if not genre:
                print("  bỏ qua — genre chưa seed"); continue
            path = (await s.execute(select(LearningPath).where(LearningPath.genre_id == genre.id)
                                    .order_by(LearningPath.created_at))).scalars().first()
            if not path:
                print("  bỏ qua — chưa có path"); continue
            levels = (await s.execute(select(Level).where(Level.path_id == path.id)
                                      .order_by(Level.order_index))).scalars().all()
            by_name = {lv.name: lv for lv in levels}
            all_titles: list[str] = []
            for lv in levels:
                rows = (await s.execute(select(ContentSession.title).where(ContentSession.level_id == lv.id))).scalars().all()
                all_titles += list(rows)

            async def persist(level_id: str, sessions: list[dict], start: int) -> int:
                cnt = 0
                for si, se in enumerate(sessions):
                    cs = ContentSession(level_id=level_id, title=str(se["title"])[:120],
                                        order_index=start + si, status="published")
                    s.add(cs)
                    await s.flush()
                    for li, ln in enumerate(se["lessons"][:LESSONS_PER_SESSION]):
                        brief = ln.get("brief") if isinstance(ln.get("brief"), dict) else None
                        s.add(ContentLesson(session_id=cs.id, title=str(ln.get("title") or "Bài")[:120],
                                            tip=str(ln.get("tip") or ""), prompt=str(ln.get("prompt") or ""),
                                            brief=brief, order_index=li, status="published"))
                        cnt += 1
                    all_titles.append(se["title"])
                await s.commit()
                return cnt

            # 1) bổ sung buổi cho Cơ bản
            basic = by_name.get("Cơ bản") or levels[0]
            if extra_basic:
                n_now = (await s.execute(select(func.count(ContentSession.id))
                                         .where(ContentSession.level_id == basic.id))).scalar() or 0
                print(f"  Cơ bản: +{extra_basic} buổi (đang có {n_now})…")
                ses = await gen_sessions(client, genre_name, "Cơ bản", extra_basic, all_titles, desc)
                print(f"    +{await persist(basic.id, ses, n_now)} bài")

            # 2) cấp mới
            next_order = max((lv.order_index for lv in levels), default=0) + 1
            for lname, n_sess in new_levels.items():
                if lname in by_name:
                    print(f"  {lname}: đã có — bỏ qua"); continue
                print(f"  {lname}: {n_sess} buổi…")
                lv = Level(path_id=path.id, name=lname, order_index=next_order, status="published")
                s.add(lv)
                await s.flush()
                next_order += 1
                ses = await gen_sessions(client, genre_name, lname, n_sess, all_titles, desc)
                print(f"    +{await persist(lv.id, ses, 0)} bài")

            # 3) export JSON để seed lại khi reset DB
            data = await export_path(s, path.id)
            f = out_dir / f"{_slug(genre_name)}.json"
            f.write_text(json.dumps(data, ensure_ascii=False, indent=1))
            n_total = sum(len(cs["lessons"]) for lv in data["levels"] for cs in lv["sessions"])
            n_sessions = sum(len(lv["sessions"]) for lv in data["levels"])
            print(f"  → {f.name}: {len(data['levels'])} cấp · {n_sessions} buổi · {n_total} bài")

    print("\nXONG. JSON tại db/curriculum/ — seed_curriculum() sẽ tự nhập khi DB reset.")


if __name__ == "__main__":
    asyncio.run(main())
