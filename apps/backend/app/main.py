"""
宝宝来电 — FastAPI 应用入口

启动顺序：
  1. lifespan: 启动 APScheduler（来电调度）
  2. 注册所有路由
  3. 配置 CORS（开发环境允许所有来源）
"""
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.database import async_engine, Base
import app.models  # noqa: F401 — 确保所有模型注册到 Base.metadata
from app.routers import auth, users, calls, memory, recap, ws
from app.services.call_scheduler import trigger_scheduled_calls

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()

# ── 调度器（全局单例）────────────────────────────────────────────────────────
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI 生命周期：建表 → 启动/关闭调度器"""
    # 自动建表（幂等；生产环境替换为 Alembic 迁移）
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ensured (create_all)")

    # 注册每分钟扫描任务
    scheduler.add_job(
        trigger_scheduled_calls,
        trigger="interval",
        seconds=60,
        id="scheduled_calls",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler started — call scheduler running every 60s")

    yield  # ← 服务器运行中

    scheduler.shutdown(wait=False)
    logger.info("APScheduler stopped")


# ── 应用实例 ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="宝宝来电 API",
    version="0.1.0",
    description="AI 主动来电陪伴 — 睡前安抚 & 情绪急救",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # 生产环境替换为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 路由注册 ──────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth.router,   prefix=API_PREFIX)
app.include_router(users.router,  prefix=API_PREFIX)
app.include_router(calls.router,  prefix=API_PREFIX)
app.include_router(memory.router, prefix=API_PREFIX)
app.include_router(recap.router,  prefix=API_PREFIX)
app.include_router(ws.router)     # WebSocket 不带 /api/v1 前缀


# ── 健康检查 ──────────────────────────────────────────────────────────────────
@app.get("/health", tags=["infra"])
async def health():
    return {"status": "ok", "service": "baobao-laidan-backend"}
