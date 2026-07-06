"""Tầng service — nghiệp vụ (chấm, streak/XP, vòng đời review) tách khỏi router.

Router chỉ: nhận request → kiểm quyền/đầu vào → gọi service → trả response.
Đây là bước đưa logic ra khỏi cổng vào (xem Architecture Spine). Bước sau nếu
cần hexagonal thuần: chuyển entity xuống domain + repository.
"""
import json as _json
import logging
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import SessionLocal
from .models import (AuditLog, BadgeCard, Clip, ContentLesson, ContentSession, Genre,
                     LearningPath, Lesson, Level, MCReview, Progress, ReviewRequest,
                     RubricModule, Score, User)
from .rubrics import criteria_for, get_rubric
from .scoring import score_clip
from .security import hash_password

log = logging.getLogger("mcup.services")


async def _lesson_steps(s: AsyncSession, clip: Clip) -> list[str]:
    """Dàn ý (brief.steps) của bài học clip thuộc về — nguồn để chấm 'đủ ý chưa'."""
    brief = None
    if clip.content_lesson_id:
        cl = await s.get(ContentLesson, clip.content_lesson_id)
        brief = cl.brief if cl else None
    elif clip.lesson_id:
        ls = await s.get(Lesson, clip.lesson_id)
        brief = ls.brief if ls else None
    steps = brief.get("steps") if isinstance(brief, dict) else None
    return [str(x) for x in steps] if isinstance(steps, list) else []


async def judge_coverage(transcript: str, steps: list[str], openai_key: str) -> dict | None:
    """'Đủ ý chưa': AI đối chiếu lời nói với dàn ý — người nói đã CHẠM từng ý chưa.
    Best-effort (không key/lỗi → None, không chặn chấm). Khoan dung: chỉ cần đề cập ý."""
    if not steps or not transcript or not openai_key:
        return None
    from openai import AsyncOpenAI
    numbered = "\n".join(f"{i + 1}. {st}" for i, st in enumerate(steps))
    try:
        client = AsyncOpenAI(api_key=openai_key)
        resp = await client.chat.completions.create(
            model="gpt-4o-mini", response_format={"type": "json_object"}, temperature=0,
            messages=[
                {"role": "system", "content": "Bạn kiểm tra người nói đã CHẠM tới từng ý trong dàn ý "
                 "chưa (khoan dung — chỉ cần đề cập/diễn đạt ý đó, KHÔNG cần đúng từ). "
                 "Trả JSON {\"covered\":[true/false...]} đúng THỨ TỰ và ĐỦ SỐ ý của dàn ý."},
                {"role": "user", "content": f"Lời người nói:\n\"{transcript}\"\n\nDàn ý cần chạm:\n{numbered}"},
            ],
        )
        data = _json.loads(resp.choices[0].message.content or "{}")
        covered = data.get("covered")
        if isinstance(covered, list) and len(covered) == len(steps):
            return {"steps": steps, "covered": [bool(x) for x in covered]}
    except Exception as exc:
        log.warning("judge_coverage lỗi (%s) → bỏ qua", exc)
    return None


async def effective_rubric(s: AsyncSession, genre_name: str | None) -> dict:
    """Rubric HIỆU LỰC (Pha B): override trong DB (admin sửa) > registry code > CORE.
    tips trả về dạng POOL (mảng biến thể) — chấm điểm sẽ rút 1 biến thể (_pick_tips)."""
    base = get_rubric(genre_name)
    tips_pool = {k: (v if isinstance(v, list) else [v]) for k, v in base["tips"].items()}
    rub = {**base, "tips": tips_pool}
    if not genre_name:
        return rub
    g = (await s.execute(select(Genre).where(Genre.name == genre_name))).scalar_one_or_none()
    if not g:
        return rub
    rm = (await s.execute(select(RubricModule).where(RubricModule.genre_id == g.id))).scalar_one_or_none()
    if not rm:
        return rub
    tips = dict(tips_pool)
    for k, v in (rm.tips or {}).items():
        if isinstance(v, list) and v:
            tips[k] = v
    return {**rub, "wpm_min": rm.wpm_min, "wpm_max": rm.wpm_max, "focus": rm.focus, "tips": tips}


