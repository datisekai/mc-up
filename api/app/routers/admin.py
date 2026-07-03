from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session
from ..deps import current_user
from ..models import User
from ..schemas import AiSplitIn
from ..services import ai_split_and_persist, get_path_tree, list_paths, publish_path

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(user: User):
    if user.role != "admin":  # AD-7
        raise HTTPException(403, {"error": {"code": "not_admin", "message": "Cần tài khoản admin"}})


@router.post("/ai-split")
async def ai_split(body: AiSplitIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """AI chia giáo trình (FR-18) → LƯU cây Buổi/Bài/Đề NHÁP (AD-10/12). Trả cây để duyệt."""
    _require_admin(user)
    if not body.raw_text.strip():
        raise HTTPException(400, {"error": {"code": "empty", "message": "Thiếu nội dung tài liệu"}})
    res = await ai_split_and_persist(session, body.raw_text, body.genre, settings.openai_api_key)
    tree = await get_path_tree(session, res["path_id"])
    return {"is_mock": res["is_mock"], **(tree or {})}


@router.get("/paths")
async def paths(status: str | None = None, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_admin(user)
    return await list_paths(session, status)


@router.get("/paths/{path_id}")
async def path_tree(path_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_admin(user)
    tree = await get_path_tree(session, path_id)
    if not tree:
        raise HTTPException(404, {"error": {"code": "no_path", "message": "Không tìm thấy lộ trình"}})
    return tree


@router.post("/paths/{path_id}/publish")
async def publish(path_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Admin duyệt & xuất bản (FR-17): draft → published cho cả cây."""
    _require_admin(user)
    if not await publish_path(session, path_id):
        raise HTTPException(404, {"error": {"code": "no_path", "message": "Không tìm thấy lộ trình"}})
    return {"status": "published", "path_id": path_id}
