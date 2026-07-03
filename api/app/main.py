"""McUp API — lát cắt lõi chạy được (Story 1.1–4 mức demo).

Conventions (Architecture Spine): envelope lỗi {"error":{"code","message"}},
traceId mỗi request, thời gian UTC ISO-8601. Chấm phần Xác dùng ASR GIẢ LẬP
(is_mock=true) để chạy offline — thay bằng Whisper qua AsrPort sau.
"""
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .config import settings
from .db import init_db
from .routers import auth, leaderboard, lessons, mc, practice, stats, vevang
from .seed import seed_lessons, seed_mc

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("mcup")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    await seed_lessons()
    await seed_mc()
    log.info("McUp API sẵn sàng (DB=%s) — mở http://localhost:8000/app",
             settings.database_url.split("://")[0])
    yield


app = FastAPI(title="McUp API", version=settings.app_version, lifespan=lifespan)

# CORS mở cho dev (prototype web) — siết lại khi deploy VPS
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.middleware("http")
async def trace_and_errors(request: Request, call_next):
    trace_id = request.headers.get("X-Trace-Id") or str(uuid.uuid4())
    try:
        response = await call_next(request)
    except Exception as exc:
        log.exception("traceId=%s lỗi không mong đợi", trace_id)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": str(exc)}},
            headers={"X-Trace-Id": trace_id},
        )
    response.headers["X-Trace-Id"] = trace_id
    return response


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.app_version,
            "time": datetime.now(timezone.utc).isoformat()}


app.include_router(auth.router)
app.include_router(lessons.router)
app.include_router(practice.router)
app.include_router(vevang.router)
app.include_router(mc.router)
app.include_router(leaderboard.router)
app.include_router(stats.router)


@app.get("/app", include_in_schema=False)
async def web_prototype():
    """Prototype web 'Sân khấu ấm' — mở để xem & bấm thử toàn bộ luồng."""
    return FileResponse(Path(__file__).parent / "web" / "index.html")
