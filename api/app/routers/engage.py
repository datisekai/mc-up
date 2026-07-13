"""Router bộ máy giữ chân: nhiệm vụ ngày · giải đấu tuần · xu/shop · showreel · chứng nhận · ôn bài yếu."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session
from ..deps import current_user
from ..models import (Clip, ContentLesson, ContentSession, Genre, LearningPath,
                      Level, Progress, Score, User)
from ..retention import claim_quest, daily_quests, league_board
from ..security import sign_media
from ..services import utc_day_start

router = APIRouter(tags=["engage"])


# ===== Nhiệm vụ ngày (A2) =====
@router.get("/me/quests")
async def get_quests(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    prog = await session.get(Progress, user.id)
    out = await daily_quests(session, user, prog)
    await session.commit()
    return out


class ClaimIn(BaseModel):
    quest_id: str


@router.post("/me/quests/claim")
async def post_claim(body: ClaimIn, user: User = Depends(current_user),
                     session: AsyncSession = Depends(get_session)):
    prog = await session.get(Progress, user.id)
    res = await claim_quest(session, user, prog, body.quest_id)
    await session.commit()
    return res


# ===== Giải đấu tuần (A4) =====
@router.get("/me/league")
async def get_league(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    prog = await session.get(Progress, user.id)
    out = await league_board(session, user, prog)
    await session.commit()
    return out


# ===== Xu / Shop (B1 mở rộng) — trợ giúp + trang trí linh vật Misa =====
# kind: "powerup" (tiêu hao, mua nhiều lần) · "color" (đổi màu Misa) · "outfit" (phụ kiện)
POWERUPS = [
    {"id": "freeze", "kind": "powerup", "label": "Băng giữ streak", "desc": "Giữ chuỗi khi lỡ 1 ngày", "cost": 50, "icon": "freeze"},
    {"id": "energy", "kind": "powerup", "label": "Đổ đầy năng lượng", "desc": "Học tiếp ngay không chờ", "cost": 40, "icon": "bolt"},
]
# màu thân Misa — coral là mặc định miễn phí (đã sở hữu sẵn)
COLORS = [
    {"id": "coral", "kind": "color", "label": "San hô", "cost": 0, "color": "#FF6B5B"},
    {"id": "mint", "kind": "color", "label": "Bạc hà", "cost": 80, "color": "#3FB984"},
    {"id": "sky", "kind": "color", "label": "Trời xanh", "cost": 80, "color": "#5AA9E6"},
    {"id": "grape", "kind": "color", "label": "Nho tím", "cost": 120, "color": "#9B6FD4"},
    {"id": "gold", "kind": "color", "label": "Hoàng kim", "cost": 200, "color": "#F5B841"},
    {"id": "rose", "kind": "color", "label": "Hồng đào", "cost": 120, "color": "#F48AB0"},
]
# phụ kiện đội/mặc cho Misa
OUTFITS = [
    {"id": "bowtie", "kind": "outfit", "label": "Nơ cổ", "desc": "Lịch lãm dẫn tiệc", "cost": 60, "icon": "outfit"},
    {"id": "tophat", "kind": "outfit", "label": "Mũ chóp", "desc": "Quý ông sân khấu", "cost": 100, "icon": "outfit"},
    {"id": "party", "kind": "outfit", "label": "Mũ sinh nhật", "desc": "Tiệc tùng tưng bừng", "cost": 90, "icon": "outfit"},
    {"id": "crown", "kind": "outfit", "label": "Vương miện", "desc": "Ông hoàng bà chúa MC", "cost": 250, "icon": "outfit"},
    {"id": "glasses", "kind": "outfit", "label": "Kính râm", "desc": "Ngầu như sao", "cost": 70, "icon": "outfit"},
    {"id": "headset", "kind": "outfit", "label": "Tai nghe", "desc": "MC livestream", "cost": 80, "icon": "outfit"},
    {"id": "scarf", "kind": "outfit", "label": "Khăn quàng", "desc": "Ấm áp phong cách", "cost": 90, "icon": "outfit"},
]
ALL_ITEMS = {x["id"]: x for x in POWERUPS + COLORS + OUTFITS}


def _owned(prog: Progress, item_id: str) -> bool:
    if item_id == "coral":  # màu mặc định luôn có
        return True
    return bool((prog.owned_cosmetics or {}).get(item_id))


@router.get("/shop")
async def get_shop(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    prog = await session.get(Progress, user.id)

    def deco(x):
        return {**x, "owned": _owned(prog, x["id"]),
                "equipped": (x["kind"] == "color" and prog.misa_color == x["id"])
                or (x["kind"] == "outfit" and prog.misa_outfit == x["id"])}
    return {
        "coins": prog.coins,
        "misa_color": prog.misa_color, "misa_outfit": prog.misa_outfit,
        "powerups": POWERUPS,
        "colors": [deco(x) for x in COLORS],
        "outfits": [deco(x) for x in OUTFITS],
    }


class BuyIn(BaseModel):
    item_id: str


@router.post("/shop/buy")
async def buy(body: BuyIn, user: User = Depends(current_user),
              session: AsyncSession = Depends(get_session)):
    prog = await session.get(Progress, user.id)
    item = ALL_ITEMS.get(body.item_id)
    if not item:
        raise HTTPException(404, {"error": {"code": "no_item", "message": "Không có món này"}})
    # cosmetic đã sở hữu → mua = TRANG BỊ (không trừ xu lần nữa)
    if item["kind"] in ("color", "outfit") and _owned(prog, body.item_id):
        _equip(prog, item)
        await session.commit()
        return {"ok": True, "coins": prog.coins, "equipped": body.item_id}
    if prog.coins < item["cost"]:
        raise HTTPException(400, {"error": {"code": "not_enough", "message": "Chưa đủ xu — luyện thêm nhé!"}})
    prog.coins -= item["cost"]
    if item["kind"] == "powerup":
        if body.item_id == "freeze":
            prog.streak_freezes = min(prog.streak_freezes + 1, 5)
        elif body.item_id == "energy":
            from datetime import datetime, timezone
            prog.energy = settings.energy_max
            prog.energy_at = datetime.now(timezone.utc)
    else:  # color/outfit: ghi sở hữu rồi trang bị luôn
        prog.owned_cosmetics = {**(prog.owned_cosmetics or {}), body.item_id: True}
        _equip(prog, item)
    await session.commit()
    return {"ok": True, "coins": prog.coins}


class EquipIn(BaseModel):
    item_id: str
    kind: str  # "color" | "outfit" | "outfit_off"


@router.post("/shop/equip")
async def equip(body: EquipIn, user: User = Depends(current_user),
                session: AsyncSession = Depends(get_session)):
    prog = await session.get(Progress, user.id)
    if body.kind == "outfit_off":
        prog.misa_outfit = None
    else:
        item = ALL_ITEMS.get(body.item_id)
        if not item or not _owned(prog, body.item_id):
            raise HTTPException(400, {"error": {"code": "not_owned", "message": "Bạn chưa có món này"}})
        _equip(prog, item)
    await session.commit()
    return {"ok": True, "misa_color": prog.misa_color, "misa_outfit": prog.misa_outfit}


def _equip(prog: Progress, item: dict) -> None:
    if item["kind"] == "color":
        prog.misa_color = item["id"]
    elif item["kind"] == "outfit":
        prog.misa_outfit = item["id"]


# ===== Showreel (C1): clip ĐẠT điểm cao gom lại, chia sẻ =====
@router.get("/me/showreel")
async def showreel(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(Clip, Score, ContentLesson.title)
        .join(Score, Score.clip_id == Clip.id)
        .join(ContentLesson, ContentLesson.id == Clip.content_lesson_id, isouter=True)
        .where(Clip.user_id == user.id, Score.passed == True,  # noqa: E712
               Clip.audio_path.is_not(None))
        .order_by(Score.created_at.desc()).limit(12))).all()
    clips = [{
        "clip_id": c.id,
        "title": title or "Bài luyện",
        "audio_url": sign_media(c.audio_path) if c.audio_path else None,
        "wpm": sc.speed_wpm, "fillers": sc.filler_count,
        "created_at": sc.created_at.isoformat(),
    } for c, sc, title in rows if c.audio_path]
    total = (await session.execute(select(func.count(Score.id)).join(Clip, Clip.id == Score.clip_id)
             .where(Clip.user_id == user.id, Score.passed == True))).scalar() or 0  # noqa: E712
    return {"clips": clips, "total_passed": total}


# ===== Chứng nhận (C3): lộ trình đã hoàn thành 100% =====
@router.get("/me/certificates")
async def certificates(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    # đếm bài đạt theo từng lộ trình published
    done_ids = set((await session.execute(
        select(Clip.content_lesson_id).join(Score, Score.clip_id == Clip.id)
        .where(Clip.user_id == user.id, Score.passed == True))).scalars().all())  # noqa: E712
    paths = (await session.execute(select(LearningPath).join(Genre, Genre.id == LearningPath.genre_id))).scalars().all()
    out = []
    for p in paths:
        lesson_ids = (await session.execute(
            select(ContentLesson.id).join(ContentSession, ContentSession.id == ContentLesson.session_id)
            .join(Level, Level.id == ContentSession.level_id)
            .where(Level.path_id == p.id, ContentLesson.status == "published"))).scalars().all()
        if not lesson_ids:
            continue
        got = sum(1 for lid in lesson_ids if lid in done_ids)
        genre = await session.get(Genre, p.genre_id)
        out.append({"path_id": p.id, "genre": genre.name if genre else "",
                    "title": p.title, "done": got, "total": len(lesson_ids),
                    "earned": got >= len(lesson_ids)})
    return {"certificates": out}


# ===== Ôn bài yếu (D1): bài đã RỚT hoặc điểm thấp cần luyện lại =====
@router.get("/me/weak")
async def weak(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    # bài từng rớt HOẶC nhiều từ đệm — gom bài (mới nhất mỗi bài)
    rows = (await session.execute(
        select(Clip.content_lesson_id, Score.passed, Score.filler_count, ContentLesson.title)
        .join(Score, Score.clip_id == Clip.id)
        .join(ContentLesson, ContentLesson.id == Clip.content_lesson_id)
        .where(Clip.user_id == user.id, Clip.content_lesson_id.is_not(None))
        .order_by(Score.created_at.desc()))).all()
    seen, weak_list = set(), []
    for lid, passed, fillers, title in rows:
        if lid in seen:
            continue
        seen.add(lid)
        if passed is False or (fillers or 0) >= 3:
            weak_list.append({"lesson_id": lid, "title": title,
                              "reason": "chưa đạt" if passed is False else "nhiều từ đệm"})
    return {"weak": weak_list[:10]}


# ===== Thử thách MC tuần (C2) =====
from datetime import timedelta  # noqa: E402
from fastapi import File, UploadFile  # noqa: E402
from ..media import media  # noqa: E402
from ..models import ChallengeEntry, WeeklyChallenge  # noqa: E402


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


async def _current_challenge(session: AsyncSession) -> WeeklyChallenge | None:
    wk = _monday(date.today())
    ch = (await session.execute(select(WeeklyChallenge).where(WeeklyChallenge.week_start == wk))).scalar_one_or_none()
    if ch:
        return ch
    # tự tạo thử thách tuần từ ngân hàng chủ đề (xoay vòng) — không cần admin cho V1
    THEMES = [
        ("Lời chào mở màn ấn tượng", "Hãy mở đầu một sự kiện bằng 3 câu khiến khán giả im lặng lắng nghe."),
        ("Giới thiệu cô dâu chú rể", "Dẫn màn ra mắt cô dâu chú rể trong tiệc cưới — ấm áp, trang trọng."),
        ("Chữa cháy sân khấu", "Sự cố mất điện 10 giây! Hãy nói gì đó để giữ không khí."),
        ("Trao giải & vinh danh", "Xướng tên và mời một người lên nhận giải thưởng cao quý."),
    ]
    idx = (wk.toordinal() // 7) % len(THEMES)
    title, prompt = THEMES[idx]
    ch = WeeklyChallenge(week_start=wk, title=title, prompt=prompt, status="open")
    session.add(ch)
    await session.commit()
    return ch


@router.get("/challenge")
async def get_challenge(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    ch = await _current_challenge(session)
    entries = (await session.execute(
        select(ChallengeEntry, User.display_name).join(User, User.id == ChallengeEntry.user_id)
        .where(ChallengeEntry.challenge_id == ch.id)
        .order_by(ChallengeEntry.award.is_(None), ChallengeEntry.likes.desc(), ChallengeEntry.created_at.desc())
        .limit(20))).all()
    mine = next((e for e, _ in entries if e.user_id == user.id), None)
    return {
        "id": ch.id, "title": ch.title, "prompt": ch.prompt, "status": ch.status,
        "my_entry": bool(mine),
        "entries": [{
            "id": e.id, "name": name or "Học viên", "likes": e.likes, "award": e.award,
            "audio_url": sign_media(e.audio_key), "is_me": e.user_id == user.id,
        } for e, name in entries],
    }


@router.post("/challenge/submit")
async def submit_challenge(file: UploadFile = File(...), user: User = Depends(current_user),
                           session: AsyncSession = Depends(get_session)):
    ch = await _current_challenge(session)
    old = (await session.execute(select(ChallengeEntry).where(
        ChallengeEntry.challenge_id == ch.id, ChallengeEntry.user_id == user.id))).scalar_one_or_none()
    data = await file.read()
    if not data:
        raise HTTPException(400, {"error": {"code": "empty", "message": "Clip rỗng"}})
    ext = (file.filename or "ch.m4a").split(".")[-1]
    key = f"challenge-{ch.id}-{user.id}.{ext}"
    await media.put(key, data, file.content_type or "audio/m4a")
    if old:
        old.audio_key = key  # nộp lại đè bản cũ
    else:
        session.add(ChallengeEntry(challenge_id=ch.id, user_id=user.id, audio_key=key))
    await session.commit()
    return {"ok": True}


@router.post("/challenge/like/{entry_id}")
async def like_entry(entry_id: str, user: User = Depends(current_user),
                     session: AsyncSession = Depends(get_session)):
    e = await session.get(ChallengeEntry, entry_id)
    if not e:
        raise HTTPException(404, {"error": {"code": "no_entry", "message": "Không thấy bài dự thi"}})
    e.likes += 1
    await session.commit()
    return {"ok": True, "likes": e.likes}


# ===== Referral (mời bạn) =====
from ..retention import ensure_ref_code, REF_REFERRER_COINS, REF_REFEREE_COINS  # noqa: E402


@router.get("/me/referral")
async def my_referral(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    code = ensure_ref_code(user)
    await session.commit()
    # đếm số người mình đã mời + đã tính thưởng
    invited = (await session.execute(
        select(func.count(User.id)).where(User.referred_by == user.id))).scalar() or 0
    rewarded = (await session.execute(
        select(func.count(Progress.user_id)).join(User, User.id == Progress.user_id)
        .where(User.referred_by == user.id, Progress.ref_rewarded == True))).scalar() or 0  # noqa: E712
    return {
        "code": code,
        "share_url": f"https://mcup.fun/m/{code}",
        "invited": invited,
        "rewarded": rewarded,
        "coins_earned": rewarded * REF_REFERRER_COINS,
        "referrer_reward": REF_REFERRER_COINS,
        "referee_reward": REF_REFEREE_COINS,
    }
