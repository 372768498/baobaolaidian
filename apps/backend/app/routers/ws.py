"""
WebSocket 路由 — 通话实时音频通道

WS /ws/call/{session_id}?token=<jwt>

连接成功后，服务端启动 CallOrchestrator 管理对话全程。
连接断开时，触发通话后小结异步生成。

注意：WebSocket 不支持标准 HTTP Authorization header，
      所以 JWT 通过 query param 传递。
"""
import uuid
import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from jose import JWTError, jwt

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.auth import ALGORITHM
from app.models.user import User
from app.models.conversation_session import ConversationSession
from app.services.conversation_orchestrator import CallOrchestrator
from app.services.post_call_summary import generate_recap

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/call/{session_id}")
async def call_websocket(
    websocket: WebSocket,
    session_id: uuid.UUID,
    token: str = Query(..., description="JWT access token"),
):
    """
    通话 WebSocket 端点。

    认证流程：
      1. 解析 query param token
      2. 验证 session 属于该用户
      3. 启动 CallOrchestrator
      4. 断开时异步生成通话后小结
    """
    await websocket.accept()

    async with AsyncSessionLocal() as db:
        # ── 1. 验证 JWT ────────────────────────────────────────────────────────
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
            user_id = uuid.UUID(payload["sub"])
        except (JWTError, KeyError, ValueError):
            await websocket.send_json({"type": "error", "detail": "无效 token"})
            await websocket.close(code=4001)
            return

        # ── 2. 加载用户 & Session ──────────────────────────────────────────────
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()

        session_result = await db.execute(
            select(ConversationSession).where(
                ConversationSession.id == session_id,
                ConversationSession.user_id == user_id,
            )
        )
        session = session_result.scalar_one_or_none()

        if not user or not session:
            await websocket.send_json({"type": "error", "detail": "Session 不存在"})
            await websocket.close(code=4004)
            return

        if session.status not in ("pending", "ringing"):
            await websocket.send_json({"type": "error", "detail": "Session 状态异常"})
            await websocket.close(code=4003)
            return

        # ── 3. 更新状态为 ringing ──────────────────────────────────────────────
        session.status = "ringing"
        await db.commit()

        # ── 4. 启动编排器 ─────────────────────────────────────────────────────
        orchestrator = CallOrchestrator(
            ws=websocket,
            db=db,
            session=session,
            user=user,
        )

        try:
            await orchestrator.run()
        except WebSocketDisconnect:
            logger.info("ws: client disconnected session=%s", session_id)
        finally:
            # ── 5. 异步生成通话后小结 ─────────────────────────────────────────
            asyncio.create_task(
                _generate_recap_async(session_id, user_id)
            )


async def _generate_recap_async(
    session_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """在独立 DB session 中生成通话后小结（不阻塞 WS 断开）"""
    async with AsyncSessionLocal() as db:
        try:
            await generate_recap(db, session_id, user_id)
        except Exception as e:
            logger.error("ws: recap generation failed session=%s: %s", session_id, e)
