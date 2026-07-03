from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..deps import current_user
from ..models import User
from ..schemas import Achievement, ScorePoint
from ..services import get_achievements, get_score_history

router = APIRouter(tags=["stats"])


@router.get("/me/achievements", response_model=list[Achievement])
async def achievements(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await get_achievements(session, user)


@router.get("/me/scores", response_model=list[ScorePoint])
async def scores(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await get_score_history(session, user)
