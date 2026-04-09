"""用户模型"""
import uuid
from datetime import date, datetime
from sqlalchemy import String, Boolean, Date, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    avatar_emoji: Mapped[str] = mapped_column(String(10), default="🌙", nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    # 年龄验证：onboarding 时确认 ≥18 岁
    is_adult: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    onboarding_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 关联
    call_preference: Mapped["CallPreference"] = relationship(back_populates="user", uselist=False)
    sessions: Mapped[list["ConversationSession"]] = relationship(back_populates="user")
    memory_items: Mapped[list["MemoryItem"]] = relationship(back_populates="user")
