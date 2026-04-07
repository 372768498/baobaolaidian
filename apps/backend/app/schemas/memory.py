"""记忆系统 schema"""
import uuid
from datetime import datetime
from pydantic import BaseModel


class MemoryItemOut(BaseModel):
    id: uuid.UUID
    category: str
    content: str
    confidence: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemoryItemCreate(BaseModel):
    """手动添加记忆条目（管理端/测试用）"""
    category: str   # nickname_pref / recent_concern / emotion_trigger / comfort_style
    content: str
