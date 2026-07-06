"""Admin API — Pha A admin-panel-plan: CRUD cây nội dung + duplicate + reorder +
publish/unpublish + AI-split + AI-gợi-ý từng ô + preview tiêu chí.
Mọi endpoint sau _require_admin (AD-7); node mới luôn draft (AD-12)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session
from ..deps import current_user
from ..models import User
from ..rubrics import criteria_for, get_rubric
from ..schemas import AiSplitIn
from ..services import (admin_create_genre, admin_create_lesson, admin_create_path,
                        admin_create_session, admin_duplicate_lesson, admin_duplicate_session,
                        admin_list_genres, admin_move_node, admin_update_node,
                        ai_split_and_persist, ai_suggest_field, get_path_tree, list_paths,
                        publish_path, unpublish_path)

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(user: User):
    if user.role != "admin":  # AD-7
        raise HTTPException(403, {"error": {"code": "not_admin", "message": "Cần tài khoản admin"}})


def _404(msg="Không tìm thấy"):
    raise HTTPException(404, {"error": {"code": "not_found", "message": msg}})


class NameIn(BaseModel):
    name: str


class PathIn(BaseModel):
    genre_id: str
    title: str


class TitleIn(BaseModel):
    title: str


class PatchIn(BaseModel):
    fields: dict


class MoveIn(BaseModel):
    direction: int  # -1 lên · 1 xuống


class SuggestIn(BaseModel):
    genre: str = ""
    lesson_title: str = ""
    prompt: str = ""
    field: str  # objective | context | steps | example | tip | prompt


# ===== AI =====

@router.post("/ai-split")
async def ai_split(body: AiSplitIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """AI chia giáo trình (FR-18) → LƯU cây Buổi/Bài/Đề NHÁP (AD-10/12). Trả cây để duyệt."""
    _require_admin(user)
    if not body.raw_text.strip():
        raise HTTPException(400, {"error": {"code": "empty", "message": "Thiếu nội dung tài liệu"}})
    res = await ai_split_and_persist(session, body.raw_text, body.genre, settings.openai_api_key)
    tree = await get_path_tree(session, res["path_id"])
    return {"is_mock": res["is_mock"], **(tree or {})}


@router.post("/ai-suggest")
async def ai_suggest(body: SuggestIn, user: User = Depends(current_user)):
    """✨ Gợi ý nội dung cho MỘT ô (plan §1.4) — admin sửa rồi lưu, không auto-ghi."""
    _require_admin(user)
    out = await ai_suggest_field(body.genre, body.lesson_title, body.prompt, body.field, settings.openai_api_key)
    if "error" in out:
        raise HTTPException(400, {"error": {"code": "bad_field", "message": out["error"]}})
    return out


# ===== Genre / Path =====

@router.get("/genres")
async def genres(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_admin(user)
    return await admin_list_genres(session)


@router.post("/genres")
async def create_genre(body: NameIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_admin(user)
    g = await admin_create_genre(session, body.name.strip())
    return {"id": g.id, "name": g.name}


@router.get("/paths")
async def paths(status: str | None = None, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_admin(user)
    return await list_paths(session, status)


@router.post("/paths")
async def create_path(body: PathIn, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_admin(user)
    pid = await admin_create_path(session, body.genre_id, body.title.strip() or "Lộ trình mới")
    if not pid:
        _404("Không tìm thấy thể loại")
    return {"id": pid}


@router.get("/paths/{path_id}")
async def path_tree(path_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_admin(user)
    tree = await get_path_tree(session, path_id)
    if not tree:
        _404("Không tìm thấy lộ trình")
    return tree


@router.post("/paths/{path_id}/publish")
async def publish(path_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Admin duyệt & xuất bản (FR-17): draft → published cho cả cây."""
    _require_admin(user)
    if not await publish_path(session, path_id):
        _404("Không tìm thấy lộ trình")
    return {"status": "published", "path_id": path_id}


@router.post("/paths/{path_id}/unpublish")
async def unpublish(path_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Gỡ xuất bản cả cây về draft — học viên không thấy nữa."""
    _require_admin(user)
    if not await unpublish_path(session, path_id):
        _404("Không tìm thấy lộ trình")
    return {"status": "draft", "path_id": path_id}


# ===== Node CRUD (path/level/session/lesson) =====

@router.patch("/nodes/{kind}/{node_id}")
async def patch_node(kind: str, node_id: str, body: PatchIn,
                     user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Sửa tại chỗ theo whitelist từng tầng. kind: path|level|session|lesson."""
    _require_admin(user)
    if kind not in ("path", "level", "session", "lesson"):
        raise HTTPException(400, {"error": {"code": "bad_kind", "message": "kind không hợp lệ"}})
    if not await admin_update_node(session, kind, node_id, body.fields):
        _404()
    return {"ok": True}


@router.post("/sessions")
async def create_session_node(body: dict, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_admin(user)
    sid = await admin_create_session(session, body.get("level_id", ""), (body.get("title") or "Buổi mới").strip())
    if not sid:
        _404("Không tìm thấy cấp độ")
    return {"id": sid}


@router.post("/lessons")
async def create_lesson_node(body: dict, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_admin(user)
    lid = await admin_create_lesson(session, body.get("session_id", ""), (body.get("title") or "Bài mới").strip())
    if not lid:
        _404("Không tìm thấy buổi")
    return {"id": lid}


@router.post("/lessons/{lesson_id}/duplicate")
async def duplicate_lesson(lesson_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Nhân bản — công cụ nhập liệu số 1 (plan §1.2). Bản sao luôn draft."""
    _require_admin(user)
    lid = await admin_duplicate_lesson(session, lesson_id)
    if not lid:
        _404("Không tìm thấy bài")
    return {"id": lid}


@router.post("/sessions/{session_id}/duplicate")
async def duplicate_session(session_id: str, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    _require_admin(user)
    sid = await admin_duplicate_session(session, session_id)
    if not sid:
        _404("Không tìm thấy buổi")
    return {"id": sid}


@router.post("/nodes/{kind}/{node_id}/move")
async def move_node(kind: str, node_id: str, body: MoveIn,
                    user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """↑↓ đổi thứ tự trong cùng cha. kind: session|lesson."""
    _require_admin(user)
    if kind not in ("session", "lesson"):
        raise HTTPException(400, {"error": {"code": "bad_kind", "message": "chỉ reorder session/lesson"}})
    if not await admin_move_node(session, kind, node_id, body.direction):
        raise HTTPException(400, {"error": {"code": "cant_move", "message": "Không di chuyển được (đã ở biên?)"}})
    return {"ok": True}


# ===== Preview =====

@router.get("/criteria")
async def criteria(genre: str = "", user: User = Depends(current_user)):
    """Tiêu chí đạt SINH TỪ RUBRIC — cho preview 'xem như học viên' (1 nguồn sự thật, FR-15)."""
    _require_admin(user)
    return {"criteria": criteria_for(get_rubric(genre or None))}
