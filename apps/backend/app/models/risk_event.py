"""风控事件记录"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class RiskEvent(Base):
    __tablename__ = "risk_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversation_sessions.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    # 风险类型：self_harm / suicidal / harm_others / minor / dangerous_drug
    risk_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # 触发片段（存储前需脱敏，只保留关键词上下文）
    trigger_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 执行的动作
    action_taken: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
