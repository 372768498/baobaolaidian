"""通话相关 schema"""
import uuid
from datetime import datetime
from pydantic import BaseModel


class CallTriggerRequest(BaseModel):
    """手动触发紧急来电"""
    trigger_type: str = "emergency"  # emergency / scheduled


class SessionOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    persona_id: uuid.UUID
    trigger_type: str
    status: str
    orchestration_phase: str | None
    risk_flagged: bool
    started_at: datetime | None
    ended_at: datetime | None
    duration_secs: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    phase: str | None
    timestamp: datetime

    model_config = {"from_attributes": True}


class RecapOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    summary_text: str
    micro_action: str
    followup_point: str
    created_at: datetime

    model_config = {"from_attributes": True}
