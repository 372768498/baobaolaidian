import base64
import json

import pytest

from app.models.conversation_session import ConversationSession
from app.models.user import User
from app.services.conversation_orchestrator import CallOrchestrator
from app.services.risk_guard import RiskLevel, RiskResult
from app.speech.base import AudioInput, SpeechMetrics, STTResult, TTSChunk, TTSProvider, STTProvider


class FakeWebSocket:
    def __init__(self, messages: list[dict]):
        self._messages = [json.dumps(m) for m in messages]
        self.sent: list[dict] = []

    async def receive_text(self) -> str:
        if not self._messages:
            raise RuntimeError("no more frames")
        return self._messages.pop(0)

    async def send_text(self, payload: str) -> None:
        self.sent.append(json.loads(payload))


class FakeSTTProvider(STTProvider):
    async def transcribe(self, audio: AudioInput) -> STTResult:
        assert audio.audio_bytes == b"fake-audio-binary"
        assert audio.audio_format == "wav"
        assert audio.sample_rate == 16000
        return STTResult(
            transcript="今天有点难过",
            metrics=SpeechMetrics(final_transcript_latency_ms=12),
        )


class FakeTTSProvider(TTSProvider):
    def __init__(self) -> None:
        self.interrupted = False

    async def synthesize_stream(self, text: str):
        yield TTSChunk(text_delta=text, metrics=SpeechMetrics(tts_start_latency_ms=8))
        yield TTSChunk(is_final=True)

    async def interrupt(self) -> None:
        self.interrupted = True


@pytest.mark.asyncio
async def test_audio_chunk_chain_uses_stt_provider(db_session, seeded_persona):
    user = User(
        phone="13800138009",
        hashed_password="hashed",
        nickname="语音用户",
        is_adult=True,
    )
    db_session.add(user)
    await db_session.flush()

    session = ConversationSession(
        user_id=user.id,
        persona_id=seeded_persona.id,
        trigger_type="emergency",
        status="pending",
    )
    db_session.add(session)
    await db_session.flush()

    audio_payload = base64.b64encode(b"fake-audio-binary").decode("utf-8")
    ws = FakeWebSocket([
        {"type": "audio_chunk", "data": audio_payload},
        {"type": "end_of_speech"},
    ])

    orchestrator = CallOrchestrator(
        ws=ws,
        db=db_session,
        session=session,
        user=user,
        stt_provider=FakeSTTProvider(),
    )
    text = await orchestrator._receive_user_speech()

    assert text == "今天有点难过"
    assert orchestrator.voice_metrics.final_transcript_latency_ms == 12


@pytest.mark.asyncio
async def test_risk_interrupt_calls_tts_provider_interrupt(db_session, seeded_persona):
    user = User(
        phone="13800138010",
        hashed_password="hashed",
        nickname="风控用户",
        is_adult=True,
    )
    db_session.add(user)
    await db_session.flush()

    session = ConversationSession(
        user_id=user.id,
        persona_id=seeded_persona.id,
        trigger_type="emergency",
        status="answered",
    )
    db_session.add(session)
    await db_session.flush()

    ws = FakeWebSocket([])
    tts_provider = FakeTTSProvider()
    orchestrator = CallOrchestrator(
        ws=ws,
        db=db_session,
        session=session,
        user=user,
        tts_provider=tts_provider,
    )

    risk = RiskResult(
        level=RiskLevel.CRITICAL,
        risk_type="suicidal",
        trigger_text="...不想活...",
        action_taken="interrupt_and_safety_script",
    )
    await orchestrator._handle_critical_risk("我不想活了", risk)

    assert tts_provider.interrupted is True
    assert orchestrator.voice_metrics.interrupt_count == 1
    assert ws.sent[-1]["type"] == "risk_alert"
