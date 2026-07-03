from fastapi import APIRouter, Depends, HTTPException

from adapters.content_split_factory import get_splitter

from ..config import settings
from ..deps import current_user
from ..models import User
from ..schemas import AiSplitIn

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(user: User):
    if user.role != "admin":  # AD-7
        raise HTTPException(403, {"error": {"code": "not_admin", "message": "Cần tài khoản admin"}})


@router.post("/ai-split")
async def ai_split(body: AiSplitIn, user: User = Depends(current_user)):
    """AI chia giáo trình (FR-18) → cây Buổi/Bài/Đề NHÁP. AD-10: luôn draft, chờ admin duyệt."""
    _require_admin(user)
    if not body.raw_text.strip():
        raise HTTPException(400, {"error": {"code": "empty", "message": "Thiếu nội dung tài liệu"}})
    splitter = get_splitter(settings.openai_api_key)  # AD-2: sau port
    draft = await splitter.split(body.raw_text, body.genre)
    return {"status": "draft", "genre": body.genre, **draft}  # chưa publish (AD-12)