def _pick_tips(rub: dict) -> dict:
    """Rút 1 biến thể tip mỗi tình huống cho bộ chấm (score_clip cần chuỗi, không phải pool)."""
    return {**rub, "tips": {k: (random.choice(v) if isinstance(v, list) and v else v)
                            for k, v in rub["tips"].items()}}


async def _clip_genre_name(s: AsyncSession, clip: Clip) -> str | None:
    """Tên thể loại của clip (lần cây nội dung). Bài v1 → None (rubric lõi)."""
    if not clip.content_lesson_id:
        return None
    cl = await s.get(ContentLesson, clip.content_lesson_id)
    cs = await s.get(ContentSession, cl.session_id) if cl else None
    lv = await s.get(Level, cs.level_id) if cs else None
    path = await s.get(LearningPath, lv.path_id) if lv else None
    genre = await s.get(Genre, path.genre_id) if path else None
    return genre.name if genre else None


async def _rubric_for_clip(s: AsyncSession, clip: Clip) -> dict:
    """Lần theo cây nội dung Bài→Buổi→Cấp→Lộ trình→Thể loại để lấy rubric (FR-15).
    Pha B: rubric hiệu lực đọc CẢ override DB (admin sửa không cần deploy)."""
    return _pick_tips(await effective_rubric(s, await _clip_genre_name(s, clip)))


async def summarize_score(s: AsyncSession, clip: Clip, score: Score) -> dict:
    """Feedback rõ ràng: ĐÃ TỐT gì / CẦN CẢI THIỆN gì — tổng hợp mọi tín hiệu
    (âm lượng, tốc độ theo rubric thể loại, từ đệm, đủ ý). Không phán xét."""
    rub = await effective_rubric(s, await _clip_genre_name(s, clip))
    lo, hi = rub["wpm_min"], rub["wpm_max"]
    pos: list[str] = []
    imp: list[str] = []

    if score.volume_label == "tốt":
        pos.append("Âm lượng rõ, đều")
    elif "nhỏ" in (score.volume_label or ""):
        imp.append("Nói to hơn một chút cho rõ")
    else:
        imp.append("Nói nhẹ lại một chút, đừng gắng sức")

    if lo <= score.speed_wpm <= hi:
        pos.append(f"Tốc độ hợp lý ({round(score.speed_wpm)} chữ/phút)")
    elif score.speed_wpm > hi:
        imp.append(f"Chậm lại một nhịp — đang {round(score.speed_wpm)}, hợp là {lo}–{hi} chữ/phút")
    else:
        imp.append(f"Tăng nhịp cho cuốn hơn — đang {round(score.speed_wpm)}, hợp là {lo}–{hi} chữ/phút")

    if score.filler_count < 2:
        pos.append("Ít từ đệm 'ừm/à'")
    else:
        imp.append(f"Bớt từ đệm — {score.filler_count} lần 'ừm/à' trong bài")

    if isinstance(score.coverage, dict) and score.coverage.get("steps"):
        covered = score.coverage.get("covered") or []
        done = sum(1 for x in covered if x)
        total = len(score.coverage["steps"])
        if done >= total:
            pos.append("Nói đủ ý theo dàn ý")
        else:
            imp.append(f"Còn thiếu {total - done} ý trong dàn ý đề bài")

    return {"positives": pos, "improvements": imp}


