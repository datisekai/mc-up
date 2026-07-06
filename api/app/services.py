"""Tầng service — nghiệp vụ (chấm, streak/XP, vòng đời review) tách khỏi router.

Router chỉ: nhận request → kiểm quyền/đầu vào → gọi service → trả response.
Đây là bước đưa logic ra khỏi cổng vào (xem Architecture Spine). Bước sau nếu
cần hexagonal thuần: chuyển entity xuống domain + repository.
"""
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import SessionLocal
from .models import (BadgeCard, Clip, ContentLesson, ContentSession, Genre, LearningPath, Level,
                     MCReview, Progress, ReviewRequest, Score, User)
from .rubrics import criteria_for, get_rubric
from .scoring import score_clip


async def _rubric_for_clip(s: AsyncSession, clip: Clip) -> dict:
    """Lần theo cây nội dung Bài→Buổi→Cấp→Lộ trình→Thể loại để lấy rubric (FR-15)."""
    if not clip.content_lesson_id:
        return get_rubric(None)  # bài v1 (không thuộc thể loại) → rubric lõi
    cl = await s.get(ContentLesson, clip.content_lesson_id)
    cs = await s.get(ContentSession, cl.session_id) if cl else None
    lv = await s.get(Level, cs.level_id) if cs else None
    path = await s.get(LearningPath, lv.path_id) if lv else None
    genre = await s.get(Genre, path.genre_id) if path else None
    return get_rubric(genre.name if genre else None)


async def run_scoring(clip_id: str, user_id: str, duration: float, lesson_xp: int) -> None:
    """Pipeline chấm bất đồng bộ (AD-1) + cập nhật tiến độ server-owned (AD-3)."""
    async with SessionLocal() as s:
        clip = await s.get(Clip, clip_id)
        clip.status = "processing"
        await s.commit()

        rubric = await _rubric_for_clip(s, clip)  # FR-15: rubric theo thể loại
        result = await score_clip(clip_id, duration, audio_path=clip.audio_path, rubric=rubric)
        s.add(Score(clip_id=clip_id, **result))  # phần Xác, tách khỏi MCReview (AD-5)

        prog = await s.get(Progress, user_id)
        today = date.today()
        if prog.last_day != today:  # idempotent theo ngày (AD-3)
            prog.streak = prog.streak + 1 if prog.last_day == today - timedelta(days=1) else 1
            prog.last_day = today
        prog.xp += lesson_xp
        prog.tickets += 1  # [DEMO] tặng 1 Vé Vàng mỗi lần hoàn thành; thật = theo mốc XP

        clip.status = "done"
        await s.commit()


async def send_golden_ticket(s: AsyncSession, user: User, clip: Clip) -> ReviewRequest:
    """Tiêu 1 Vé Vàng → tạo yêu cầu review MC (AD-6)."""
    prog = await s.get(Progress, user.id)
    prog.tickets -= 1
    req = ReviewRequest(clip_id=clip.id, hoc_vien_id=user.id, status="pending")
    s.add(req)
    await s.commit()
    return req


async def _badge_stats(s: AsyncSession, req: ReviewRequest) -> dict | None:
    """Snapshot before/after cho thẻ khoe: before = clip đầu tiên của học viên, after = clip này.
    Cùng clip (mới luyện 1 lần) → None, thẻ ẩn khối tiến bộ (suy biến duyên dáng)."""
    after = (await s.execute(select(Score).where(Score.clip_id == req.clip_id))).scalar_one_or_none()
    first = (await s.execute(
        select(Score).join(Clip, Clip.id == Score.clip_id)
        .where(Clip.user_id == req.hoc_vien_id).order_by(Score.created_at).limit(1)
    )).scalar_one_or_none()
    if not after or not first or first.clip_id == after.clip_id:
        return None
    return {
        "before": {"speed_wpm": first.speed_wpm, "filler_count": first.filler_count},
        "after": {"speed_wpm": after.speed_wpm, "filler_count": after.filler_count},
    }


