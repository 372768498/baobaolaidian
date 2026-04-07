"""用户来电偏好 — 每用户唯一一条"""
import uuid
from datetime import datetime, time
from sqlalchemy import String, Boolean, Time, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class CallPreference(Base):
    __tablename__ = "call_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    persona_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("personas.id"), nullable=True)
    # 使用目的：sleep（睡前）/ gap（下班空窗）/ emergency（情绪急救）
    purpose: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # 来电时间窗（本地时间）— Onboarding Step 4 填写，Step 3 创建行时可为空
    window_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    window_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Shanghai", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 关联
    user: Mapped["User"] = relationship(back_populates="call_preference")
    persona: Mapped["Persona"] = relationship()