async def run_scoring(clip_id: str, user_id: str, duration: float, lesson_xp: int) -> None:
    """Pipeline chấm bất đồng bộ (AD-1) + cập nhật tiến độ server-owned (AD-3)."""
    async with SessionLocal() as s:
        clip = await s.get(Clip, clip_id)
        clip.status = "processing"
        await s.commit()

        rubric = await _rubric_for_clip(s, clip)  # FR-15: rubric theo thể loại
        result = await score_clip(clip_id, duration, audio_path=clip.audio_path, rubric=rubric)
        # "Đủ ý chưa" — chỉ khi ASR thật + bài có dàn ý (best-effort, không chặn chấm)
        result["coverage"] = None
        if not result["is_mock"] and result.get("transcript"):
            steps = await _lesson_steps(s, clip)
            result["coverage"] = await judge_coverage(result["transcript"], steps, settings.openai_api_key)
        s.add(Score(clip_id=clip_id, **result))  # phần Xác, tách khỏi MCReview (AD-5)

        # "Chưa nghe rõ" (ASR thật, wpm=0) = KHÔNG phải bài hoàn thành → không XP/streak/vé
        # (vừa đúng logic, vừa chặn farm vé bằng clip im lặng)
        unclear = (not result["is_mock"]) and result["speed_wpm"] == 0
        if not unclear:
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
                           audio_path: str | None = None, transcript: str | None = None) -> BadgeCard:
    """MC gửi nhận xét (phần Hồn, AD-5) → tự sinh Thẻ bảo chứng (FR-11). audio_path = giọng MC."""
    req.mc_id = mc.id
    req.status = "submitted"
    review = MCReview(request_id=req.id, mc_id=mc.id, note=note, audio_path=audio_path,
                      transcript=transcript)
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
    # Đếm CẢ bài v1 (lesson_id) LẪN bài nội dung v2 (content_lesson_id) — trước đây chỉ đếm v1
    # nên học viên học giáo trình mới không bao giờ mở khoá huy hiệu (bug).
    lessons_done = (await s.execute(
        select(func.count(func.distinct(func.coalesce(Clip.lesson_id, Clip.content_lesson_id))))
        .join(Score, Score.clip_id == Clip.id).where(Clip.user_id == user.id)
    )).scalar() or 0
    badges = (await s.execute(
        select(func.count(BadgeCard.id)).where(BadgeCard.hoc_vien_id == user.id)
    )).scalar() or 0
    # (code, tên, mô tả, giá trị hiện tại, mốc) — trả kèm progress/target để app vẽ "còn N nữa"
    defs = [
        ("first_step", "Bước đầu tiên", "Hoàn thành bài đầu tiên", lessons_done, 1),
        ("streak3", "Nhen lửa", "Giữ chuỗi 3 ngày", prog.streak, 3),
        ("five_lessons", "MC tương lai", "Hoàn thành 5 bài", lessons_done, 5),
        ("xp50", "Chăm chỉ", "Đạt 50 XP", prog.xp, 50),
        ("ten_lessons", "Bền bỉ", "Hoàn thành 10 bài", lessons_done, 10),
        ("streak7", "Chuỗi 7 ngày", "Giữ chuỗi 7 ngày", prog.streak, 7),
        ("first_badge", "Được MC công nhận", "Nhận nhận xét đầu tiên từ MC thật", badges, 1),
        ("xp150", "Lên tay", "Đạt 150 XP", prog.xp, 150),
    ]
    return [{"code": c, "title": t, "desc": d, "progress": min(p, tg), "target": tg, "earned": p >= tg}
            for c, t, d, p, tg in defs]


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


# ===== Admin Pha B — Rubric editor (rubric as data, xuống DB) =====

async def admin_list_rubrics(s: AsyncSession) -> list[dict]:
    """Mỗi thể loại một dòng: rubric hiệu lực + cờ override (đã sửa trên admin hay chưa)."""
    out = []
    for g in (await s.execute(select(Genre).order_by(Genre.created_at))).scalars().all():
        eff = await effective_rubric(s, g.name)
        rm = (await s.execute(select(RubricModule).where(RubricModule.genre_id == g.id))).scalar_one_or_none()
        out.append({"genre_id": g.id, "genre": g.name, "wpm_min": eff["wpm_min"], "wpm_max": eff["wpm_max"],
                    "focus": eff["focus"], "tips": eff["tips"], "override": rm is not None,
                    "criteria": criteria_for(eff)})
    return out


async def admin_upsert_rubric(s: AsyncSession, genre_id: str, fields: dict) -> bool:
    if not await s.get(Genre, genre_id):
        return False
    rm = (await s.execute(select(RubricModule).where(RubricModule.genre_id == genre_id))).scalar_one_or_none()
    if not rm:
        rm = RubricModule(genre_id=genre_id)
        s.add(rm)
    if isinstance(fields.get("wpm_min"), int):
        rm.wpm_min = fields["wpm_min"]
    if isinstance(fields.get("wpm_max"), int):
        rm.wpm_max = fields["wpm_max"]
    if isinstance(fields.get("focus"), str) and fields["focus"].strip():
        rm.focus = fields["focus"].strip()
    tips = fields.get("tips")
    if isinstance(tips, dict):
        rm.tips = {k: [str(x) for x in v if str(x).strip()]
                   for k, v in tips.items() if k in ("fast", "slow", "filler", "good") and isinstance(v, list)}
    rm.updated_at = datetime.now(timezone.utc)
    await s.commit()
    return True


