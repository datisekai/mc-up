import sys
from datetime import date, timedelta
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import SessionLocal, get_session
from ..deps import current_user
from ..models import Clip, Lesson, Progress, Score, User
from ..schemas import ClipOut, ProgressOut, ScoreOut, SubmitClipIn
from ..scoring import score_clip

sys.path.append(str(Path(__file__).resolve().parents[4] / "mcup"))
from adapters.media_local import LocalMediaStore  # type: ignore  # noqa: E402

_media = LocalMediaStore(settings.upload_dir)  # AD-4: đổi sang MinIO/S3 khi deploy

router = APIRouter(tags=["practice"])


async def _run_scoring(clip_id: str, user_id: str, duration: float, lesson_xp: int):
    """Pipeline chấm bất đồng bộ (AD-1): queued -> processing -> done."""
    async with SessionLocal() as s:
        clip = await s.get(Clip, clip_id)
        clip.status = "processing"
        await s.commit()

        result = await score_clip(clip_id, duration, audio_path=clip.audio_path)
        s.add(Score(clip_id=clip_id, **result))

        # Cập nhật streak/XP (server sở hữu — AD-3)
        prog = await s.get(Progress, user_id)
        today = date.today()
        if prog.last_day != today:  # idempotent theo ngày (AD-3)
            if prog.last_day == today - timedelta(days=1):
                prog.streak += 1
            else:
                prog.streak = 1
            prog.last_day = today
        prog.xp += lesson_xp
        prog.tickets += 1  # [DEMO] tặng 1 Vé Vàng mỗi lần hoàn thành để dễ xem; thật = theo mốc XP

        clip.status = "done"
        await s.commit()


@router.post("/practice/submit", response_model=ClipOut)
async def submit(body: SubmitClipIn, bg: BackgroundTasks,
                 user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    lesson = await session.get(Lesson, body.lesson_id)
    if not lesson:
        raise HTTPException(404, {"error": {"code": "no_lesson", "message": "Không tìm thấy bài học"}})

    clip = Clip(user_id=user.id, lesson_id=lesson.id, duration_seconds=body.duration_seconds, status="queued")
    session.add(clip)
    await session.commit()

    bg.add_task(_run_scoring, clip.id, user.id, body.duration_seconds, lesson.xp)
    return ClipOut(id=clip.id, lesson_id=lesson.id, status=clip.status, score=None)


@router.post("/practice/submit-audio", response_model=ClipOut)
async def submit_audio(bg: BackgroundTasks, lesson_id: str = Form(...),
                       duration_seconds: float = Form(60.0), file: UploadFile = File(...),
                       user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Nộp bài KÈM clip audio thật (Story 3.2). Lưu qua MediaStore rồi chấm.
    Có OPENAI/Google/Viettel key → chấm ASR thật; không thì giả lập."""
    lesson = await session.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, {"error": {"code": "no_lesson", "message": "Không tìm thấy bài học"}})

    clip = Clip(user_id=user.id, lesson_id=lesson.id, duration_seconds=duration_seconds, status="queued")
    session.add(clip)
    await session.flush()

    data = await file.read()
    if not data:
        raise HTTPException(400, {"error": {"code": "empty_audio", "message": "Clip rỗng — thu lại giúp mình nhé?"}})
    ext = (file.filename or "clip.m4a").split(".")[-1]
    clip.audio_path = await _media.put(f"{clip.id}.{ext}", data, file.content_type or "audio/m4a")  # AD-4
    await session.commit()

    bg.add_task(_run_scoring, clip.id, user.id, duration_seconds, lesson.xp)
    return ClipOut(id=clip.id, lesson_id=lesson.id, status=clip.status, score=None)


@router.get("/clips/{clip_id}", response_model=ClipOut)
async def get_clip(clip_id: str, user: User = Depends(current_user),
                   session: AsyncSession = Depends(get_session)):
    clip = await session.get(Clip, clip_id)
    if not clip or clip.user_id != user.id:
        raise HTTPException(404, {"error": {"code": "no_clip", "message": "Không tìm thấy clip"}})
    score = (await session.execute(select(Score).where(Score.clip_id == clip_id))).scalar_one_or_none()
    return ClipOut(
        id=clip.id, lesson_id=clip.lesson_id, status=clip.status,
        score=ScoreOut(**{k: getattr(score, k) for k in
                          ("volume_label", "speed_wpm", "filler_count", "tip", "is_mock")}) if score else None,
    )


@router.get("/me/progress", response_model=ProgressOut)
async def my_progress(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    prog = await session.get(Progress, user.id)
    return ProgressOut(xp=prog.xp, streak=prog.streak, tickets=prog.tickets)
