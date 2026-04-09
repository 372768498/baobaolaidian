"""记忆条目 — AI 只记录 4 类结构化记忆"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Float, Boolean, ForeignKey, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class MemoryItem(Base):
    __tablename__ = "memory_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # 分类：nickname_pref / recent_concern / emotion_trigger / comfort_style
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # 来源会话（可为空，如手动添加）
    source_session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("conversation_sessions.id"), nullable=True)
    # 置信度 0.0-1.0，新记忆为 1.0，每次更新同类别旧记忆衰减 0.1
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    # 低于 0.3 时自动失效，不再注入上下文
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="memory_items")
