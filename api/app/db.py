from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import settings

# Giới hạn pool để không vắt kiệt kết nối Postgres khi tải cao (SQLite bỏ qua pool_size).
_engine_kw = {"pool_pre_ping": True}
if "postgresql" in settings.database_url:
    _engine_kw.update(pool_size=10, max_overflow=20, pool_recycle=1800, pool_timeout=30)
engine = create_async_engine(settings.database_url, **_engine_kw)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    """Tạo/nâng cấp schema bằng Alembic (api/migrations/) lúc khởi động —
    redeploy đổi schema KHÔNG mất dữ liệu (hết thời `down -v`)."""
    from . import models  # noqa: F401 — đăng ký bảng vào metadata

    async with engine.begin() as conn:
        await conn.run_sync(_upgrade_schema)


def _upgrade_schema(sync_conn) -> None:
    from pathlib import Path

    from alembic import command
    from alembic.config import Config
    from sqlalchemy import inspect

    api_dir = Path(__file__).resolve().parent.parent  # .../api
    cfg = Config(str(api_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(api_dir / "migrations"))
    cfg.attributes["connection"] = sync_conn

    # DB có sẵn từ thời create_all (chưa có bảng alembic_version) → schema chính là
    # baseline 0001: stamp để Alembic biết, KHÔNG tạo lại bảng, rồi mới upgrade tiếp.
    tables = inspect(sync_conn).get_table_names()
    if "alembic_version" not in tables and "app_user" in tables:
        command.stamp(cfg, "0001")
    command.upgrade(cfg, "head")
