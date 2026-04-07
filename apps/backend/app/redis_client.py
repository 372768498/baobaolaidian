"""
Redis 客户端
用途：
  - 来电调度任务队列
  - 通话会话状态缓存（避免频繁查 DB）
  - 推送通知去重（防止重复触发）
"""
import redis.asyncio as aioredis
from app.config import settings

# 全局异步 Redis 客户端（连接池）
redis_client: aioredis.Redis = aioredis.from_url(
    settings.redis_url,
    encoding="utf-8",
    decode_responses=True,
)


async def get_redis() -> aioredis.Redis:
    """依赖注入：获取 Redis 客户端"""
    return redis_client


# ── 常用 Key 前缀常量 ──────────────────────────
class RedisKeys:
    CALL_SCHEDULE = "call:schedule:{user_id}"         # 用户今日计划来电时间
    CALL_RETRY = "call:retry:{user_id}"               # 补拨标记
    SESSION_ACTIVE = "session:active:{user_id}"       # 当前活跃通话 session_id
    PUSH_DEDUP = "push:dedup:{user_id}:{call_date}"   # 推送去重
