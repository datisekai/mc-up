from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..deps import current_user
from ..models import ReviewRequest, Score, User
from ..schemas import BadgeOut, MCQueueItemOut, SubmitReviewIn
from ..services import submit_mc_review

router = APIRouter(prefix="/mc", tags=["mc-mode"])


def _require_mc(user: User):
    if user.role != "mc":
        raise HTTPException(403, {"error": {"code": "not_mc", "message": "Cần tài khoản MC"}})


@router.get("/queue", response_model=list[MCQueueItemOut])
async def queue(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_mc(user)  # AD-7
    reqs = (await session.execute(
        select(ReviewRequest).where(ReviewRequest.status == "pending")
        .order_by(ReviewRequest.created_at)
    )).scalars().all()
    out: list[MCQueueItemOut] = []
    for r in reqs:
        hv = await session.get(User, r.hoc_vien_id)
        score = (await session.execute(select(Score).where(Score.clip_id == r.clip_id))).scalar_one_or_none()
        out.append(MCQueueItemOut(
            request_id=r.id, hoc_vien_name=hv.display_name if hv else None,
            speed_wpm=score.speed_wpm if score else None,
            filler_count=score.filler_count if score else None,
        ))
    return out


@router.post("/review", response_model=BadgeOut)
async def submit_review(body: SubmitReviewIn, user: User = Depends(current_user),
                        session: AsyncSession = Depends(get_session)):
    _require_mc(user)
    req = await session.get(ReviewRequest, body.request_id)
    if not req or req.status != "pending":
        raise HTTPException(404, {"error": {"code": "no_request", "message": "Yêu cầu không hợp lệ"}})

    badge = await submit_mc_review(session, user, req, body.note)  # phần Hồn + Thẻ bảo chứng (FR-11)
    return BadgeOut(mc_name=badge.mc_name, mc_title=badge.mc_title, note=badge.note)
