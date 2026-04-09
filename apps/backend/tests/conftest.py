import os
import sys
import uuid
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select


TEST_DB_PATH = Path("/tmp/baobaolaidian-test.db")
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_PATH}"
os.environ["SYNC_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["ANTHROPIC_AUTH_TOKEN"] = ""

from app.database import Base, AsyncSessionLocal, async_engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.persona import Persona  # noqa: E402


@pytest_asyncio.fixture(autouse=True)
async def reset_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


@pytest_asyncio.fixture
async def seeded_persona():
    async with AsyncSessionLocal() as db:
        persona = Persona(
            id=uuid.uuid4(),
            name="小暖",
            type="gentle",
            avatar_emoji="🌙",
            description="温柔安抚型 AI",
            personality_tags=["gentle", "warm"],
            system_prompt_template=(
                "你是一个 AI 陪伴助手。用户叫 {user_nickname}。"
                "当前阶段 {phase}。记忆如下：{memory_context}"
            ),
            voice_id="test-voice",
        )
        db.add(persona)
        await db.commit()
        await db.refresh(persona)
        return persona


@pytest_asyncio.fixture
async def authed_user(client: AsyncClient, seeded_persona: Persona):
    register_payload = {
        "phone": "13800138000",
        "password": "password123",
        "nickname": "小王",
        "birth_year": 1996,
    }
    res = await client.post("/api/v1/auth/register", json=register_payload)
    assert res.status_code == 201, res.text
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    await client.put("/api/v1/users/onboarding", json={"avatar_emoji": "🌊"}, headers=headers)
    await client.put(
        "/api/v1/users/onboarding",
        json={"preferred_persona_id": str(seeded_persona.id)},
        headers=headers,
    )
    await client.put(
        "/api/v1/users/onboarding",
        json={"call_time_start": "22:00", "call_time_end": "23:00"},
        headers=headers,
    )
    return {"token": token, "headers": headers}


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as db:
        yield db