async def submit_mc_review(s: AsyncSession, mc: User, req: ReviewRequest, note: str,
                           audio_path: str | None = None) -> BadgeCard:
    """MC gửi nhận xét (phần Hồn, AD-5) → tự sinh Thẻ bảo chứng (FR-11). audio_path = giọng MC."""
    req.mc_id = mc.id
    req.status = "submitted"
    review = MCReview(request_id=req.id, mc_id=mc.id, note=note, audio_path=audio_path)
    s.add(review)
    await s.flush()
    badge = BadgeCard(review_id=review.id, hoc_vien_id=req.hoc_vien_id,
                      mc_name=mc.display_name or "MC", mc_title=mc.mc_title, note=note, audio_path=audio_path,
                      stats=await _badge_stats(s, req))
    s.add(badge)
    await s.commit()
    return badge


def tier_of(xp: int) -> str:
    """Hạng giải đấu theo XP (giống division Duolingo)."""
    if xp >= 300:
        return "Kim cương"
    if xp >= 150:
        return "Bạch kim"
    if xp >= 80:
        return "Vàng"
    if xp >= 30:
        return "Bạc"
    return "Đồng"


async def get_achievements(s: AsyncSession, user: User) -> list[dict]:
    prog = await s.get(Progress, user.id)
    lessons_done = (await s.execute(
        select(func.count(func.distinct(Clip.lesson_id)))
        .join(Score, Score.clip_id == Clip.id).where(Clip.user_id == user.id)
    )).scalar() or 0
    badges = (await s.execute(
        select(func.count(BadgeCard.id)).where(BadgeCard.hoc_vien_id == user.id)
    )).scalar() or 0
    defs = [
        ("first_step", "Bước đầu tiên", "Hoàn thành bài học đầu tiên", lessons_done >= 1),
        ("five_lessons", "MC tương lai", "Hoàn thành 5 bài học", lessons_done >= 5),
        ("streak7", "Chuỗi 7 ngày", "Giữ streak 7 ngày liên tục", prog.streak >= 7),
        ("xp50", "Chăm chỉ", "Đạt 50 XP", prog.xp >= 50),
        ("first_badge", "Được MC công nhận", "Nhận nhận xét đầu tiên từ MC thật", badges >= 1),
    ]
    return [{"code": c, "title": t, "desc": d, "earned": e} for c, t, d, e in defs]


async def get_score_history(s: AsyncSession, user: User, limit: int = 20) -> list[dict]:
    rows = (await s.execute(
        select(Score.speed_wpm, Score.filler_count, Score.created_at)
        .join(Clip, Clip.id == Score.clip_id).where(Clip.user_id == user.id)
        .order_by(Score.created_at).limit(limit)
    )).all()
    return [{"speed_wpm": r.speed_wpm, "filler_count": r.filler_count, "created_at": r.created_at.isoformat()} for r in rows]


# ===== v2 · Cỗ máy nội dung (FR-16/17/18) =====

async def ai_split_and_persist(s: AsyncSession, raw_text: str, genre_name: str, openai_key: str) -> dict:
    """AI-split (AD-10) rồi LƯU vào cây nội dung dạng DRAFT (AD-12) để duyệt sau."""
    from adapters.content_split_factory import get_splitter  # type: ignore

    draft = await get_splitter(openai_key).split(raw_text, genre_name)
    genre = (await s.execute(select(Genre).where(Genre.name == genre_name))).scalar_one_or_none()
    if not genre:
        genre = Genre(name=genre_name, status="published")
        s.add(genre)
        await s.flush()
    path = LearningPath(genre_id=genre.id, title=f"Lộ trình: {genre_name}", status="draft")
    s.add(path)
    await s.flush()
    level = Level(path_id=path.id, name="Cơ bản", order_index=0, status="draft")
    s.add(level)
    await s.flush()
    for si, sess in enumerate(draft.get("sessions", [])):
        cs = ContentSession(level_id=level.id, title=sess.get("title", "Buổi"), order_index=si, status="draft")
        s.add(cs)
        await s.flush()
        for li, les in enumerate(sess.get("lessons", [])):
            brief = les.get("brief") if isinstance(les.get("brief"), dict) else None
            s.add(ContentLesson(session_id=cs.id, title=les.get("title", "Bài"),
                                tip=les.get("tip", ""), prompt=les.get("prompt", ""),
                                brief=brief, order_index=li, status="draft"))
    await s.commit()
    return {"path_id": path.id, "is_mock": bool(draft.get("is_mock", False))}


