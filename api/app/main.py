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
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import init_db
from .routers import admin, auth, content, engage, iap, leaderboard, lessons, market, mc, media, practice, stats, vevang
from .seed import seed_admin, seed_curriculum, seed_genres, seed_lessons, seed_mc, seed_rubrics

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("mcup")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    await seed_curriculum()  # giáo trình đầy đủ từ db/curriculum/*.json (nếu có) — ưu tiên trước
    await seed_lessons()
    await seed_genres()  # Pha C: thể loại đám cưới/sự kiện/livestream
    await seed_rubrics()  # ≥20 biến thể lời khen/nhắc mỗi loại (feedback #2)
    await seed_mc()
    await seed_admin()
    # Chống quên đổi secret khi lên prod (Postgres = dấu hiệu prod)
    if settings.jwt_secret.startswith("doi-secret") and "postgresql" in settings.database_url:
        log.error("⚠️⚠️ JWT_SECRET đang là giá trị mặc định trên Postgres — ĐỔI NGAY trong .env!")
    log.info("McUp API sẵn sàng (DB=%s) — mở http://localhost:8000/app",
             settings.database_url.split("://")[0])
    # Scheduler nhắc streak (A1) — loop nhẹ trong process, không cần cron ngoài.
    import asyncio as _asyncio
    from .push import streak_reminder_tick

    async def _streak_loop():
        while True:
            try:
                from datetime import datetime
                if datetime.now().hour >= 19:  # chỉ nhắc buổi tối (giờ máy chủ)
                    await streak_reminder_tick()
            except Exception as exc:
                log.warning("streak loop lỗi (%s)", exc)
            await _asyncio.sleep(3600)  # mỗi giờ

    _task = _asyncio.create_task(_streak_loop())
    yield
    _task.cancel()


app = FastAPI(title="McUp API", version=settings.app_version, lifespan=lifespan)

# CORS: dev = "*"; prod đặt env ALLOWED_ORIGINS về đúng domain (app mobile không cần CORS,
# đây là cho web admin/prototype khi khác origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",") if o.strip()],
    allow_methods=["*"], allow_headers=["*"],
)


@app.middleware("http")
async def trace_and_errors(request: Request, call_next):
    trace_id = request.headers.get("X-Trace-Id") or str(uuid.uuid4())
    try:
        response = await call_next(request)
    except Exception as exc:
        log.exception("traceId=%s lỗi không mong đợi", trace_id)
        # Prod: KHÔNG lộ str(exc) (rò rỉ nội bộ). Vẫn ghi full ở log server + trả traceId.
        msg = str(exc) if settings.debug else "Có lỗi xảy ra, vui lòng thử lại sau."
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": msg, "traceId": trace_id}},
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
app.include_router(media.router)
app.include_router(admin.router)
app.include_router(content.router)
app.include_router(iap.router)
app.include_router(engage.router)
app.include_router(market.router)


_WEB = Path(__file__).parent / "web"


@app.get("/", include_in_schema=False)
@app.get("/landing", include_in_schema=False)
async def landing():
    """Landing page giới thiệu app + MC hợp tác (feedback #6)."""
    return FileResponse(_WEB / "landing.html")


# ===== SEO: ảnh chia sẻ, favicon, robots, sitemap =====
@app.get("/og.png", include_in_schema=False)
async def og_image():
    return FileResponse(_WEB / "og.png", media_type="image/png",
                        headers={"Cache-Control": "public, max-age=86400"})


@app.get("/favicon.svg", include_in_schema=False)
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(_WEB / "favicon.svg", media_type="image/svg+xml",
                        headers={"Cache-Control": "public, max-age=604800"})


@app.get("/robots.txt", include_in_schema=False)
async def robots():
    body = "User-agent: *\nAllow: /\nDisallow: /admin-web\nDisallow: /app\n\nSitemap: https://mcup.fun/sitemap.xml\n"
    return PlainTextResponse(body)


@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap():
    urls = [("https://mcup.fun/", "1.0"), ("https://mcup.fun/privacy", "0.3"),
            ("https://mcup.fun/terms", "0.3")]
    items = "".join(f"<url><loc>{u}</loc><priority>{p}</priority></url>" for u, p in urls)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{items}</urlset>'
    return Response(xml, media_type="application/xml")


@app.get("/privacy", include_in_schema=False)
async def privacy():
    """Chính sách quyền riêng tư (NĐ 13/2023) — URL cho App Store/Play + link trong app."""
    return FileResponse(Path(__file__).parent / "web" / "privacy.html")


@app.get("/terms", include_in_schema=False)
async def terms():
    """Điều khoản sử dụng."""
    return FileResponse(Path(__file__).parent / "web" / "terms.html")


@app.get("/app", include_in_schema=False)
async def web_prototype():
    """Prototype web 'Sân khấu ấm' — mở để xem & bấm thử toàn bộ luồng."""
    return FileResponse(Path(__file__).parent / "web" / "index.html")


_ADMIN_DIST = Path(__file__).parent / "web" / "admin-dist"


@app.get("/admin-web", include_in_schema=False)
async def admin_web():
    """SPA admin (Pha A — admin-panel-plan): build từ mcup/admin/ (npm run build).
    Chưa build → fallback trang legacy 1 file."""
    idx = _ADMIN_DIST / "index.html"
    return FileResponse(idx if idx.exists() else Path(__file__).parent / "web" / "admin.html")


@app.get("/admin-web-legacy", include_in_schema=False)
async def admin_web_legacy():
    """Trang admin cũ (1 file) — giữ tới khi SPA đạt parity rồi xoá."""
    return FileResponse(Path(__file__).parent / "web" / "admin.html")


if _ADMIN_DIST.exists():  # assets JS/CSS của SPA
    app.mount("/admin-web", StaticFiles(directory=_ADMIN_DIST, html=True), name="admin-spa")
