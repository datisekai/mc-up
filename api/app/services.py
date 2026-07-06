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


async def submit_mc_review(s: AsyncSession, mc: User, req: ReviewRequest, note: str,
                           audio_path: str | None = None) -> BadgeCard:
    """MC gửi nhận xét (phần Hồn, AD-5) → tự sinh Thẻ bảo chứng (FR-11). audio_path = giọng MC."""
    req.mc_id = mc.id
    req.status = "submitted"
    review = MCReview(request_id=req.id, mc_id=mc.id, note=note, audio_path=audio_path)
    s.add(review)
    await s.flush()
    badge = BadgeCard(review_id=review.id, hoc_vien_id=req.hoc_vien_id,
                      mc_name=mc.display_name or "MC", mc_title=mc.mc_title, note=note, audio_path=audio_path)
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
            out_sessions.append({"id": cs.id, "title": cs.title,
                                 "lessons": [{"id": ln.id, "title": ln.title, "tip": ln.tip,
                                              "prompt": ln.prompt, "brief": ln.brief} for ln in lessons]})
        out_levels.append({"id": lv.id, "name": lv.name, "sessions": out_sessions})
    return {"id": path.id, "title": path.title, "genre": genre.name if genre else "", "status": path.status, "levels": out_levels}


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


async def publish_path(s: AsyncSession, path_id: str) -> bool:
    """Duyệt & xuất bản: cascade status=published cho cả cây (AD-12)."""
    path = await s.get(LearningPath, path_id)
    if not path:
        return False
    path.status = "published"
    for lv in (await s.execute(select(Level).where(Level.path_id == path_id))).scalars().all():
        lv.status = "published"
        for cs in (await s.execute(select(ContentSession).where(ContentSession.level_id == lv.id))).scalars().all():
            cs.status = "published"
            for ln in (await s.execute(select(ContentLesson).where(ContentLesson.session_id == cs.id))).scalars().all():
                ln.status = "published"
    await s.commit()
    return True


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
