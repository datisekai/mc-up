import time

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session
from ..deps import current_user
from ..genres_meta import meta_for
from ..models import User
from ..services import get_content_lessons_for_user, list_paths, mc_directory

router = APIRouter(tags=["content"])

# Cache TTL cho endpoint đọc NÓNG, giống nhau với mọi user (danh sách lộ trình/MC) —
# gọi mỗi lần refresh → cache giảm mạnh tải DB khi đông người. TTL ngắn nên cập nhật vẫn kịp.
_cache: dict = {}


async def _cached(key: str, fn):
    now = time.monotonic()
    hit = _cache.get(key)
    if hit and now - hit[0] < settings.cache_ttl_sec:
        return hit[1]
    data = await fn()
    _cache[key] = (now, data)
    return data


@router.get("/mentors")
async def mentors(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Danh sách MC hợp tác — học viên xem để thấy 'app có MC xịn' (feedback #5)."""
    return await _cached("mentors", lambda: mc_directory(session))


@router.get("/content/paths")
async def content_paths(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Lộ trình ĐÃ PUBLISHED cho học viên chọn (FR-19) + màu/tagline theo thể loại (Pha C)."""
    async def build():
        paths = await list_paths(session, "published")
        for p in paths:
            p.update(meta_for(p.get("genre")))
        return paths
    return await _cached("content_paths", build)


@router.get("/content/paths/{path_id}/lessons")
async def content_lessons(path_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await get_content_lessons_for_user(session, path_id, user.id)
