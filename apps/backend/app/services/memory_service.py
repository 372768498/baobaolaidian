"""
记忆服务 — 负责记忆条目的写入与衰减

记忆分 4 类:
  nickname_pref     用户偏好的称呼/昵称
  recent_concern    近期烦恼
  emotion_trigger   情绪触发点
  comfort_style     安慰方式偏好

写入规则:
  - 新记忆置信度 = 1.0
  - 同类旧记忆置信度衰减 0.1（下限 0.0）
  - 置信度 < 0.3 时 is_active 自动置 False
"""
import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.memory_item import MemoryItem

logger = logging.getLogger(__name__)

VALID_CATEGORIES = {
    "nickname_pref",
    "recent_concern",
    "emotion_trigger",
    "comfort_style",
}
DECAY_STEP = 0.1
INACTIVE_THRESHOLD = 0.3


async def upsert_memory(
    db: AsyncSession,
    user_id: uuid.UUID,
    category: str,
    content: str,
    source_session_id: uuid.UUID | None = None,
) -> MemoryItem:
    """
    写入一条新记忆，同时对同类旧记忆执行置信度衰减。

    Args:
        db: 异步数据库会话（调用方负责 commit）
        user_id: 用户 UUID
        category: 记忆类别
        content: 记忆内容
        source_session_id: 来源会话（可为空）

    Returns:
        新创建的 MemoryItem
    """
    if category not in VALID_CATEGORIES:
        raise ValueError(f"未知记忆类别: {category}")

    # ── 1. 对同类旧记忆衰减 ────────────────────────────────────────────────────
    await _decay_same_category(db, user_id, category)

    # ── 2. 写入新记忆 ──────────────────────────────────────────────────────────
    new_item = MemoryItem(
        user_id=user_id,
        category=category,
        content=content,
        source_session_id=source_session_id,
        confidence=1.0,
        is_active=True,
    )
    db.add(new_item)
    await db.flush()  # 获取 id，不 commit（调用方统一 commit）

    logger.info(
        "memory_service: upserted category=%s user=%s", category, user_id
    )
    return new_item


async def get_active_memories(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[MemoryItem]:
    """返回用户所有活跃记忆，按置信度降序"""
    result = await db.execute(
        select(MemoryItem)
        .where(
            MemoryItem.user_id == user_id,
            MemoryItem.is_active == True,
        )
        .order_by(MemoryItem.confidence.desc())
    )
    return list(result.scalars().all())


async def _decay_same_category(
    db: AsyncSession,
    user_id: uuid.UUID,
    category: str,
) -> None:
    """
    同类记忆衰减：
      - active 且 confidence >= INACTIVE_THRESHOLD: confidence -= DECAY_STEP
      - 衰减后 confidence < INACTIVE_THRESHOLD: is_active = False
    """
    result = await db.execute(
        select(MemoryItem).where(
            MemoryItem.user_id == user_id,
            MemoryItem.category == category,
            MemoryItem.is_active == True,
        )
    )
    items = result.scalars().all()

    for item in items:
        new_conf = round(item.confidence - DECAY_STEP, 2)
        item.confidence = max(0.0, new_conf)
        if item.confidence < INACTIVE_THRESHOLD:
            item.is_active = False
            logger.debug(
                "memory_service: deactivated item %s (confidence %.1f)",
                item.id, item.confidence,
            )
