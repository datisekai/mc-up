from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..deps import current_user
from ..models import BadgeCard, Clip, MCReview, Progress, ReviewRequest, User
from ..schemas import BadgeOut, ReviewRequestOut, SendTicketIn

router = APIRouter(tags=["ve-vang"])


@router.post("/vevang/send", response_model=ReviewRequestOut)
async def send_ticket(body: SendTicketIn, user: User = Depends(current_user),
                      session: AsyncSession = Depends(get_session)):
    prog = await session.get(Progress, user.id)
    if prog.tickets < 1:
        raise HTTPException(400, {"error": {"code": "no_ticket", "message": "Bạn chưa có Vé Vàng"}})
    clip = await session.get(Clip, body.clip_id)
    if not clip or clip.user_id != user.id:
        raise HTTPException(404, {"error": {"code": "no_clip", "message": "Không tìm thấy clip"}})

    prog.tickets -= 1  # tiêu vé (AD-6)
    req = ReviewRequest(clip_id=clip.id, hoc_vien_id=user.id, status="pending")
    session.add(req)
    await session.commit()
    return ReviewRequestOut(id=req.id, clip_id=clip.id, status=req.status, badge=None)


@router.get("/me/reviews", response_model=list[ReviewRequestOut])
async def my_reviews(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    reqs = (await session.execute(
        select(ReviewRequest).where(ReviewRequest.hoc_vien_id == user.id)
        .order_by(ReviewRequest.created_at.desc())
    )).scalars().all()
    out: list[ReviewRequestOut] = []
    for r in reqs:
        badge = None
        if r.status == "submitted":
            b = (await session.execute(
                select(BadgeCard).join(MCReview, MCReview.id == BadgeCard.review_id)
                .where(MCReview.request_id == r.id)
            )).scalar_one_or_none()
            if b:
                badge = BadgeOut(mc_name=b.mc_name, mc_title=b.mc_title, note=b.note)
        out.append(ReviewRequestOut(id=r.id, clip_id=r.clip_id, status=r.status, badge=badge))
    return out
