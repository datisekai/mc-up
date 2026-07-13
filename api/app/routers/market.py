"""Marketplace — đặt buổi 1:1 với MC (mô hình kinh doanh: MC có thu nhập → moat).

Luồng: học viên đặt (requested) → MC xác nhận + gửi link họp (confirmed)
→ sau buổi MC/học viên đánh dấu xong (done) → học viên đánh giá.
Thanh toán V1: điều phối trực tiếp MC ↔ học viên (chuyển khoản); app quản lý lịch + trạng thái.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..deps import current_user
from ..models import Booking, MCService, User
from ..push import send_push

router = APIRouter(tags=["market"])


def _svc_out(s: MCService, mc: User | None = None) -> dict:
    return {"id": s.id, "mc_id": s.mc_id, "title": s.title, "description": s.description,
            "mode": s.mode, "duration_min": s.duration_min, "price_vnd": s.price_vnd,
            "mc_name": mc.display_name if mc else None, "mc_title": mc.mc_title if mc else None}


def _book_out(b: Booking, svc: MCService | None, other_name: str | None) -> dict:
    return {"id": b.id, "status": b.status, "note": b.note, "preferred": b.preferred,
            "scheduled_at": b.scheduled_at, "meeting_link": b.meeting_link, "price_vnd": b.price_vnd,
            "rating": b.rating, "review": b.review, "created_at": b.created_at.isoformat(),
            "service_title": svc.title if svc else "", "mode": svc.mode if svc else "live",
            "other_name": other_name}


# ===== Học viên: xem dịch vụ + đặt =====
@router.get("/market/services")
async def list_services(mc_id: str | None = None, user: User = Depends(current_user),
                        session: AsyncSession = Depends(get_session)):
    """Danh sách dịch vụ đang bán (tuỳ chọn lọc theo 1 MC)."""
    q = select(MCService, User).join(User, User.id == MCService.mc_id).where(MCService.active == True)  # noqa: E712
    if mc_id:
        q = q.where(MCService.mc_id == mc_id)
    rows = (await session.execute(q.order_by(MCService.price_vnd))).all()
    return {"services": [_svc_out(s, mc) for s, mc in rows]}


class BookIn(BaseModel):
    service_id: str
    note: str | None = None
    preferred: str | None = None


@router.post("/market/book")
async def book(body: BookIn, user: User = Depends(current_user),
               session: AsyncSession = Depends(get_session)):
    svc = await session.get(MCService, body.service_id)
    if not svc or not svc.active:
        raise HTTPException(404, {"error": {"code": "no_service", "message": "Dịch vụ không còn"}})
    b = Booking(service_id=svc.id, mc_id=svc.mc_id, student_id=user.id, status="requested",
                note=body.note, preferred=body.preferred, price_vnd=svc.price_vnd)
    session.add(b)
    await session.commit()
    mc = await session.get(User, svc.mc_id)
    if mc and mc.push_token:
        await send_push(mc.push_token, "Có người muốn đặt buổi học! 🎤",
                        f"{user.display_name or 'Một học viên'} muốn đặt \"{svc.title}\"", data={"type": "booking"})
    return {"ok": True, "booking_id": b.id}


@router.get("/me/bookings")
async def my_bookings(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(
        select(Booking, MCService, User.display_name)
        .join(MCService, MCService.id == Booking.service_id)
        .join(User, User.id == Booking.mc_id)
        .where(Booking.student_id == user.id).order_by(Booking.created_at.desc()))).all()
    return {"bookings": [_book_out(b, svc, name) for b, svc, name in rows]}


class RateIn(BaseModel):
    booking_id: str
    rating: int
    review: str | None = None


@router.post("/bookings/rate")
async def rate(body: RateIn, user: User = Depends(current_user),
               session: AsyncSession = Depends(get_session)):
    b = await session.get(Booking, body.booking_id)
    if not b or b.student_id != user.id:
        raise HTTPException(404, {"error": {"code": "no_booking", "message": "Không thấy lượt đặt"}})
    b.rating = max(1, min(5, body.rating))
    b.review = body.review
    await session.commit()
    return {"ok": True}


@router.post("/bookings/cancel")
async def cancel(body: RateIn, user: User = Depends(current_user),
                 session: AsyncSession = Depends(get_session)):
    b = await session.get(Booking, body.booking_id)
    if not b or (b.student_id != user.id and b.mc_id != user.id):
        raise HTTPException(404, {"error": {"code": "no_booking", "message": "Không thấy lượt đặt"}})
    if b.status in ("requested", "confirmed"):
        b.status = "cancelled"
        await session.commit()
    return {"ok": True}


# ===== MC: quản lý dịch vụ + booking đến =====
def _require_mc(user: User):
    if user.role != "mc":
        raise HTTPException(403, {"error": {"code": "not_mc", "message": "Chỉ MC"}})


@router.get("/mc/services")
async def mc_services(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_mc(user)
    rows = (await session.execute(select(MCService).where(MCService.mc_id == user.id).order_by(MCService.created_at))).scalars().all()
    return {"services": [{**_svc_out(s), "active": s.active} for s in rows]}


class SvcIn(BaseModel):
    id: str | None = None
    title: str
    description: str = ""
    mode: str = "live"
    duration_min: int = 30
    price_vnd: int = 0
    active: bool = True


@router.post("/mc/services")
async def save_service(body: SvcIn, user: User = Depends(current_user),
                       session: AsyncSession = Depends(get_session)):
    _require_mc(user)
    if body.id:
        s = await session.get(MCService, body.id)
        if not s or s.mc_id != user.id:
            raise HTTPException(404, {"error": {"code": "no_service", "message": "Không thấy dịch vụ"}})
    else:
        s = MCService(mc_id=user.id)
        session.add(s)
    s.title, s.description, s.mode = body.title, body.description, body.mode
    s.duration_min, s.price_vnd, s.active = body.duration_min, body.price_vnd, body.active
    await session.commit()
    return {"ok": True, "id": s.id}


@router.get("/mc/bookings")
async def mc_bookings(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_mc(user)
    rows = (await session.execute(
        select(Booking, MCService, User.display_name)
        .join(MCService, MCService.id == Booking.service_id)
        .join(User, User.id == Booking.student_id)
        .where(Booking.mc_id == user.id).order_by(Booking.created_at.desc()))).all()
    return {"bookings": [_book_out(b, svc, name) for b, svc, name in rows]}


class ConfirmIn(BaseModel):
    booking_id: str
    scheduled_at: str
    meeting_link: str | None = None


@router.post("/mc/bookings/confirm")
async def confirm(body: ConfirmIn, user: User = Depends(current_user),
                  session: AsyncSession = Depends(get_session)):
    _require_mc(user)
    b = await session.get(Booking, body.booking_id)
    if not b or b.mc_id != user.id:
        raise HTTPException(404, {"error": {"code": "no_booking", "message": "Không thấy lượt đặt"}})
    b.status = "confirmed"
    b.scheduled_at = body.scheduled_at
    b.meeting_link = body.meeting_link
    await session.commit()
    student = await session.get(User, b.student_id)
    if student and student.push_token:
        await send_push(student.push_token, "MC đã nhận buổi học của bạn! 🎉",
                        f"Lịch: {body.scheduled_at}", data={"type": "booking"})
    return {"ok": True}


class DoneIn(BaseModel):
    booking_id: str


@router.post("/mc/bookings/done")
async def mark_done(body: DoneIn, user: User = Depends(current_user),
                    session: AsyncSession = Depends(get_session)):
    _require_mc(user)
    b = await session.get(Booking, body.booking_id)
    if not b or b.mc_id != user.id:
        raise HTTPException(404, {"error": {"code": "no_booking", "message": "Không thấy lượt đặt"}})
    b.status = "done"
    await session.commit()
    return {"ok": True}
