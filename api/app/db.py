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
    # Demo: tạo bảng từ ORM. Trên Postgres/VPS dùng migration trong db/migrations/.
    from . import models  # noqa: F401 — đăng ký bảng

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
