"""通话会话模型"""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class ConversationSession(Base):
    __tablename__ = "conversation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    persona_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("personas.id"))
    # 触发类型：scheduled（定时）/ emergency（立即）/ retry（补拨）
    trigger_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # 状态流转：pending → ringing → answered → completed
    #           pending → ringing → missed（未接）
    #           answered → risk_interrupted（风控打断）
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(nullable=True)
    duration_secs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 当前通话编排阶段（OPENING/EMPATHY/EXPRESSION/SUMMARY/MICRO_ACTION/CLOSING）
    orchestration_phase: Mapped[str | None] = mapped_column(String(30), nullable=True)
    risk_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False, index=True)

    # 关联
    user: Mapped["User"] = relationship(back_populates="sessions")
    messages: Mapped[list["ConversationMessage"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    recap: Mapped["PostCallRecap"] = relationship(back_populates="session", uselist=False)
