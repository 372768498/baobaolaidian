"""
通话后小结路由

GET /api/v1/recap/{session_id}  — 获取某次通话的小结
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.post_call_recap import PostCallRecap
from app.schemas.call import RecapOut

router = APIRouter(prefix="/recap", tags=["recap"])


@router.get("/{session_id}", response_model=RecapOut)
async def get_recap(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取通话后小结。
    小结由后台异步生成，通话结束后约 10-30s 可用。
    """
    result = await db.execute(
        select(PostCallRecap).where(
            PostCallRecap.session_id == session_id,
            PostCallRecap.user_id == current_user.id,
        )
    )
    recap = result.scalar_one_or_none()
    if not recap:
        raise HTTPException(
            status_code=404,
            detail="小结还未生成，请稍后重试",
        )
    return recap
