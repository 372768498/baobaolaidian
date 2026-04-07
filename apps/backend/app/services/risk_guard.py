"""
风控守卫服务 — 双层过滤

Layer 1: 关键词命中（同步，0 延迟）
Layer 2: LLM 语义判断（仅当 Layer 1 触发时）

风险等级:
  - WARNING: 提示需要帮助，但不立即中断通话
  - CRITICAL: 立即打断通话，切换安全话术
"""
import re
import logging
from dataclasses import dataclass
from enum import Enum

from anthropic import AsyncAnthropic

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Layer 1: 关键词词典 ───────────────────────────────────────────────────────
# 每个 risk_type 对应若干触发词（正则模式）
_KEYWORD_RULES: dict[str, list[str]] = {
    "suicidal": [
        r"不想活", r"去死", r"自杀", r"结束生命", r"活不下去",
        r"想死", r"死了算了", r"生无可恋",
    ],
    "self_harm": [
        r"割腕", r"割自己", r"伤害自己", r"自残", r"划手",
    ],
    "harm_others": [
        r"想杀", r"弄死他", r"弄死她", r"报复",
    ],
    "minor": [
        r"未成年", r"小孩子", r"我才\d{1,2}岁", r"初中", r"小学生",
    ],
    "dangerous_drug": [
        r"过量服药", r"吃了很多药", r"安眠药吃了", r"买到了药",
    ],
}

# 预编译所有正则，提升匹配速度
_COMPILED_RULES: dict[str, list[re.Pattern]] = {
    risk_type: [re.compile(pat) for pat in patterns]
    for risk_type, patterns in _KEYWORD_RULES.items()
}

# 哪些风险类型需要立即中断（CRITICAL），其余为 WARNING
_CRITICAL_TYPES = {"suicidal", "self_harm", "harm_others"}


class RiskLevel(str, Enum):
    NONE = "none"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class RiskResult:
    level: RiskLevel
    risk_type: str | None = None        # e.g. "suicidal"
    trigger_text: str | None = None     # 已脱敏的触发片段
    action_taken: str = "none"          # logged to DB


def _keyword_scan(text: str) -> tuple[str | None, str | None]:
    """
    Layer 1 关键词扫描。
    返回 (risk_type, trigger_text) 或 (None, None)。
    触发文本只保留关键词前后各 10 个字（脱敏）。
    """
    for risk_type, patterns in _COMPILED_RULES.items():
        for pattern in patterns:
            m = pattern.search(text)
            if m:
                start = max(0, m.start() - 10)
                end = min(len(text), m.end() + 10)
                snippet = f"...{text[start:end]}..."
                return risk_type, snippet
    return None, None


async def _llm_confirm(text: str, risk_type: str) -> bool:
    """
    Layer 2: 用 LLM 二次确认是否真正存在风险。
    减少关键词误报（比如"不想活动了"）。
    """
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = (
        f"以下是用户在 AI 陪伴通话中说的话，请判断是否存在真实的「{risk_type}」风险。\n"
        f"只回答 YES 或 NO，不要解释。\n\n用户原文：{text}"
    )
    try:
        msg = await client.messages.create(
            model=settings.llm_model,
            max_tokens=10,
            messages=[{"role": "user", "content": prompt}],
        )
        answer = msg.content[0].text.strip().upper()
        return answer.startswith("YES")
    except Exception as e:
        # LLM 调用失败时保守处理：视为有风险
        logger.error("risk_guard LLM confirm failed: %s", e)
        return True


async def check(text: str) -> RiskResult:
    """
    主入口：对用户发言做风险检测。
    调用方：conversation_orchestrator 在每轮 STT 结果上调用。
    """
    risk_type, trigger_text = _keyword_scan(text)

    if risk_type is None:
        return RiskResult(level=RiskLevel.NONE)

    # Layer 2: LLM 确认
    confirmed = await _llm_confirm(text, risk_type)
    if not confirmed:
        logger.info("risk_guard: keyword hit but LLM dismissed (type=%s)", risk_type)
        return RiskResult(level=RiskLevel.NONE)

    level = RiskLevel.CRITICAL if risk_type in _CRITICAL_TYPES else RiskLevel.WARNING
    action = "interrupt_and_safety_script" if level == RiskLevel.CRITICAL else "log_and_monitor"

    logger.warning(
        "risk_guard: CONFIRMED %s | level=%s | snippet=%s",
        risk_type, level, trigger_text,
    )
    return RiskResult(
        level=level,
        risk_type=risk_type,
        trigger_text=trigger_text,
        action_taken=action,
    )