async def admin_delete_rubric(s: AsyncSession, genre_id: str) -> bool:
    rm = (await s.execute(select(RubricModule).where(RubricModule.genre_id == genre_id))).scalar_one_or_none()
    if not rm:
        return False
    await s.delete(rm)
    await s.commit()
    return True


# ===== Admin Pha B — Người dùng =====

_GUEST_DOMAIN = "@guest.mcup"


async def admin_list_users(s: AsyncSession, q: str = "", limit: int = 50, offset: int = 0) -> list[dict]:
    stmt = select(User).order_by(User.created_at.desc())
    if q.strip():
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(func.lower(User.email).like(like) | func.lower(func.coalesce(User.display_name, "")).like(like))
    users = (await s.execute(stmt.limit(limit).offset(offset))).scalars().all()
    out = []
    for u in users:
        prog = await s.get(Progress, u.id)
        out.append({"id": u.id, "email": u.email, "display_name": u.display_name, "role": u.role,
                    "mc_title": u.mc_title, "is_guest": u.email.endswith(_GUEST_DOMAIN),
                    "created_at": u.created_at.isoformat(),
                    "xp": prog.xp if prog else 0, "streak": prog.streak if prog else 0,
                    "tickets": prog.tickets if prog else 0})
    return out


async def admin_create_user(s: AsyncSession, email: str, password: str, display_name: str,
                            role: str, mc_title: str | None) -> dict | None:
    if (await s.execute(select(User).where(User.email == email))).scalar_one_or_none():
        return None
    u = User(email=email, password_hash=hash_password(password),
             role=role if role in ("hoc_vien", "mc", "admin") else "mc",
             display_name=display_name, mc_title=mc_title)
    s.add(u)
    await s.flush()
    s.add(Progress(user_id=u.id))
    await s.commit()
    return {"id": u.id}


async def admin_patch_user(s: AsyncSession, user_id: str, fields: dict) -> bool:
    u = await s.get(User, user_id)
    if not u:
        return False
    if fields.get("role") in ("hoc_vien", "mc", "admin"):
        u.role = fields["role"]
    if isinstance(fields.get("display_name"), str):
        u.display_name = fields["display_name"]
    if "mc_title" in fields:
        u.mc_title = fields["mc_title"] or None
    if isinstance(fields.get("password"), str) and fields["password"]:
        u.password_hash = hash_password(fields["password"])
    await s.commit()
    return True


async def admin_grant(s: AsyncSession, user_id: str, tickets_delta: int = 0,
                      xp_delta: int = 0, streak_set: int | None = None) -> dict | None:
    """Pha C — chỉnh vé/XP/streak (CSKH). Không âm hoá."""
    prog = await s.get(Progress, user_id)
    if not prog:
        return None
    prog.tickets = max(0, prog.tickets + tickets_delta)
    prog.xp = max(0, prog.xp + xp_delta)
    if streak_set is not None and streak_set >= 0:
        prog.streak = streak_set
    await s.commit()
    return {"tickets": prog.tickets, "xp": prog.xp, "streak": prog.streak}


# ===== Admin Pha C — Vận hành review (SLA 72h, AD-6) =====

SLA_HOURS = 72


