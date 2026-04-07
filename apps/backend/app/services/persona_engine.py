"""
人格引擎 — 负责组装每轮对话的 system prompt

职责：
1. 从 DB 加载 Persona 配置
2. 注入用户记忆条目
3. 根据当前编排阶段填充 prompt 模板
4. 返回完整 system prompt 字符串
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.persona import Persona
from app.models.memory_item import MemoryItem

logger = logging.getLogger(__name__)

# 兜底 system prompt（当 DB 中 Persona 不可用时）
_FALLBACK_SYSTEM = (
    "你是一位温柔的 AI 陪伴，正在和用户进行一次关怀通话。"
    "请用温暖、简短的语言回应，不提供医疗建议，不制造依赖。"
    "明确表明自己是 AI。"
)


async def build_system_prompt(
    db: AsyncSession,
    persona_id,
    user_id,
    phase: str,
    nickname: str = "朋友",
) -> str:
    """
    组装 system prompt。

    Args:
        db: 异步数据库会话
        persona_id: Persona UUID
        user_id: User UUID（用于加载记忆）
        phase: 当前编排阶段（OPENING / EMPATHY / EXPRESSION / SUMMARY / MICRO_ACTION / CLOSING）
        nickname: 用户昵称（来自 User.nickname）

    Returns:
        完整 system prompt 字符串
    """
    # ── 1. 加载 Persona ────────────────────────────────────────────────────────
    result = await db.execute(select(Persona).where(Persona.id == persona_id))
    persona = result.scalar_one_or_none()

    if persona is None:
        logger.warning("persona_engine: persona %s not found, using fallback", persona_id)
        return _FALLBACK_SYSTEM

    # ── 2. 加载活跃记忆条目（置信度 >= 0.3）────────────────────────────────────
    mem_result = await db.execute(
        select(MemoryItem)
        .where(MemoryItem.user_id == user_id, MemoryItem.is_active == True)
        .order_by(MemoryItem.confidence.desc())
        .limit(8)  # 最多注入 8 条，控制 token 消耗
    )
    memory_items = mem_result.scalars().all()

    memory_context = _format_memory(memory_items)

    # ── 3. 渲染模板 ────────────────────────────────────────────────────────────
    try:
        system_prompt = persona.system_prompt_template.format(
            user_nickname=nickname,
            phase=phase,
            memory_context=memory_context,
        )
    except KeyError as e:
        logger.error("persona_engine: template key error %s, using raw template", e)
        system_prompt = persona.system_prompt_template

    return system_prompt


def _format_memory(items: list) -> str:
    """将记忆条目格式化为可注入 prompt 的文字块"""
    if not items:
        return "（暂无记忆信息）"

    lines = []
    category_labels = {
        "nickname_pref": "昵称偏好",
        "recent_concern": "近期烦恼",
        "emotion_trigger": "情绪触发点",
        "comfort_style": "安慰方式偏好",
    }
    for item in items:
        label = category_labels.get(item.category, item.category)
        lines.append(f"- [{label}] {item.content}（置信度 {item.confidence:.1f}）")

    return "\n".join(lines)
