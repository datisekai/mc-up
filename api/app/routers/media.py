from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..config import settings
from ..security import verify_media

router = APIRouter(tags=["media"])


@router.get("/media/{key}")
async def get_media(key: str, e: str = "", s: str = ""):
    """Phục vụ file clip/giọng — YÊU CẦU chữ ký hợp lệ + chưa hết hạn (bảo vệ voice nhạy cảm).
    URL được cấp qua API đã xác thực (sign_media)."""
    if not verify_media(key, e, s):
        raise HTTPException(403, {"error": {"code": "forbidden", "message": "Link không hợp lệ hoặc đã hết hạn"}})
    base = Path(settings.upload_dir).resolve()
    p = (base / key).resolve()
    if not str(p).startswith(str(base) + "/") or not p.exists():  # chặn path traversal
        raise HTTPException(404, {"error": {"code": "no_media", "message": "Không tìm thấy file"}})
    return FileResponse(p)
