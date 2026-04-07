"""注册所有 ORM 模型，确保 Alembic 可以发现并生成迁移"""
from app.models.user import User
from app.models.persona import Persona
from app.models.call_preference import CallPreference
from app.models.conversation_session import ConversationSession
from app.models.conversation_message import ConversationMessage
from app.models.memory_item import MemoryItem
from app.models.risk_event import RiskEvent
from app.models.post_call_recap import PostCallRecap

__all__ = [
    "User",
    "Persona",
    "CallPreference",
    "ConversationSession",
    "ConversationMessage",
    "MemoryItem",
    "RiskEvent",
    "PostCallRecap",
]
