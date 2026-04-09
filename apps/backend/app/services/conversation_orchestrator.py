"""
通话编排器 — 6 阶段状态机

阶段流转：
  OPENING → EMPATHY → EXPRESSION → SUMMARY → MICRO_ACTION → CLOSING

每轮流程：
  1. 接收用户语音 → STT 转文字
  2. 风控检测
  3. 判断是否推进阶段
  4. 组装 system prompt（人格引擎）
  5. 调用 LLM 生成回复
  6. TTS 流式返回给客户端
  7. 存储对话消息

WebSocket 消息格式（JSON over WS）：
  客户端发: {"type": "audio_chunk", "data": "<base64>"}
            {"type": "end_of_speech"}
            {"type": "hangup"}
  服务端发: {"type": "tts_chunk", "data": "<base64>"}
            {"type": "phase_change", "phase": "EMPATHY"}
            {"type": "risk_alert", "level": "critical"}
            {"type": "call_ended"}
"""
import uuid
import json
import base64
import logging
from datetime import datetime, timezone

from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from anthropic import AsyncAnthropic

from app.config import get_settings
from app.models.conversation_session import ConversationSession
from app.models.conversation_message import ConversationMessage
from app.models.risk_event import RiskEvent
from app.models.user import User
from app.speech import (
    AudioInput,
    DoubaoStreamingASRProvider,
    DoubaoTTS2Provider,
    SpeechMetrics,
    STTProvider,
    TTSProvider,
)
from app.services import risk_guard, persona_engine
from app.services.risk_guard import RiskLevel

logger = logging.getLogger(__name__)
settings = get_settings()

# ── 阶段配置 ──────────────────────────────────────────────────────────────────
# 每个阶段预计的最少轮数（达到后才允许推进）
PHASE_MIN_TURNS = {
    "OPENING": 1,
    "EMPATHY": 2,
    "EXPRESSION": 2,
    "SUMMARY": 1,
    "MICRO_ACTION": 1,
    "CLOSING": 1,
}
PHASE_ORDER = list(PHASE_MIN_TURNS.keys())

# 安全话术（风控触发时直接朗读，不走 LLM）
_SAFETY_SCRIPT = (
    "我听到你了，你说的这些让我很担心你的安全。"
    "我现在需要暂停我们的通话，请你立刻拨打心理援助热线：北京 010-82951332，"
    "或者全国热线 400-161-9995。你不是一个人。"
)

_LOCAL_PHASE_RESPONSES = {
    "OPENING": "我是 AI 陪伴助手，这通电话里我会一直在。今晚你现在最想先说哪一件事？",
    "EMPATHY": "我在认真听。你不用急着整理得很完整，只要把此刻最难受的感觉说出来就好。",
    "EXPRESSION": "如果把今天最压着你的那件事再说具体一点，我会更容易陪你一起把它放下来。",
    "SUMMARY": "我先帮你收一下：今晚你其实已经撑了很久，也一直在努力不让自己垮下去。",
    "MICRO_ACTION": "现在先只做一件很小的事吧，去喝几口温水，坐下来慢慢呼吸三次。",
    "CLOSING": "谢谢你愿意接这通 AI 来电。今晚先到这里，我会记得你刚刚说过的话。晚一点也要对自己温柔一点。",
}


