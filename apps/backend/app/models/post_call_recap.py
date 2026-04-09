"""通话后小结"""
import uuid
from datetime import datetime
from sqlalchemy import Text, ForeignKey, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PostCallRecap(Base):
    __tablename__ = "post_call_recaps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversation_sessions.id"), unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)   # 一句话总结
    micro_action: Mapped[str] = mapped_column(Text, nullable=False)    # 微行动建议
    followup_point: Mapped[str] = mapped_column(Text, nullable=False)  # 下次回访点
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)

    session: Mapped["ConversationSession"] = relationship(back_populates="recap")
