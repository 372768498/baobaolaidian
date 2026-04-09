import pytest

from app.services.risk_guard import RiskLevel, check


@pytest.mark.asyncio
async def test_risk_guard_interrupts_self_harm_keywords():
    result = await check("我刚刚真的想割腕，不想活了")
    assert result.level == RiskLevel.CRITICAL
    assert result.risk_type in {"self_harm", "suicidal"}
    assert result.action_taken == "interrupt_and_safety_script"
