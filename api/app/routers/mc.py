from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..deps import current_user
from ..models import BadgeCard, Clip, MCReview, Progress, ReviewRequest, Score, User
from ..schemas import BadgeOut, MCQueueItemOut, SubmitReviewIn

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

    req.mc_id = user.id
    req.status = "submitted"
    review = MCReview(request_id=req.id, mc_id=user.id, note=body.note)
    session.add(review)
    await session.flush()
    # tự sinh Thẻ bảo chứng (FR-11)
    badge = BadgeCard(review_id=review.id, hoc_vien_id=req.hoc_vien_id,
                      mc_name=user.display_name or "MC", mc_title=user.mc_title, note=body.note)
    session.add(badge)
    await session.commit()
    return BadgeOut(mc_name=badge.mc_name, mc_title=badge.mc_title, note=badge.note)
