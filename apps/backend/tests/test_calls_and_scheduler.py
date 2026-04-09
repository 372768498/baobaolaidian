import uuid
from datetime import datetime, timezone

import pytest

from app.models.conversation_session import ConversationSession
from app.services.call_scheduler import _in_window


@pytest.mark.asyncio
async def test_emergency_call_creates_session(client, authed_user):
    res = await client.post("/api/v1/calls/emergency", headers=authed_user["headers"])
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["trigger_type"] == "emergency"
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_incoming_poll_and_decline_flow(client, authed_user, seeded_persona, db_session):
    me = await client.get("/api/v1/users/me", headers=authed_user["headers"])
    user_id = uuid.UUID(me.json()["id"])
    session = ConversationSession(
        id=uuid.uuid4(),
        user_id=user_id,
        persona_id=seeded_persona.id,
        trigger_type="scheduled",
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(session)
    await db_session.commit()

    incoming = await client.get("/api/v1/calls/incoming", headers=authed_user["headers"])
    assert incoming.status_code == 200
    assert incoming.json()["id"] == str(session.id)

    declined = await client.post(
        f"/api/v1/calls/sessions/{session.id}/decline",
        headers=authed_user["headers"],
    )
    assert declined.status_code == 200
    assert declined.json()["status"] == "missed"


def test_in_window_supports_cross_midnight():
    assert _in_window(datetime.strptime("22:30", "%H:%M").time(), datetime.strptime("22:00", "%H:%M").time(), datetime.strptime("01:00", "%H:%M").time()) is True
    assert _in_window(datetime.strptime("00:30", "%H:%M").time(), datetime.strptime("22:00", "%H:%M").time(), datetime.strptime("01:00", "%H:%M").time()) is True
    assert _in_window(datetime.strptime("14:00", "%H:%M").time(), datetime.strptime("22:00", "%H:%M").time(), datetime.strptime("01:00", "%H:%M").time()) is False
