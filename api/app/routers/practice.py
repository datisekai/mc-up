from datetime import date

from adapters.media_local import LocalMediaStore
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session
from ..deps import current_user
from ..models import Clip, ContentLesson, Lesson, Progress, Score, User
from ..schemas import ClipOut, ProgressOut, ScoreOut, SubmitClipIn
from ..services import run_scoring, tier_of

_media = LocalMediaStore(settings.upload_dir)  # AD-4: đổi sang MinIO/S3 khi deploy

router = APIRouter(tags=["practice"])


async def _check_quota(session: AsyncSession, user: User) -> None:
    """Quota chấm/ngày (beta hardening): mỗi lần chấm = 1 call ASR trả tiền.
    Giọng nhắc dịu — nghỉ giọng cũng là một phần của luyện."""
    if settings.daily_clip_limit <= 0:
        return
    n = (await session.execute(select(func.count(Clip.id)).where(
        Clip.user_id == user.id,
        func.date(Clip.created_at) == date.today().isoformat(),
    ))).scalar() or 0
    if n >= settings.daily_clip_limit:
        raise HTTPException(429, {"error": {"code": "quota", "message":
            f"Hôm nay bạn luyện {n} lượt rồi — nghỉ giọng cho khoẻ, mai leo tiếp nhé! 💪"}})


@router.post("/practice/submit", response_model=ClipOut)
async def submit(body: SubmitClipIn, bg: BackgroundTasks,
                 user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    await _check_quota(session, user)
    if body.content_lesson_id:  # v2: bài nội dung published (FR-19)
        cl = await session.get(ContentLesson, body.content_lesson_id)
        if not cl:
            raise HTTPException(404, {"error": {"code": "no_lesson", "message": "Không tìm thấy bài học"}})
        clip = Clip(user_id=user.id, content_lesson_id=cl.id, duration_seconds=body.duration_seconds, status="queued")
        xp = 10
    else:
        lesson = await session.get(Lesson, body.lesson_id)
        if not lesson:
            raise HTTPException(404, {"error": {"code": "no_lesson", "message": "Không tìm thấy bài học"}})
        clip = Clip(user_id=user.id, lesson_id=lesson.id, duration_seconds=body.duration_seconds, status="queued")
        xp = lesson.xp
    session.add(clip)
    await session.commit()

    bg.add_task(run_scoring, clip.id, user.id, body.duration_seconds, xp)
    return ClipOut(id=clip.id, lesson_id=clip.lesson_id or clip.content_lesson_id or "", status=clip.status, score=None)


@router.post("/practice/submit-audio", response_model=ClipOut)
async def submit_audio(bg: BackgroundTasks, lesson_id: str = Form(None), content_lesson_id: str = Form(None),
                       duration_seconds: float = Form(60.0), file: UploadFile = File(...),
                       user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Nộp bài KÈM clip audio thật (Story 3.2). Lưu qua MediaStore rồi chấm.
    Nhận bài v1 (lesson_id) hoặc bài nội dung published (content_lesson_id — FR-19)."""
    await _check_quota(session, user)
    if content_lesson_id:
        cl = await session.get(ContentLesson, content_lesson_id)
        if not cl:
            raise HTTPException(404, {"error": {"code": "no_lesson", "message": "Không tìm thấy bài học"}})
        clip = Clip(user_id=user.id, content_lesson_id=cl.id, duration_seconds=duration_seconds, status="queued")
        xp = 10
    else:
        lesson = await session.get(Lesson, lesson_id)
        if not lesson:
            raise HTTPException(404, {"error": {"code": "no_lesson", "message": "Không tìm thấy bài học"}})
        clip = Clip(user_id=user.id, lesson_id=lesson.id, duration_seconds=duration_seconds, status="queued")
        xp = lesson.xp
    session.add(clip)
    await session.flush()

    data = await file.read()
    if not data:
        raise HTTPException(400, {"error": {"code": "empty_audio", "message": "Clip rỗng — thu lại giúp mình nhé?"}})
    ext = (file.filename or "clip.m4a").split(".")[-1]
    clip.audio_path = await _media.put(f"{clip.id}.{ext}", data, file.content_type or "audio/m4a")  # AD-4
    await session.commit()

    bg.add_task(run_scoring, clip.id, user.id, duration_seconds, xp)
    return ClipOut(id=clip.id, lesson_id=clip.lesson_id or clip.content_lesson_id or "", status=clip.status, score=None)


@router.get("/clips/{clip_id}", response_model=ClipOut)
async def get_clip(clip_id: str, user: User = Depends(current_user),
                   session: AsyncSession = Depends(get_session)):
    clip = await session.get(Clip, clip_id)
    if not clip or clip.user_id != user.id:
        raise HTTPException(404, {"error": {"code": "no_clip", "message": "Không tìm thấy clip"}})
    score = (await session.execute(select(Score).where(Score.clip_id == clip_id))).scalar_one_or_none()
    return ClipOut(
        id=clip.id, lesson_id=clip.lesson_id or clip.content_lesson_id or "", status=clip.status,
        score=ScoreOut(**{k: getattr(score, k) for k in
                          ("volume_label", "speed_wpm", "filler_count", "tip", "is_mock", "transcript")},
                       unclear=(not score.is_mock and score.speed_wpm == 0)) if score else None,
    )


@router.get("/me/progress", response_model=ProgressOut)
async def my_progress(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    prog = await session.get(Progress, user.id)
    return ProgressOut(xp=prog.xp, streak=prog.streak, tickets=prog.tickets,
                       tier=tier_of(prog.xp), practiced_today=(prog.last_day == date.today()))