async def get_path_tree(s: AsyncSession, path_id: str) -> dict | None:
    path = await s.get(LearningPath, path_id)
    if not path:
        return None
    genre = await s.get(Genre, path.genre_id)
    levels = (await s.execute(select(Level).where(Level.path_id == path_id).order_by(Level.order_index))).scalars().all()
    out_levels = []
    for lv in levels:
        sessions = (await s.execute(select(ContentSession).where(ContentSession.level_id == lv.id).order_by(ContentSession.order_index))).scalars().all()
        out_sessions = []
        for cs in sessions:
            lessons = (await s.execute(select(ContentLesson).where(ContentLesson.session_id == cs.id).order_by(ContentLesson.order_index))).scalars().all()
            out_sessions.append({"id": cs.id, "title": cs.title, "status": cs.status, "order_index": cs.order_index,
                                 "lessons": [{"id": ln.id, "title": ln.title, "tip": ln.tip,
                                              "prompt": ln.prompt, "brief": ln.brief,
                                              "status": ln.status, "order_index": ln.order_index} for ln in lessons]})
        out_levels.append({"id": lv.id, "name": lv.name, "status": lv.status, "sessions": out_sessions})
    return {"id": path.id, "title": path.title, "genre": genre.name if genre else "",
            "genre_id": path.genre_id, "status": path.status, "levels": out_levels}


async def list_paths(s: AsyncSession, status: str | None = None) -> list[dict]:
    q = select(LearningPath).order_by(LearningPath.created_at.desc())
    if status:
        q = q.where(LearningPath.status == status)
    paths = (await s.execute(q)).scalars().all()
    out = []
    for p in paths:
        g = await s.get(Genre, p.genre_id)
        out.append({"id": p.id, "title": p.title, "genre": g.name if g else "", "status": p.status})
    return out


async def _cascade_status(s: AsyncSession, path_id: str, status: str) -> bool:
    """Đặt status cả cây (AD-12). Node ARCHIVED được giữ nguyên — lưu trữ là quyết định riêng."""
    path = await s.get(LearningPath, path_id)
    if not path:
        return False
    path.status = status
    for lv in (await s.execute(select(Level).where(Level.path_id == path_id))).scalars().all():
        if lv.status != "archived":
            lv.status = status
        for cs in (await s.execute(select(ContentSession).where(ContentSession.level_id == lv.id))).scalars().all():
            if cs.status != "archived":
                cs.status = status
            for ln in (await s.execute(select(ContentLesson).where(ContentLesson.session_id == cs.id))).scalars().all():
                if ln.status != "archived":
                    ln.status = status
    await s.commit()
    return True


async def publish_path(s: AsyncSession, path_id: str) -> bool:
    """Duyệt & xuất bản: cascade status=published cho cả cây (AD-12)."""
    return await _cascade_status(s, path_id, "published")


async def unpublish_path(s: AsyncSession, path_id: str) -> bool:
    """Gỡ xuất bản: cả cây về draft — học viên không thấy nữa (AD-12)."""
    return await _cascade_status(s, path_id, "draft")


# ===== Admin CRUD nội dung (Pha A — admin-panel-plan-2026-07-06) =====
# Nguyên tắc: node mới LUÔN draft (AD-12) · xoá = archive (không xoá cứng) ·
# field cho sửa theo whitelist từng tầng — không mở toang setattr.

_EDITABLE: dict[str, tuple[type, set[str]]] = {
    "path": (LearningPath, {"title", "status"}),
    "level": (Level, {"name", "status"}),
    "session": (ContentSession, {"title", "status"}),
    "lesson": (ContentLesson, {"title", "tip", "prompt", "brief", "status"}),
}
_STATUSES = {"draft", "published", "archived"}


async def admin_create_genre(s: AsyncSession, name: str) -> Genre:
    g = (await s.execute(select(Genre).where(Genre.name == name))).scalar_one_or_none()
    if not g:
        g = Genre(name=name, status="published")
        s.add(g)
        await s.commit()
    return g


async def admin_list_genres(s: AsyncSession) -> list[dict]:
    gs = (await s.execute(select(Genre).order_by(Genre.created_at))).scalars().all()
    return [{"id": g.id, "name": g.name, "status": g.status} for g in gs]


async def admin_create_path(s: AsyncSession, genre_id: str, title: str) -> str | None:
    if not await s.get(Genre, genre_id):
        return None
    path = LearningPath(genre_id=genre_id, title=title, status="draft")
    s.add(path)
    await s.flush()
    s.add(Level(path_id=path.id, name="Cơ bản", order_index=0, status="draft"))
    await s.commit()
    return path.id


