"""
来电调度服务

职责：
  1. 每分钟扫描 call_preferences，找出当前时间窗口内的用户
  2. 检查是否已超过每日来电限制（默认 1 次）
  3. 创建 ConversationSession（status=pending），推送来电通知
  4. 支持紧急来电（立即触发，跳过时间窗口检查）

调度器使用 APScheduler（AsyncIOScheduler），在 FastAPI lifespan 中启动。
"""
import uuid
import logging
from datetime import datetime, time, timezone, timedelta
import pytz

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.call_preference import CallPreference
from app.models.conversation_session import ConversationSession

logger = logging.getLogger(__name__)
settings = get_settings()


async def trigger_scheduled_calls() -> None:
    """
    定时任务入口（每 60 秒执行一次）。
    扫描所有活跃偏好，对满足条件的用户创建 pending session。
    """
    now_utc = datetime.now(timezone.utc)
    logger.debug("call_scheduler: scanning at %s", now_utc.isoformat())

    async with AsyncSessionLocal() as db:
        # 加载所有活跃偏好
        result = await db.execute(
            select(CallPreference).where(CallPreference.is_active == True)
        )
        preferences = result.scalars().all()

        for pref in preferences:
            try:
                await _maybe_schedule(db, pref, now_utc)
            except Exception as e:
                logger.error(
                    "call_scheduler: error for user %s: %s", pref.user_id, e
                )

        await db.commit()


async def _maybe_schedule(
    db: AsyncSession,
    pref: CallPreference,
    now_utc: datetime,
) -> None:
    """
    判断指定用户是否应该发起来电。
    """
    # 转换到用户时区
    try:
        user_tz = pytz.timezone(pref.timezone)
    except pytz.UnknownTimeZoneError:
        user_tz = pytz.timezone("Asia/Shanghai")

    now_local = now_utc.astimezone(user_tz)
    current_time = now_local.time().replace(second=0, microsecond=0)

    # 检查是否在时间窗口内（窗口未设置时跳过）
    if pref.window_start is None or pref.window_end is None:
        return
    if not _in_window(current_time, pref.window_start, pref.window_end):
        return

    # 检查今日是否已来电
    today_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start.astimezone(timezone.utc)

    count_result = await db.execute(
        select(func.count(ConversationSession.id)).where(
            ConversationSession.user_id == pref.user_id,
            ConversationSession.trigger_type == "scheduled",
            ConversationSession.created_at >= today_start_utc,
        )
    )
    today_count = count_result.scalar_one()

    if today_count >= settings.max_calls_per_day:
        return

    # 创建 pending session
    session = ConversationSession(
        user_id=pref.user_id,
        persona_id=pref.persona_id,
        trigger_type="scheduled",
        status="pending",
    )
    db.add(session)
    await db.flush()

    logger.info(
        "call_scheduler: created session %s for user %s",
        session.id, pref.user_id,
    )

    # TODO: 通过 Redis Pub/Sub 或 Firebase 推送来电通知
    # await push_incoming_call_notification(pref.user_id, session.id)


async def trigger_emergency_call(
    db: AsyncSession,
    user_id: uuid.UUID,
    persona_id: uuid.UUID,
) -> ConversationSession:
    """
    紧急来电：用户主动触发，跳过时间窗口，立即创建 session。
    """
    # 检查是否有正在进行的通话
    active_result = await db.execute(
        select(ConversationSession).where(
            ConversationSession.user_id == user_id,
            ConversationSession.status.in_(["pending", "ringing", "answered"]),
        )
    )
    active = active_result.scalar_one_or_none()
    if active:
        logger.info(
            "call_scheduler: emergency skipped, active session %s exists", active.id
        )
        return active

    session = ConversationSession(
        user_id=user_id,
        persona_id=persona_id,
        trigger_type="emergency",
        status="pending",
    )
    db.add(session)
    await db.commit()
    logger.info(
        "call_scheduler: emergency session %s created for user %s",
        session.id, user_id,
    )
    return session


def _in_window(current: time, start: time, end: time) -> bool:
    """判断 current 是否在 [start, end) 时间窗口内（支持跨午夜）"""
    if start <= end:
        return start <= current < end
    else:
        # 跨午夜，例如 22:00 - 01:00
        return current >= start or current < end
