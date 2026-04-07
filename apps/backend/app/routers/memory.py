"""
记忆路由

GET    /api/v1/memory           — 获取当前用户所有活跃记忆
DELETE /api/v1/memory/{id}      — 手动停用某条记忆（用户隐私权）
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.memory_item import MemoryItem
from app.schemas.memory import MemoryItemOut
from app.services.memory_service import get_active_memories

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("", response_model=list[MemoryItemOut])
async def list_memories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """返回用户所有活跃记忆条目"""
    return await get_active_memories(db, current_user.id)


@router.delete("/{memory_id}", status_code=204)
async def delete_memory(
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """停用一条记忆（软删除：置 is_active=False）"""
    result = await db.execute(
        select(MemoryItem).where(
            MemoryItem.id == memory_id,
            MemoryItem.user_id == current_user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="记忆条目不存在")

    item.is_active = False
    await db.commit()