async def admin_list_reviews(s: AsyncSession, status: str = "all") -> list[dict]:
    stmt = select(ReviewRequest).order_by(ReviewRequest.created_at.desc()).limit(200)
    if status in ("pending", "submitted", "expired"):
        stmt = stmt.where(ReviewRequest.status == status)
    reqs = (await s.execute(stmt)).scalars().all()
    now = datetime.now(timezone.utc)
    out = []
    for r in reqs:
        hv = await s.get(User, r.hoc_vien_id)
        mc = await s.get(User, r.mc_id) if r.mc_id else None
        clip = await s.get(Clip, r.clip_id)
        score = (await s.execute(select(Score).where(Score.clip_id == r.clip_id))).scalar_one_or_none()
        review = (await s.execute(select(MCReview).where(MCReview.request_id == r.id))).scalar_one_or_none()
        created = r.created_at if r.created_at.tzinfo else r.created_at.replace(tzinfo=timezone.utc)
        age_h = round((now - created).total_seconds() / 3600, 1)
        out.append({
            "id": r.id, "status": r.status, "created_at": r.created_at.isoformat(), "age_hours": age_h,
            "overdue": r.status == "pending" and age_h > SLA_HOURS,
            "hoc_vien": (hv.display_name or hv.email) if hv else "?",
            "mc": (mc.display_name or mc.email) if mc else None,
            "clip_url": f"/media/{clip.audio_path}" if clip and clip.audio_path else None,
            "voice_url": f"/media/{review.audio_path}" if review and review.audio_path else None,
            "note": review.note if review else None,
            "speed_wpm": score.speed_wpm if score else None,
            "filler_count": score.filler_count if score else None,
        })
    return out


async def admin_refund_review(s: AsyncSession, request_id: str) -> bool:
    """Hoàn vé thủ công: yêu cầu pending → expired + trả 1 Vé Vàng cho học viên (AD-6)."""
    r = await s.get(ReviewRequest, request_id)
    if not r or r.status != "pending":
        return False
    r.status = "expired"
    prog = await s.get(Progress, r.hoc_vien_id)
    if prog:
        prog.tickets += 1
    await s.commit()
    return True


# ===== Pha D — Nhật ký thao tác + Xuất/Nhập JSON =====

async def log_action(s: AsyncSession, admin_id: str, action: str, entity: str,
                     entity_id: str = "", detail: dict | None = None) -> None:
    """Append-only. Gọi SAU khi thao tác thành công."""
    s.add(AuditLog(admin_id=admin_id, action=action, entity=entity, entity_id=entity_id, detail=detail))
    await s.commit()


async def admin_audit(s: AsyncSession, limit: int = 100) -> list[dict]:
    rows = (await s.execute(select(AuditLog).order_by(AuditLog.at.desc()).limit(limit))).scalars().all()
    out = []
    for r in rows:
        admin = await s.get(User, r.admin_id)
        out.append({"id": r.id, "admin": (admin.display_name or admin.email) if admin else "?",
                    "action": r.action, "entity": r.entity, "entity_id": r.entity_id,
                    "detail": r.detail, "at": r.at.isoformat()})
    return out


EXPORT_FORMAT = "mcup-path-v1"


async def export_path(s: AsyncSession, path_id: str) -> dict | None:
    """Xuất cả cây thành JSON di động (backup / chuyển môi trường). Không kèm id/status."""
    tree = await get_path_tree(s, path_id)
    if not tree:
        return None
    return {
        "format": EXPORT_FORMAT,
        "genre": tree["genre"],
        "title": tree["title"],
        "levels": [{
            "name": lv["name"],
            "sessions": [{
                "title": cs["title"],
                "lessons": [{"title": ln["title"], "tip": ln["tip"], "prompt": ln["prompt"],
                             "brief": ln["brief"]} for ln in cs["lessons"]],
            } for cs in lv["sessions"]],
        } for lv in tree["levels"]],
    }


async def import_path(s: AsyncSession, data: dict) -> str | None:
    """Nhập JSON (đúng format export) → cây MỚI, LUÔN DRAFT (AD-12) — duyệt rồi publish."""
    if data.get("format") != EXPORT_FORMAT or not isinstance(data.get("levels"), list):
        return None
    genre = await admin_create_genre(s, str(data.get("genre") or "Chưa phân loại"))
    path = LearningPath(genre_id=genre.id, title=str(data.get("title") or "Lộ trình nhập"), status="draft")
    s.add(path)
    await s.flush()
    for li, lv in enumerate(data["levels"]):
        level = Level(path_id=path.id, name=str(lv.get("name") or "Cơ bản"), order_index=li, status="draft")
        s.add(level)
        await s.flush()
        for si, cs in enumerate(lv.get("sessions") or []):
            sess = ContentSession(level_id=level.id, title=str(cs.get("title") or "Buổi"),
                                  order_index=si, status="draft")
            s.add(sess)
            await s.flush()
            for ci, ln in enumerate(cs.get("lessons") or []):
                brief = ln.get("brief") if isinstance(ln.get("brief"), dict) else None
                s.add(ContentLesson(session_id=sess.id, title=str(ln.get("title") or "Bài"),
                                    tip=str(ln.get("tip") or ""), prompt=str(ln.get("prompt") or ""),
                                    brief=brief, order_index=ci, status="draft"))
    await s.commit()
    return path.id


