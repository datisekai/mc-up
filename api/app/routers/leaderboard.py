from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..deps import current_user
from ..models import Progress, User
from ..schemas import LeaderboardEntry
from ..services import tier_of

router = APIRouter(tags=["leaderboard"])


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Top 20 học viên theo XP (đua nhau như giải đấu Duolingo)."""
    rows = (await session.execute(
        select(User.id, User.display_name, Progress.xp, Progress.streak)
        .join(Progress, Progress.user_id == User.id)
        .where(User.role == "hoc_vien")
        .order_by(desc(Progress.xp), desc(Progress.streak))
        .limit(20)
    )).all()
    return [
        LeaderboardEntry(rank=i + 1, name=r.display_name or "Học viên",
                         xp=r.xp, streak=r.streak, tier=tier_of(r.xp), is_me=(r.id == user.id))
        for i, r in enumerate(rows)
    ]