async def admin_create_session(s: AsyncSession, level_id: str, title: str) -> str | None:
    if not await s.get(Level, level_id):
        return None
    n = (await s.execute(select(func.count(ContentSession.id)).where(ContentSession.level_id == level_id))).scalar() or 0
    cs = ContentSession(level_id=level_id, title=title, order_index=n, status="draft")
    s.add(cs)
    await s.commit()
    return cs.id


async def admin_create_lesson(s: AsyncSession, session_id: str, title: str) -> str | None:
    if not await s.get(ContentSession, session_id):
        return None
    n = (await s.execute(select(func.count(ContentLesson.id)).where(ContentLesson.session_id == session_id))).scalar() or 0
    ln = ContentLesson(session_id=session_id, title=title, tip="", prompt="", order_index=n, status="draft")
    s.add(ln)
    await s.commit()
    return ln.id


async def admin_update_node(s: AsyncSession, kind: str, node_id: str, fields: dict) -> bool:
    model, allowed = _EDITABLE[kind]
    node = await s.get(model, node_id)
    if not node:
        return False
    for k, v in fields.items():
        if k not in allowed:
            continue
        if k == "status" and v not in _STATUSES:
            continue
        if k == "brief" and v is not None and not isinstance(v, dict):
            continue
        setattr(node, k, v)
    await s.commit()
    return True


async def admin_duplicate_lesson(s: AsyncSession, lesson_id: str) -> str | None:
    src = await s.get(ContentLesson, lesson_id)
    if not src:
        return None
    n = (await s.execute(select(func.count(ContentLesson.id)).where(ContentLesson.session_id == src.session_id))).scalar() or 0
    dup = ContentLesson(session_id=src.session_id, title=f"{src.title} (bản sao)", tip=src.tip,
                        prompt=src.prompt, brief=dict(src.brief) if src.brief else None,
                        order_index=n, status="draft")
    s.add(dup)
    await s.commit()
    return dup.id


async def admin_duplicate_session(s: AsyncSession, session_id: str) -> str | None:
    src = await s.get(ContentSession, session_id)
    if not src:
        return None
    n = (await s.execute(select(func.count(ContentSession.id)).where(ContentSession.level_id == src.level_id))).scalar() or 0
    dup = ContentSession(level_id=src.level_id, title=f"{src.title} (bản sao)", order_index=n, status="draft")
    s.add(dup)
    await s.flush()
    lessons = (await s.execute(select(ContentLesson).where(ContentLesson.session_id == src.id).order_by(ContentLesson.order_index))).scalars().all()
    for i, ln in enumerate(lessons):
        s.add(ContentLesson(session_id=dup.id, title=ln.title, tip=ln.tip, prompt=ln.prompt,
                            brief=dict(ln.brief) if ln.brief else None, order_index=i, status="draft"))
    await s.commit()
    return dup.id


async def admin_move_node(s: AsyncSession, kind: str, node_id: str, direction: int) -> bool:
    """Đổi chỗ order_index với node kề TRONG CÙNG cha (↑↓ — reorder Pha A)."""
    if kind == "session":
        node = await s.get(ContentSession, node_id)
        if not node:
            return False
        siblings = (await s.execute(select(ContentSession).where(ContentSession.level_id == node.level_id)
                                    .order_by(ContentSession.order_index))).scalars().all()
    elif kind == "lesson":
        node = await s.get(ContentLesson, node_id)
        if not node:
            return False
        siblings = (await s.execute(select(ContentLesson).where(ContentLesson.session_id == node.session_id)
                                    .order_by(ContentLesson.order_index))).scalars().all()
    else:
        return False
    idx = next((i for i, x in enumerate(siblings) if x.id == node_id), -1)
    j = idx + (1 if direction > 0 else -1)
    if idx < 0 or j < 0 or j >= len(siblings):
        return False
    for i, x in enumerate(siblings):  # chuẩn hoá 0..n-1 trước khi hoán vị (dữ liệu cũ có thể trùng index)
        x.order_index = i
    siblings[idx].order_index, siblings[j].order_index = j, idx
    await s.commit()
    return True


