"""
通话后小结服务

在通话结束后异步调用，用 LLM 从对话历史中提炼：
  1. summary_text  — 一句话总结（≤ 30 字）
  2. micro_action  — 今晚可以做的一件小事
  3. followup_point — 下次回访时的关注点

同时从对话中提取记忆并写入记忆系统。
"""
import uuid
import logging
import json

from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.models.conversation_message import ConversationMessage
from app.models.post_call_recap import PostCallRecap
from app.services import memory_service

logger = logging.getLogger(__name__)
settings = get_settings()

_SUMMARY_PROMPT = """\
你是一个专业的通话分析助手。以下是一段 AI 陪伴通话的完整对话记录。
请从中提炼以下三项信息，用 JSON 格式返回：

{{
  "summary_text": "一句话总结用户今晚的状态（15-30字，温柔、不评判）",
  "micro_action": "今晚用户可以做的一件具体小事（15字以内，可行、温和）",
  "followup_point": "下次回访时应关注的点（20字以内）",
  "memories": [
    {{"category": "nickname_pref/recent_concern/emotion_trigger/comfort_style", "content": "..."}}
  ]
}}

只输出 JSON，不要任何额外文字。

对话记录：
{conversation}
"""


async def generate_recap(
    db: AsyncSession,
    session_id: uuid.UUID,
    user_id: uuid.UUID,
) -> PostCallRecap | None:
    """
    生成通话后小结。

    调用方：通话结束事件处理器（WebSocket close / status=completed）
    """
    # ── 1. 加载对话记录 ────────────────────────────────────────────────────────
    result = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.session_id == session_id)
        .order_by(ConversationMessage.timestamp)
    )
    messages = result.scalars().all()

    if not messages:
        logger.warning("post_call_summary: no messages for session %s", session_id)
        return None

    # 格式化对话文本
    conversation = "\n".join(
        f"{'用户' if m.role == 'user' else 'AI'}: {m.content}"
        for m in messages
    )

    # ── 2. 调用 LLM 生成小结 ───────────────────────────────────────────────────
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        response = await client.messages.create(
            model=settings.llm_model,
            max_tokens=512,
            messages=[{
                "role": "user",
                "content": _SUMMARY_PROMPT.format(conversation=conversation),
            }],
        )
        raw = response.content[0].text.strip()
        data = json.loads(raw)
    except Exception as e:
        logger.error("post_call_summary: LLM call failed: %s", e)
        return None

    # ── 3. 写入通话后小结 ──────────────────────────────────────────────────────
    recap = PostCallRecap(
        session_id=session_id,
        user_id=user_id,
        summary_text=data.get("summary_text", "今晚的通话已完成。"),
        micro_action=data.get("micro_action", "喝一杯温水，好好休息。"),
        followup_point=data.get("followup_point", "关注近期情绪变化。"),
    )
    db.add(recap)

    # ── 4. 写入记忆条目 ────────────────────────────────────────────────────────
    for mem in data.get("memories", []):
        category = mem.get("category", "")
        content = mem.get("content", "").strip()
        if category and content:
            try:
                await memory_service.upsert_memory(
                    db, user_id, category, content, session_id
                )
            except ValueError as e:
                logger.warning("post_call_summary: invalid memory category: %s", e)

    await db.commit()
    logger.info("post_call_summary: recap created for session %s", session_id)
    return recap
