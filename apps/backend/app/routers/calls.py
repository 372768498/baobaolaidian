"""
来电路由

POST /api/v1/calls/emergency    — 用户主动触发紧急来电
GET  /api/v1/calls/sessions     — 历史通话列表
GET  /api/v1/calls/sessions/{id} — 单次通话详情
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.conversation_session import ConversationSession
from app.models.call_preference import CallPreference
from app.schemas.call import SessionOut
from app.services.call_scheduler import trigger_emergency_call

router = APIRouter(prefix="/calls", tags=["calls"])


@router.post("/emergency", response_model=SessionOut, status_code=201)
async def emergency_call(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    用户在首页点击「立即来电」时调用。
    创建 pending session，客户端收到后打开通话页面并连接 WebSocket。
    """
    # 找到用户偏好的人格
    pref_result = await db.execute(
        select(CallPreference).where(CallPreference.user_id == current_user.id)
    )
    pref = pref_result.scalar_one_or_none()

    if pref is None:
        raise HTTPException(status_code=400, detail="请先完成 Onboarding 设置通话偏好")

    if not current_user.is_adult:
        raise HTTPException(status_code=403, detail="本服务仅对成年用户开放")

    session = await trigger_emergency_call(db, current_user.id, pref.persona_id)
    return session


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """历史通话列表，按时间倒序"""
    result = await db.execute(
        select(ConversationSession)
        .where(ConversationSession.user_id == current_user.id)
        .order_by(ConversationSession.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()


@router.get("/sessions/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ConversationSession).where(
            ConversationSession.id == session_id,
            ConversationSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="通话记录不存在")
    return session
