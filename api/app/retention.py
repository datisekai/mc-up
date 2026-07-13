"""Bộ máy giữ chân (2026-07-13): giải đấu tuần · nhiệm vụ ngày · băng streak · xu.

Nguyên tắc: **lazy reset** — không cần cron. Mọi mốc tuần/ngày được kiểm & reset
ngay khi đọc snapshot, nên chỉ cần user mở app là dữ liệu tự đúng.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Clip, Progress, Score, User

# ===== Giải đấu tuần =====
LEAGUES = ["Đồng", "Bạc", "Vàng", "Bạch kim", "Kim cương"]
PROMOTE_TOP = 5      # top N mỗi liên đoàn được thăng hạng
RELEGATE_BOTTOM = 5  # đáy N bị xuống hạng
LEAGUE_SIZE = 30     # số người/liên đoàn (theo hạng, ghép ảo)


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


async def sync_week(s: AsyncSession, prog: Progress) -> None:
    """Sang tuần mới → chốt hạng tuần trước (thăng/xuống) rồi reset league_xp về 0.
    Gọi trước mọi thao tác đọc/ghi liên quan giải đấu."""
    this_mon = _monday(date.today())
    if prog.week_start == this_mon:
        return
    if prog.week_start is not None:
        # chốt tuần trước: xếp hạng trong cùng league_tier theo league_xp
        rank = (await s.execute(
            select(func.count(Progress.user_id)).where(
                Progress.league_tier == prog.league_tier,
                Progress.league_xp > prog.league_xp,
                Progress.week_start == prog.week_start,
            ))).scalar() or 0
        rank += 1  # 1-based
        total = (await s.execute(
            select(func.count(Progress.user_id)).where(
                Progress.league_tier == prog.league_tier,
                Progress.week_start == prog.week_start,
            ))).scalar() or 1
        if prog.league_xp > 0:
            if rank <= PROMOTE_TOP and prog.league_tier < len(LEAGUES) - 1:
                prog.league_tier += 1
            elif rank > total - RELEGATE_BOTTOM and prog.league_tier > 0:
                prog.league_tier -= 1
    prog.week_start = this_mon
    prog.league_xp = 0


async def add_league_xp(s: AsyncSession, prog: Progress, amount: int) -> None:
    await sync_week(s, prog)
    prog.league_xp += amount


async def league_board(s: AsyncSession, me: User, my_prog: Progress) -> dict:
    """BXH liên đoàn của user: cùng league_tier, cùng tuần, top theo league_xp."""
    await sync_week(s, my_prog)
    rows = (await s.execute(
        select(Progress, User.display_name).join(User, User.id == Progress.user_id)
        .where(Progress.league_tier == my_prog.league_tier, Progress.week_start == my_prog.week_start,
               User.role == "hoc_vien")
        .order_by(Progress.league_xp.desc(), Progress.xp.desc()).limit(LEAGUE_SIZE)
    )).all()
    entries = [{
        "rank": i + 1,
        "name": name or "Học viên",
        "league_xp": p.league_xp,
        "is_me": p.user_id == me.id,
        "promote": i < PROMOTE_TOP,
    } for i, (p, name) in enumerate(rows)]
    return {"tier": my_prog.league_tier, "tier_name": LEAGUES[my_prog.league_tier], "entries": entries}


# ===== Nhiệm vụ hằng ngày =====
# Mỗi quest: id, nhãn, mục tiêu, thưởng xu. Tiến độ tính từ dữ liệu ngày (không cần bảng riêng).
QUESTS = [
    {"id": "practice2", "label": "Luyện 2 bài hôm nay", "target": 2, "coins": 15},
    {"id": "clean1", "label": "Đạt 1 bài không quá 1 từ đệm", "target": 1, "coins": 20},
    {"id": "listen1", "label": "Hoàn thành 1 bài đạt", "target": 1, "coins": 10},
]


async def daily_quests(s: AsyncSession, user: User, prog: Progress) -> dict:
    """Trạng thái nhiệm vụ hôm nay: tiến độ + đã nhận thưởng chưa (lazy reset theo ngày)."""
    today = date.today()
    if prog.quests_day != today:
        prog.quests_day = today
        prog.quests_claimed = {}
    start = _utc_start(today)
    # đếm clip + bài đạt hôm nay
    from .services import utc_day_start  # tránh vòng import ở top
    start = utc_day_start(today)
    n_clip = (await s.execute(select(func.count(Clip.id)).where(
        Clip.user_id == user.id, Clip.created_at >= start))).scalar() or 0
    passed_rows = (await s.execute(
        select(Score.filler_count).join(Clip, Clip.id == Score.clip_id)
        .where(Clip.user_id == user.id, Clip.created_at >= start, Score.passed == True))).scalars().all()  # noqa: E712
    n_passed = len(passed_rows)
    n_clean = sum(1 for f in passed_rows if (f or 0) <= 1)
    prog_map = {"practice2": n_clip, "clean1": n_clean, "listen1": n_passed}
    claimed = prog.quests_claimed or {}
    out = []
    for q in QUESTS:
        cur = min(prog_map.get(q["id"], 0), q["target"])
        out.append({**q, "progress": cur, "done": cur >= q["target"],
                    "claimed": bool(claimed.get(q["id"]))})
    return {"quests": out, "all_claimed": all(x["claimed"] for x in out)}


async def claim_quest(s: AsyncSession, user: User, prog: Progress, quest_id: str) -> dict:
    """Nhận thưởng 1 quest đã hoàn thành → cộng xu. Idempotent."""
    st = await daily_quests(s, user, prog)
    q = next((x for x in st["quests"] if x["id"] == quest_id), None)
    if not q or not q["done"] or q["claimed"]:
        return {"ok": False, "coins": prog.coins}
    prog.quests_claimed = {**(prog.quests_claimed or {}), quest_id: True}
    prog.coins += q["coins"]
    return {"ok": True, "coins": prog.coins, "reward": q["coins"]}


def _utc_start(d: date):  # shim để tránh import sớm
    from .services import utc_day_start
    return utc_day_start(d)


def retention_snapshot(prog: Progress) -> dict:
    """Phần thêm cho ProgressOut: xu, băng streak, hạng giải đấu."""
    return {
        "coins": prog.coins,
        "streak_freezes": prog.streak_freezes,
        "league_tier": prog.league_tier,
        "league_name": LEAGUES[min(prog.league_tier, len(LEAGUES) - 1)],
        "misa_color": prog.misa_color,
        "misa_outfit": prog.misa_outfit,
    }
