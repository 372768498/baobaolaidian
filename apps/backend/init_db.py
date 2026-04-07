"""
启动前初始化脚本（容器启动时由 docker-compose command 调用）

执行顺序：
  1. create_all — 幂等建表（不存在则创建，已存在则跳过）
  2. seed_personas — 幂等种子人格数据
"""
import asyncio
import logging

from app.database import async_engine, Base
import app.models  # noqa: F401 — 确保所有模型注册到 Base.metadata

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


async def main() -> None:
    # ── 1. 建表 ──────────────────────────────────────────────────────────
    logger.info("init_db: running create_all …")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("init_db: tables ready")

    # ── 2. 种子数据 ───────────────────────────────────────────────────────
    logger.info("init_db: seeding personas …")
    from seed_personas import seed  # 延迟导入，避免循环
    await seed()
    logger.info("init_db: done")


if __name__ == "__main__":
    asyncio.run(main())
