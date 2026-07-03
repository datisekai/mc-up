from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..config import settings

router = APIRouter(tags=["media"])


@router.get("/media/{key}")
async def get_media(key: str):
    """Phục vụ file clip/giọng (demo). Production: presigned URL có hạn (AD-4)."""
    base = Path(settings.upload_dir).resolve()
    p = (base / key).resolve()
    if not str(p).startswith(str(base) + "/") or not p.exists():  # chặn path traversal
        raise HTTPException(404, {"error": {"code": "no_media", "message": "Không tìm thấy file"}})
    return FileResponse(p)
