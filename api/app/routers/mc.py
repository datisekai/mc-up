import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session
from ..deps import current_user
from ..media import media
from ..models import ReviewRequest, User
from ..schemas import BadgeOut, MCQueueItemOut, SubmitReviewIn
from ..services import mc_claim, mc_queue, mc_release, submit_mc_review, _claim_state

log = logging.getLogger("mcup.mc")


async def _transcribe_voice(key: str) -> str | None:
    """'Xem bản chữ' (a11y + nghe nơi công cộng): ASR giọng MC qua AsrPort — best-effort,
    lỗi/không có key thì bỏ qua, KHÔNG chặn luồng review."""
    try:
        from adapters.asr_factory import get_asr  # type: ignore
        asr = get_asr(settings.asr_provider, openai_key=settings.openai_api_key,
                      google_key=settings.google_stt_api_key, viettel_token=settings.viettel_stt_token)
        if getattr(asr, "is_mock", False):
            return None
        res = await asr.transcribe(audio_path=str(Path(settings.upload_dir) / key), language="vi")
        return (res.text or "").strip() or None
    except Exception as exc:
        log.warning("transcript giọng MC lỗi (%s) → bỏ qua", exc)
        return None

router = APIRouter(prefix="/mc", tags=["mc-mode"])


def _require_mc(user: User):
    if user.role != "mc":
        raise HTTPException(403, {"error": {"code": "not_mc", "message": "Cần tài khoản MC"}})


def _guard_claim(req: ReviewRequest, user: User):
    """Không cho gửi nhận xét nếu MC KHÁC đang giữ vé (feedback #4). Vé free → tự nhận khi gửi."""
    if _claim_state(req, user.id) == "taken":
        raise HTTPException(409, {"error": {"code": "taken", "message": "MC khác đang xét vé này rồi."}})


@router.get("/queue", response_model=list[MCQueueItemOut])
async def queue(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_mc(user)  # AD-7
    return [MCQueueItemOut(**it) for it in await mc_queue(session, user)]


class ClaimIn(BaseModel):
    request_id: str


@router.post("/claim")
async def claim(body: ClaimIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """MC nhận vé để xét — khoá cho mình, tránh nhiều MC xét trùng (feedback #4)."""
    _require_mc(user)
    res = await mc_claim(session, user, body.request_id)
    if res == "taken":
        raise HTTPException(409, {"error": {"code": "taken", "message": "MC khác vừa nhận vé này rồi."}})
    if res == "gone":
        raise HTTPException(404, {"error": {"code": "gone", "message": "Vé này không còn trong hàng đợi."}})
    return {"ok": True}


@router.post("/release")
async def release(body: ClaimIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Nhả vé đang giữ (đổi ý) → MC khác nhận được."""
    _require_mc(user)
    await mc_release(session, user, body.request_id)
    return {"ok": True}


@router.post("/review", response_model=BadgeOut)
async def submit_review(body: SubmitReviewIn, user: User = Depends(current_user),
                        session: AsyncSession = Depends(get_session)):
    _require_mc(user)
    req = await session.get(ReviewRequest, body.request_id)
    if not req or req.status != "pending":
        raise HTTPException(404, {"error": {"code": "no_request", "message": "Yêu cầu không hợp lệ"}})
    _guard_claim(req, user)
    badge = await submit_mc_review(session, user, req, body.note)  # phần Hồn + Thẻ bảo chứng (FR-11)
    return BadgeOut(mc_name=badge.mc_name, mc_title=badge.mc_title, note=badge.note, stats=badge.stats)


@router.post("/review-audio", response_model=BadgeOut)
async def submit_review_audio(request_id: str = Form(...), note: str = Form("Nhận xét bằng giọng"),
                              file: UploadFile = File(...), user: User = Depends(current_user),
                              session: AsyncSession = Depends(get_session)):
    """MC gửi nhận xét bằng GIỌNG THẬT (crown jewel) → lưu audio + Thẻ bảo chứng có voice."""
    _require_mc(user)
    req = await session.get(ReviewRequest, request_id)
    if not req or req.status != "pending":
        raise HTTPException(404, {"error": {"code": "no_request", "message": "Yêu cầu không hợp lệ"}})
    _guard_claim(req, user)
    data = await file.read()
    if not data:
        raise HTTPException(400, {"error": {"code": "empty_audio", "message": "Ghi âm rỗng"}})
    ext = (file.filename or "voice.m4a").split(".")[-1]
    key = f"review-{req.id}.{ext}"
    await media.put(key, data, file.content_type or "audio/m4a")  # AD-4
    transcript = await _transcribe_voice(key)
    badge = await submit_mc_review(session, user, req, note, audio_path=key, transcript=transcript)
    return BadgeOut(mc_name=badge.mc_name, mc_title=badge.mc_title, note=badge.note,
                    audio_url=f"/media/{key}", stats=badge.stats, transcript=transcript)
