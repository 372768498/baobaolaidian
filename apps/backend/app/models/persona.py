"""人设模型 — 系统预置，不由用户创建"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from app.database import Base


class Persona(Base):
    __tablename__ = "personas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), nullable=False)        # 温柔型 / 元气型 / 冷静型
    type: Mapped[str] = mapped_column(String(20), nullable=False)        # gentle / energetic / calm
    avatar_emoji: Mapped[str] = mapped_column(String(10), default="🌙", nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)       # 对外展示的短简介（short_bio）
    personality_tags: Mapped[list[str] | None] = mapped_column(ARRAY(String(50)), nullable=True)
    # LLM 系统提示词模板（含 {user_nickname}, {phase}, {memory_context} 占位符）
    system_prompt_template: Mapped[str] = mapped_column(Text, nullable=False)
    # TTS 声音 ID（对应 TTS 服务的 voice_type）
    voice_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, nullable=False)
