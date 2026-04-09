import pytest


@pytest.mark.asyncio
async def test_register_rejects_underage_user(client):
    res = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": "13800138001",
            "password": "password123",
            "nickname": "未成年",
            "birth_year": 2012,
        },
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "本服务仅对成年用户开放"


@pytest.mark.asyncio
async def test_onboarding_must_be_complete_before_done(client, seeded_persona):
    register = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": "13800138002",
            "password": "password123",
            "nickname": "阿宁",
            "birth_year": 1998,
        },
    )
    token = register.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.put(
        "/api/v1/users/onboarding",
        json={"onboarding_done": True},
        headers=headers,
    )
    assert res.status_code == 400
    assert "preferred_persona_id" in res.json()["detail"]

    await client.put("/api/v1/users/onboarding", json={"avatar_emoji": "⭐"}, headers=headers)
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

    done = await client.put(
        "/api/v1/users/onboarding",
        json={"onboarding_done": True},
        headers=headers,
    )
    assert done.status_code == 200

    me = await client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["onboarding_done"] is True
    assert me.json()["call_time_start"] == "22:00"
    assert me.json()["call_time_end"] == "23:00"
