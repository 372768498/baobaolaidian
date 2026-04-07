"""
数据库连接管理
- 异步引擎（asyncpg）用于 API 请求
- 同步引擎（psycopg2）用于 Alembic 迁移
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


# ── 异步引擎（FastAPI 使用）────────────────────
async_engine = create_async_engine(
    settings.database_url,
    echo=(settings.app_env == "development"),
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── 所有 ORM 模型的基类 ────────────────────────
class Base(DeclarativeBase):
    pass


# ── 依赖注入：每个请求获取独立 session ─────────
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