# Mock gợi ý theo field — dùng khi không có OPENAI_API_KEY (adapter thật ở dưới)
_SUGGEST_MOCK = {
    "objective": "Nói trôi chảy 30 giây, đúng chất thể loại, dưới 2 từ đệm.",
    "context": "Bạn đang đứng trước khán giả thật, ánh đèn hướng về phía bạn — hãy hình dung cụ thể không gian đó.",
    "steps": ["Chào và thu hút sự chú ý", "Vào nội dung chính, nhấn điểm quan trọng", "Chốt lại và chuyển tiếp mượt"],
    "example": "Xin chào tất cả quý vị! Thật vinh dự khi được đồng hành cùng mọi người trong chương trình hôm nay...",
    "tip": "Hít một hơi sâu trước khi bắt đầu — câu đầu chậm và rõ sẽ kéo cả bài theo.",
    "prompt": "Hãy dẫn phần mở màn trong 30 giây: chào khán giả, giới thiệu chương trình và tạo không khí.",
}


async def ai_suggest_field(genre: str, lesson_title: str, prompt: str, field: str, openai_key: str) -> dict:
    """✨ AI gợi ý TỪNG Ô cho admin (plan §1.4). Luôn là gợi ý nháp — người sửa rồi lưu (AD-10)."""
    if field not in _SUGGEST_MOCK:
        return {"error": "field không hỗ trợ"}
    if not openai_key:
        return {"value": _SUGGEST_MOCK[field], "is_mock": True}
    import json as _json

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=openai_key)
    want_list = field == "steps"
    ask = {
        "objective": "mục tiêu học tập 1 câu",
        "context": "tình huống sân khấu cụ thể 1-2 câu",
        "steps": "dàn ý 3-4 bước, mỗi bước ngắn gọn",
        "example": "ví dụ lời dẫn mẫu 2-3 câu, giọng tự nhiên",
        "tip": "một mẹo ngắn thiết thực",
        "prompt": "đề bài thực hành 1-2 câu",
    }[field]
    resp = await client.chat.completions.create(
        model="gpt-4o-mini", response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "Bạn là giáo viên MC tiếng Việt. Trả JSON: {\"value\": ...} — value là "
             + ("mảng chuỗi" if want_list else "chuỗi") + ". Giọng ấm, cổ vũ, sát nghề."},
            {"role": "user", "content": f"Thể loại: {genre}. Bài: {lesson_title}. Đề hiện tại: {prompt or '(chưa có)'}. Hãy viết {ask}."},
        ],
    )
    data = _json.loads(resp.choices[0].message.content or "{}")
    return {"value": data.get("value") or _SUGGEST_MOCK[field], "is_mock": False}


async def get_content_lessons_for_user(s: AsyncSession, path_id: str, user_id: str) -> list[dict]:
    """Bài PUBLISHED của một lộ trình, phẳng + unlocked/done theo user (FR-19).
    Kèm Thẻ nhiệm vụ (brief) + tiêu chí đạt sinh từ rubric thể loại (FR-15)."""
    path = await s.get(LearningPath, path_id)
    genre = await s.get(Genre, path.genre_id) if path else None
    criteria = criteria_for(get_rubric(genre.name if genre else None))
    levels = (await s.execute(select(Level).where(Level.path_id == path_id, Level.status == "published").order_by(Level.order_index))).scalars().all()
    flat = []
    for lv in levels:
        sessions = (await s.execute(select(ContentSession).where(ContentSession.level_id == lv.id, ContentSession.status == "published").order_by(ContentSession.order_index))).scalars().all()
        for cs in sessions:
            lessons = (await s.execute(select(ContentLesson).where(ContentLesson.session_id == cs.id, ContentLesson.status == "published").order_by(ContentLesson.order_index))).scalars().all()
            for ln in lessons:
                flat.append((ln, cs.order_index + 1))
    ids = [ln.id for ln, _ in flat]
    done: set = set()
    if ids:
        rows = (await s.execute(
            select(Clip.content_lesson_id).join(Score, Score.clip_id == Clip.id)
            .where(Clip.user_id == user_id, Clip.content_lesson_id.in_(ids))
        )).scalars().all()
        done = set(rows)
    out, prev_done = [], True
    for i, (ln, buoi) in enumerate(flat):
        is_done = ln.id in done
        out.append({"id": ln.id, "buoi": buoi, "order_index": i, "title": ln.title,
                    "tip": ln.tip, "prompt": ln.prompt, "brief": ln.brief, "criteria": criteria,
                    "unlocked": prev_done, "done": is_done})
        prev_done = is_done
    return out
