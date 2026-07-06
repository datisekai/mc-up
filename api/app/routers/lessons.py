from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..deps import current_user
from ..models import Clip, Lesson, Score, User
from ..rubrics import criteria_for, get_rubric
from ..schemas import LessonOut

router = APIRouter(tags=["lessons"])


@router.get("/lessons", response_model=list[LessonOut])
async def list_lessons(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    lessons = (await session.execute(select(Lesson).order_by(Lesson.order_index))).scalars().all()

    # bài đã 'done' = có clip đã chấm xong (FR-1)
    done_rows = (await session.execute(
        select(Clip.lesson_id).join(Score, Score.clip_id == Clip.id).where(Clip.user_id == user.id)
    )).scalars().all()
    done_ids = set(done_rows)

    criteria = criteria_for(get_rubric(None))  # bài v1 dùng rubric lõi (FR-15)
    out: list[LessonOut] = []
    prev_done = True  # bài đầu luôn mở
    for les in lessons:
        unlocked = prev_done
        is_done = les.id in done_ids
        out.append(LessonOut(
            id=les.id, buoi=les.buoi, order_index=les.order_index, title=les.title,
            tip=les.tip, prompt=les.prompt, brief=les.brief, criteria=criteria,
            xp=les.xp, unlocked=unlocked, done=is_done,
        ))
        prev_done = is_done  # bài kế mở khi bài này xong
    return out