# ===== Admin Pha C — Dashboard =====

async def admin_metrics(s: AsyncSession) -> dict:
    async def _one(stmt):
        return (await s.execute(stmt)).scalar() or 0

    total_users = await _one(select(func.count(User.id)).where(User.role == "hoc_vien"))
    guests = await _one(select(func.count(User.id)).where(User.email.like(f"%{_GUEST_DOMAIN}")))
    mcs = await _one(select(func.count(User.id)).where(User.role == "mc"))
    clips_total = await _one(select(func.count(Clip.id)))
    today = date.today().isoformat()
    clips_today = await _one(select(func.count(Clip.id)).where(func.date(Clip.created_at) == today))
    pending = await _one(select(func.count(ReviewRequest.id)).where(ReviewRequest.status == "pending"))
    reviews = await admin_list_reviews(s, "pending")
    overdue = sum(1 for r in reviews if r["overdue"])
    tickets_out = await _one(select(func.coalesce(func.sum(Progress.tickets), 0)))
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    filler_avg = (await s.execute(
        select(func.avg(Score.filler_count)).where(func.date(Score.created_at) >= week_ago))).scalar()
    real_7d = await _one(select(func.count(Score.id)).where(
        func.date(Score.created_at) >= week_ago, Score.is_mock == False))  # noqa: E712
    all_7d = await _one(select(func.count(Score.id)).where(func.date(Score.created_at) >= week_ago))

    days = [(date.today() - timedelta(days=i)).isoformat() for i in range(13, -1, -1)]
    clip_rows = dict((await s.execute(
        select(func.date(Clip.created_at), func.count(Clip.id))
        .where(func.date(Clip.created_at) >= days[0]).group_by(func.date(Clip.created_at)))).all())
    user_rows = dict((await s.execute(
        select(func.date(User.created_at), func.count(User.id))
        .where(func.date(User.created_at) >= days[0]).group_by(func.date(User.created_at)))).all())
    return {
        "hoc_vien": total_users, "guests": guests, "mcs": mcs,
        "clips_total": clips_total, "clips_today": clips_today,
        "reviews_pending": pending, "reviews_overdue": overdue,
        "tickets_outstanding": tickets_out,
        "filler_avg_7d": round(filler_avg, 1) if filler_avg is not None else None,
        "real_asr_ratio_7d": round(real_7d / all_7d, 2) if all_7d else None,
        "by_day": [{"d": d, "clips": clip_rows.get(d, 0), "users": user_rows.get(d, 0)} for d in days],
    }


async def get_content_lessons_for_user(s: AsyncSession, path_id: str, user_id: str) -> list[dict]:
    """Bài PUBLISHED của một lộ trình, phẳng + unlocked/done theo user (FR-19).
    Kèm Thẻ nhiệm vụ (brief) + tiêu chí đạt sinh từ rubric thể loại (FR-15)."""
    path = await s.get(LearningPath, path_id)
    genre = await s.get(Genre, path.genre_id) if path else None
    criteria = criteria_for(await effective_rubric(s, genre.name if genre else None))
    levels = (await s.execute(select(Level).where(Level.path_id == path_id, Level.status == "published").order_by(Level.order_index))).scalars().all()
    flat = []
    buoi_no = 0  # số buổi TOÀN CỤC qua các cấp độ (Cơ bản → Trung cấp → Nâng cao)
    for lv in levels:
        sessions = (await s.execute(select(ContentSession).where(ContentSession.level_id == lv.id, ContentSession.status == "published").order_by(ContentSession.order_index))).scalars().all()
        for cs in sessions:
            buoi_no += 1
            lessons = (await s.execute(select(ContentLesson).where(ContentLesson.session_id == cs.id, ContentLesson.status == "published").order_by(ContentLesson.order_index))).scalars().all()
            for ln in lessons:
                flat.append((ln, buoi_no))
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
