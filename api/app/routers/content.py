from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..deps import current_user
from ..genres_meta import meta_for
from ..models import User
from ..services import get_content_lessons_for_user, list_paths, mc_directory

router = APIRouter(tags=["content"])


@router.get("/mentors")
async def mentors(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Danh sách MC hợp tác — học viên xem để thấy 'app có MC xịn' (feedback #5)."""
    return await mc_directory(session)


@router.get("/content/paths")
async def content_paths(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Lộ trình ĐÃ PUBLISHED cho học viên chọn (FR-19) + màu/tagline theo thể loại (Pha C)."""
    paths = await list_paths(session, "published")
    for p in paths:
        p.update(meta_for(p.get("genre")))
    return paths


@router.get("/content/paths/{path_id}/lessons")
async def content_lessons(path_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return await get_content_lessons_for_user(session, path_id, user.id)
