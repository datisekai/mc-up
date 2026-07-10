"""Alembic env — chạy được 2 kiểu:
1. Từ APP lúc khởi động: nhận sẵn sync-connection qua config.attributes["connection"]
   (api/app/db.py bọc engine async bằng run_sync) — dùng cho cả Postgres lẫn SQLite.
2. Từ CLI khi dev (autogenerate): tự tạo engine sync từ DATABASE_URL trong settings.
"""
import os
import sys

from alembic import context
from sqlalchemy import create_engine, pool

# mcup/ root vào sys.path để import api.app (CLI chạy từ bất kỳ đâu)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from api.app import models  # noqa: F401 — đăng ký toàn bộ bảng vào metadata
from api.app.config import settings
from api.app.db import Base

config = context.config
target_metadata = Base.metadata


def _sync_url() -> str:
    # Alembic chạy sync — bỏ driver async (aiosqlite/asyncpg dùng ở app runtime)
    return settings.database_url.replace("+aiosqlite", "").replace("+asyncpg", "")


def _run(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        # SQLite không ALTER được nhiều kiểu — batch mode tạo bảng mới rồi copy
        render_as_batch=connection.dialect.name == "sqlite",
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    conn = config.attributes.get("connection")
    if conn is not None:  # từ app (db.py) — dùng lại connection đang có
        _run(conn)
        return
    engine = create_engine(_sync_url(), poolclass=pool.NullPool)  # từ CLI
    with engine.connect() as connection:
        _run(connection)
        connection.commit()


if context.is_offline_mode():
    context.configure(url=_sync_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    run_migrations_online()
