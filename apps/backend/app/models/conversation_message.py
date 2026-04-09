"""通话消息记录（每轮对话一条）"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversation_sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(10), nullable=False)    # user / assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # 记录该消息所属编排阶段，便于后续分析和调试
    phase: Mapped[str | None] = mapped_column(String(30), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)

    session: Mapped["ConversationSession"] = relationship(back_populates="messages")
