"""Tầng service — nghiệp vụ (chấm, streak/XP, vòng đời review) tách khỏi router.

Router chỉ: nhận request → kiểm quyền/đầu vào → gọi service → trả response.
Đây là bước đưa logic ra khỏi cổng vào (xem Architecture Spine). Bước sau nếu
cần hexagonal thuần: chuyển entity xuống domain + repository.
"""
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from .db import SessionLocal
from .models import BadgeCard, Clip, MCReview, Progress, ReviewRequest, Score, User
from .scoring import score_clip


async def run_scoring(clip_id: str, user_id: str, duration: float, lesson_xp: int) -> None:
    """Pipeline chấm bất đồng bộ (AD-1) + cập nhật tiến độ server-owned (AD-3)."""
    async with SessionLocal() as s:
        clip = await s.get(Clip, clip_id)
        clip.status = "processing"
        await s.commit()

        result = await score_clip(clip_id, duration, audio_path=clip.audio_path)
        s.add(Score(clip_id=clip_id, **result))  # phần Xác, tách khỏi MCReview (AD-5)

        prog = await s.get(Progress, user_id)
        today = date.today()
        if prog.last_day != today:  # idempotent theo ngày (AD-3)
            prog.streak = prog.streak + 1 if prog.last_day == today - timedelta(days=1) else 1
            prog.last_day = today
        prog.xp += lesson_xp
        prog.tickets += 1  # [DEMO] tặng 1 Vé Vàng mỗi lần hoàn thành; thật = theo mốc XP

        clip.status = "done"
        await s.commit()


async def send_golden_ticket(s: AsyncSession, user: User, clip: Clip) -> ReviewRequest:
    """Tiêu 1 Vé Vàng → tạo yêu cầu review MC (AD-6)."""
    prog = await s.get(Progress, user.id)
    prog.tickets -= 1
    req = ReviewRequest(clip_id=clip.id, hoc_vien_id=user.id, status="pending")
    s.add(req)
    await s.commit()
    return req


async def submit_mc_review(s: AsyncSession, mc: User, req: ReviewRequest, note: str) -> BadgeCard:
    """MC gửi nhận xét (phần Hồn, AD-5) → tự sinh Thẻ bảo chứng (FR-11)."""
    req.mc_id = mc.id
    req.status = "submitted"
    review = MCReview(request_id=req.id, mc_id=mc.id, note=note)
    s.add(review)
    await s.flush()
    badge = BadgeCard(review_id=review.id, hoc_vien_id=req.hoc_vien_id,
                      mc_name=mc.display_name or "MC", mc_title=mc.mc_title, note=note)
    s.add(badge)
    await s.commit()
    return badge
