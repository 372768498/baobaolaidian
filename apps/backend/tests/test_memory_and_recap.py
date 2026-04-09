import uuid

import pytest
from sqlalchemy import select

from app.models.conversation_message import ConversationMessage
from app.models.conversation_session import ConversationSession
from app.models.memory_item import MemoryItem
from app.models.post_call_recap import PostCallRecap
from app.services.memory_service import get_active_memories, upsert_memory
from app.services.post_call_summary import generate_recap


@pytest.mark.asyncio
async def test_memory_upsert_decays_previous_items(db_session, authed_user):
    user_id = uuid.UUID((await _get_me_id(db_session, authed_user["headers"])))
    first = await upsert_memory(db_session, user_id, "recent_concern", "加班很累")
    await db_session.commit()

    second = await upsert_memory(db_session, user_id, "recent_concern", "和同事沟通压力大")
    await db_session.commit()

    memories = await get_active_memories(db_session, user_id)
    first_refreshed = next(m for m in memories if m.id == first.id)
    second_refreshed = next(m for m in memories if m.id == second.id)

    assert first_refreshed.confidence == 0.9
    assert second_refreshed.confidence == 1.0


@pytest.mark.asyncio
async def test_generate_recap_falls_back_without_llm(db_session, authed_user, seeded_persona):
    user_id = uuid.UUID((await _get_me_id(db_session, authed_user["headers"])))
    session = ConversationSession(
        user_id=user_id,
        persona_id=seeded_persona.id,
        trigger_type="emergency",
        status="completed",
    )
    db_session.add(session)
    await db_session.flush()

    db_session.add_all([
        ConversationMessage(session_id=session.id, role="user", content="今天下班后特别空", phase="EMPATHY"),
        ConversationMessage(session_id=session.id, role="assistant", content="我在听你说", phase="EMPATHY"),
        ConversationMessage(session_id=session.id, role="user", content="感觉心里堵得慌", phase="EXPRESSION"),
    ])
    await db_session.commit()

    recap = await generate_recap(db_session, session.id, user_id)
    assert recap is not None

    recap_row = await db_session.execute(select(PostCallRecap).where(PostCallRecap.session_id == session.id))
    assert recap_row.scalar_one_or_none() is not None

    memory_rows = await db_session.execute(select(MemoryItem).where(MemoryItem.user_id == user_id))
    assert len(memory_rows.scalars().all()) >= 1


async def _get_me_id(db_session, headers):
    from app.auth import get_current_user
    token = headers["Authorization"].replace("Bearer ", "")
    user = await get_current_user(token=token, db=db_session)
    return str(user.id)