class CallOrchestrator:
    """
    单次通话的生命周期管理器。
    每个 WebSocket 连接对应一个实例。
    """

    def __init__(
        self,
        ws: WebSocket,
        db: AsyncSession,
        session: ConversationSession,
        user: User,
        stt_provider: STTProvider | None = None,
        tts_provider: TTSProvider | None = None,
    ):
        self.ws = ws
        self.db = db
        self.session = session
        self.user = user
        # 支持两种认证模式：
        #   auth_token → Bearer（代理 / AWS 网关）
        #   api_key    → x-api-key（官方 API）
        _client_kwargs: dict = {}
        if settings.llm_base_url:
            _client_kwargs["base_url"] = settings.llm_base_url
        if settings.anthropic_auth_token:
            _client_kwargs["auth_token"] = settings.anthropic_auth_token
        else:
            _client_kwargs["api_key"] = settings.anthropic_api_key
        self.client = AsyncAnthropic(**_client_kwargs)

        self.current_phase = "OPENING"
        self.phase_turn_count = 0          # 当前阶段已完成轮数
        self.total_turns = 0               # 全局轮数
        self.history: list[dict] = []      # LLM messages list
        self.stt_provider = stt_provider or DoubaoStreamingASRProvider()
        self.tts_provider = tts_provider or DoubaoTTS2Provider()
        self.voice_metrics = SpeechMetrics()

    async def run(self) -> None:
        """主循环：持续接收音频帧，处理每轮对话"""
        # 更新 session 状态
        self.session.status = "answered"
        self.session.started_at = datetime.now(timezone.utc)
        self.session.orchestration_phase = self.current_phase
        await self.db.commit()

        try:
            # 发送开场白
            await self._ai_turn(user_text=None)

            # 主对话循环
            while True:
                user_text = await self._receive_user_speech()
                if user_text is None:
                    # 客户端挂断
                    break

                # 风控检测
                risk = await risk_guard.check(user_text)
                if risk.level == RiskLevel.CRITICAL:
                    await self._handle_critical_risk(user_text, risk)
                    break

                # 正常轮次
                await self._save_message("user", user_text)
                await self._ai_turn(user_text)

                # 检查总时长限制
                if self.total_turns >= self._max_turns():
                    await self._advance_to_closing()
                    await self._ai_turn(user_text=None)
                    break

        except Exception as e:
            logger.error("orchestrator error session=%s: %s", self.session.id, e)
        finally:
            await self._end_call()

    # ── 私有方法 ──────────────────────────────────────────────────────────────

    async def _receive_user_speech(self) -> str | None:
        """
        接收客户端 audio_chunk 帧，累积后返回 STT 文字。
        此处为简化版：客户端直接发送文字（实际项目中接 STT 服务）。
        """
        audio_chunks: list[bytes] = []
        audio_meta = {
            "audio_format": "wav",
            "sample_rate": 16000,
            "bits_per_sample": 16,
            "channels": 1,
            "language": "zh-CN",
        }

        while True:
            try:
                raw = await self.ws.receive_text()
                msg = json.loads(raw)
            except Exception:
                return None  # 连接断开

            msg_type = msg.get("type")

            if msg_type in ("hangup", "hang_up"):
                return None

            if msg_type == "audio_chunk":
                chunk = base64.b64decode(msg["data"])
                audio_chunks.append(chunk)
                audio_meta["audio_format"] = msg.get("audio_format", audio_meta["audio_format"])
                audio_meta["sample_rate"] = int(msg.get("sample_rate", audio_meta["sample_rate"]))
                audio_meta["bits_per_sample"] = int(msg.get("bits_per_sample", audio_meta["bits_per_sample"]))
                audio_meta["channels"] = int(msg.get("channels", audio_meta["channels"]))
                audio_meta["language"] = msg.get("language", audio_meta["language"])

            elif msg_type == "end_of_speech":
                if audio_chunks:
                    return await self._transcribe_audio_chunks(audio_chunks, audio_meta)

            elif msg_type == "stt_result":
                # 前端文字模式（MVP）：直接返回文字，跳过 STT
                return msg.get("text", "")

            elif msg_type == "text":
                # 兼容旧格式（调试用）
                return msg.get("content", "")

    async def _ai_turn(self, user_text: str | None) -> None:
        """
        生成 AI 回复并通过 WebSocket 流式发送 TTS 音频。
        """
        # 组装 system prompt
        system = await persona_engine.build_system_prompt(
            db=self.db,
            persona_id=self.session.persona_id,
            user_id=self.user.id,
            phase=self.current_phase,
            nickname=self.user.nickname,
        )

        # 更新 LLM 历史
        if user_text:
            self.history.append({"role": "user", "content": user_text})

        # 阶段引导提示（隐藏在 system 尾部）
        phase_hint = self._phase_hint()
        full_system = f"{system}\n\n【当前阶段】{self.current_phase}：{phase_hint}"

        assistant_text = ""
        if not (settings.anthropic_api_key or settings.anthropic_auth_token):
            assistant_text = self._fallback_response(user_text)
        else:
            async with self.client.messages.stream(
                model=settings.llm_model,
                max_tokens=200,
                system=full_system,
                messages=self.history,
                ) as stream:
                    async for text_delta in stream.text_stream:
                        assistant_text += text_delta

        async for chunk in self.tts_provider.synthesize_stream(assistant_text):
            if chunk.metrics:
                self._merge_voice_metrics(chunk.metrics)
            if chunk.text_delta:
                await self.ws.send_text(json.dumps({
                    "type": "text_delta",
                    "delta": chunk.text_delta,
                }))
            if chunk.audio_base64:
                await self.ws.send_text(json.dumps({
                    "type": "tts_chunk",
                    "data": chunk.audio_base64,
                }))

        # 完整轮次结束帧（前端用 full_text 更新消息列表）
        await self.ws.send_text(json.dumps({
            "type": "text_done",
            "full_text": assistant_text,
        }))

        # 保存 AI 消息
        await self._save_message("assistant", assistant_text)
        self.history.append({"role": "assistant", "content": assistant_text})

        # 推进阶段
        self.phase_turn_count += 1
        self.total_turns += 1
        self._maybe_advance_phase()

    async def _save_message(self, role: str, content: str) -> None:
        msg = ConversationMessage(
            session_id=self.session.id,
            role=role,
            content=content,
            phase=self.current_phase,
        )
        self.db.add(msg)
        await self.db.flush()

    async def _handle_critical_risk(self, user_text: str, risk) -> None:
        """风控触发：记录事件，发送安全话术，结束通话"""
        self.session.risk_flagged = True
        self.session.status = "risk_interrupted"

        event = RiskEvent(
            session_id=self.session.id,
            user_id=self.user.id,
            risk_type=risk.risk_type,
            trigger_text=risk.trigger_text,
            action_taken=risk.action_taken,
        )
        self.db.add(event)
        await self.db.commit()
        await self.tts_provider.interrupt()
        self.voice_metrics.interrupt_count += 1

        # 发送安全话术（不走 LLM）
        await self.ws.send_text(json.dumps({
            "type": "risk_alert",
            "level": "critical",
            "script": _SAFETY_SCRIPT,
        }))
        logger.warning(
            "orchestrator: CRITICAL risk in session %s | type=%s",
            self.session.id, risk.risk_type,
        )

    async def _end_call(self) -> None:
        """更新 session 结束状态"""
        now = datetime.now(timezone.utc)
        self.session.ended_at = now
        if self.session.started_at:
            delta = now - self.session.started_at
            self.session.duration_secs = int(delta.total_seconds())
        if self.session.status not in ("risk_interrupted",):
            self.session.status = "completed"
        await self.db.commit()
        logger.info(
            "orchestrator: session=%s metrics=%s",
            self.session.id,
            {
                "first_byte_latency_ms": self.voice_metrics.first_byte_latency_ms,
                "final_transcript_latency_ms": self.voice_metrics.final_transcript_latency_ms,
                "tts_start_latency_ms": self.voice_metrics.tts_start_latency_ms,
                "tts_total_duration_ms": self.voice_metrics.tts_total_duration_ms,
                "interrupt_count": self.voice_metrics.interrupt_count,
                "error_code": self.voice_metrics.error_code,
            },
        )

        await self.ws.send_text(json.dumps({"type": "call_ended"}))

    def _maybe_advance_phase(self) -> None:
        """根据轮数决定是否推进到下一阶段"""
        current_idx = PHASE_ORDER.index(self.current_phase)
        min_turns = PHASE_MIN_TURNS[self.current_phase]

        if self.phase_turn_count >= min_turns and current_idx < len(PHASE_ORDER) - 1:
            next_phase = PHASE_ORDER[current_idx + 1]
            self.current_phase = next_phase
            self.phase_turn_count = 0
            self.session.orchestration_phase = next_phase
            # 异步通知客户端（非阻塞）
            import asyncio
            asyncio.create_task(self.ws.send_text(json.dumps({
                "type": "phase_change",
                "phase": next_phase,
            })))

    async def _advance_to_closing(self) -> None:
        self.current_phase = "CLOSING"
        self.phase_turn_count = 0
        self.session.orchestration_phase = "CLOSING"

    def _phase_hint(self) -> str:
        hints = {
            "OPENING": "用温暖的问候开场，询问用户今晚感觉如何。",
            "EMPATHY": "专注倾听，对用户的感受做出共情回应，不急于给建议。",
            "EXPRESSION": "引导用户把今天最大的感受说出来，帮助他/她表达清楚。",
            "SUMMARY": "用一两句话总结用户今晚分享的内容，确认理解是否准确。",
            "MICRO_ACTION": "提议一件今晚可以做的具体小事，简单、可行。",
            "CLOSING": "温柔道别，告诉用户你会记得今晚，期待下次通话。",
        }
        return hints.get(self.current_phase, "")

    def _max_turns(self) -> int:
        """根据最大通话时长估算最多轮数（假设每轮约 60s）"""
        return settings.max_call_duration_secs // 60

    def _fallback_response(self, user_text: str | None) -> str:
        """无 LLM 配置时的本地回复，保证联调和测试可以闭环。"""
        base = _LOCAL_PHASE_RESPONSES.get(self.current_phase, _LOCAL_PHASE_RESPONSES["EMPATHY"])
        if not user_text:
            return base

        user_text = user_text.strip()
        if self.current_phase == "EMPATHY":
            if user_text.startswith("[VOICE_MESSAGE"):
                return "我收到你刚刚发来的语音了。虽然这版还不能逐字转成文字，但我已经接住这次表达。你愿意再继续说一点，或者用文字补一句最难受的点吗？"
            return f"我听见你刚刚提到“{user_text[:24]}”。这件事落在你身上，难受是很自然的。你可以继续慢慢说。"
        if self.current_phase == "EXPRESSION":
            if user_text.startswith("[VOICE_MESSAGE"):
                return "这段语音我已经收到。你可以继续发下一段，或者用一句话告诉我，这件事最压你的地方是什么。"
            return f"你已经说得很勇敢了。关于“{user_text[:24]}”，最刺痛你的那一刻是什么？"
        if self.current_phase == "SUMMARY":
            return f"我理解到的是：你最近一直被“{user_text[:24]}”牵着情绪走，也很想先稳住自己。"
        if self.current_phase == "MICRO_ACTION":
            return "我们先不解决全部问题。现在只做一件最小的事：放下手机前，喝水、洗把脸，或者把窗户打开半分钟。"
        if self.current_phase == "CLOSING":
            return "今晚先说到这里。你已经比刚接通时更稳一点了，剩下的事明天再处理也来得及。"
        return base

    async def _transcribe_audio_chunks(self, audio_chunks: list[bytes], audio_meta: dict[str, str | int]) -> str:
        result = await self.stt_provider.transcribe(
            AudioInput(
                audio_bytes=b"".join(audio_chunks),
                audio_format=str(audio_meta["audio_format"]),
                sample_rate=int(audio_meta["sample_rate"]),
                bits_per_sample=int(audio_meta["bits_per_sample"]),
                channels=int(audio_meta["channels"]),
                language=str(audio_meta["language"]),
            )
        )
        self._merge_voice_metrics(result.metrics)
        return result.transcript

    def _merge_voice_metrics(self, incoming: SpeechMetrics) -> None:
        if incoming.first_byte_latency_ms is not None:
            self.voice_metrics.first_byte_latency_ms = incoming.first_byte_latency_ms
        if incoming.final_transcript_latency_ms is not None:
            self.voice_metrics.final_transcript_latency_ms = incoming.final_transcript_latency_ms
        if incoming.tts_start_latency_ms is not None:
            self.voice_metrics.tts_start_latency_ms = incoming.tts_start_latency_ms
        if incoming.tts_total_duration_ms is not None:
            self.voice_metrics.tts_total_duration_ms = incoming.tts_total_duration_ms
        if incoming.error_code:
            self.voice_metrics.error_code = incoming.error_code
        self.voice_metrics.interrupt_count += incoming.interrupt_count
        self.voice_metrics.extras.update(incoming.extras)
