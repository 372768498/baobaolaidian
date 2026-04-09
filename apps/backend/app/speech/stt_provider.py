"""Speech-to-text providers."""

from __future__ import annotations

import logging
import gzip
import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urljoin
import websockets

from app.config import get_settings
from app.speech.base import AudioInput, SpeechMetrics, STTProvider, STTResult

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass(frozen=True)
class STTProtocolConfig:
    protocol: str
    required_fields: tuple[str, ...]


class MockSTTProvider(STTProvider):
    """Local deterministic provider used for tests and local fallback."""

    async def transcribe(self, audio: AudioInput) -> STTResult:
        approx_kb = max(1, round(len(audio.audio_bytes) / 1024))
        return STTResult(
            transcript=f"[VOICE_MESSAGE {approx_kb}KB]",
            metrics=SpeechMetrics(final_transcript_latency_ms=0),
        )


class DoubaoStreamingASRProvider(STTProvider):
    """
    火山流式 ASR provider.

    当前代码先完成 provider 边界和配置收口。
    真正联调时会根据协议分支校验不同参数：
      - /api/v2/asr      → 依赖 cluster
      - /api/v3/sauc/... → 依赖 resource_id
    """

    def __init__(self) -> None:
        self.address = settings.volcengine_stt_address
        self.uri = settings.volcengine_stt_uri
        self.cluster = settings.volcengine_stt_cluster
        self.resource_id = settings.volcengine_stt_resource_id
        self.app_id = settings.volcengine_app_id
        self.access_token = settings.volcengine_access_token
        self.protocol_config = self._resolve_protocol_config(self.uri)
        self.endpoint = urljoin(self.address, self.uri)

    async def transcribe(self, audio: AudioInput) -> STTResult:
        started_at = datetime.utcnow()
        missing_fields = self._missing_required_fields()
        if missing_fields:
            logger.warning(
                "doubao stt provider not fully configured for %s, missing=%s; using mock transcript",
                self.protocol_config.protocol,
                ",".join(missing_fields),
            )
            return await MockSTTProvider().transcribe(audio)

        if self.protocol_config.protocol == "v3_bigmodel":
            return await self._transcribe_v3_bigmodel(audio, started_at)

        logger.warning("doubao stt v2_asr protocol is not implemented yet, using mock transcript")
        return await MockSTTProvider().transcribe(audio)

    @staticmethod
    def _resolve_protocol_config(uri: str) -> STTProtocolConfig:
        normalized = (uri or "").strip().lower()
        if normalized.startswith("/api/v2/asr") or "/api/v2/asr" in normalized:
            return STTProtocolConfig(
                protocol="v2_asr",
                required_fields=("address", "uri", "app_id", "access_token", "cluster"),
            )
        return STTProtocolConfig(
            protocol="v3_bigmodel",
            required_fields=("address", "uri", "app_id", "access_token", "resource_id"),
        )

    def _missing_required_fields(self) -> list[str]:
        values = {
            "address": self.address,
            "uri": self.uri,
            "app_id": self.app_id,
            "access_token": self.access_token,
            "cluster": self.cluster,
            "resource_id": self.resource_id,
        }
        return [field for field in self.protocol_config.required_fields if not values.get(field)]

    async def _transcribe_v3_bigmodel(
        self,
        audio: AudioInput,
        started_at: datetime,
    ) -> STTResult:
        request_id = str(uuid.uuid4())
        headers = {
            "X-Api-App-Key": self.app_id,
            "X-Api-Access-Key": self.access_token,
            "X-Api-Resource-Id": self.resource_id,
            "X-Api-Request-Id": request_id,
        }
        if self.cluster:
            headers["X-Api-Cluster"] = self.cluster

        full_client_request = {
            "user": {
                "uid": request_id,
            },
            "audio": {
                "format": audio.audio_format,
                "rate": audio.sample_rate,
                "bits": audio.bits_per_sample,
                "channel": audio.channels,
                "language": audio.language,
            },
            "request": {
                "model_name": "bigmodel",
            },
        }

        transcript = ""
        first_byte_latency_ms: int | None = None
        error_code: str | None = None

        try:
            async with websockets.connect(
                self.endpoint,
                additional_headers=headers,
                max_size=16 * 1024 * 1024,
            ) as ws:
                await ws.send(self._build_json_frame(full_client_request))
                await ws.send(self._build_audio_frame(audio.audio_bytes, is_last=True))

                async for raw in ws:
                    parsed = self._parse_server_frame(raw)
                    if parsed["type"] == "partial":
                        if first_byte_latency_ms is None:
                            first_byte_latency_ms = int((datetime.utcnow() - started_at).total_seconds() * 1000)
                        transcript = parsed["text"] or transcript
                    elif parsed["type"] == "final":
                        transcript = parsed["text"] or transcript
                        break
                    elif parsed["type"] == "error":
                        error_code = parsed["code"] or "stt_error"
                        break
        except Exception as exc:
            logger.error("doubao stt v3 request failed: %s", exc)
            error_code = "stt_transport_error"

        if not transcript:
            fallback = await MockSTTProvider().transcribe(audio)
            fallback.metrics.error_code = error_code
            return fallback

        final_latency_ms = int((datetime.utcnow() - started_at).total_seconds() * 1000)
        return STTResult(
            transcript=transcript,
            metrics=SpeechMetrics(
                first_byte_latency_ms=first_byte_latency_ms,
                final_transcript_latency_ms=final_latency_ms,
                error_code=error_code,
            ),
        )

    @staticmethod
    def _build_json_frame(payload: dict) -> bytes:
        return gzip.compress(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    @staticmethod
    def _build_audio_frame(audio_bytes: bytes, is_last: bool) -> bytes:
        wrapper = {
            "audio": {
                "data": audio_bytes.hex(),
                "is_last": is_last,
            }
        }
        return gzip.compress(json.dumps(wrapper).encode("utf-8"))

    @staticmethod
    def _parse_server_frame(raw: str | bytes) -> dict[str, str | None]:
        payload: dict
        if isinstance(raw, bytes):
            try:
                payload = json.loads(gzip.decompress(raw).decode("utf-8"))
            except Exception:
                payload = json.loads(raw.decode("utf-8"))
        else:
            payload = json.loads(raw)

        result = payload.get("result") or payload.get("payload") or payload
        text = (
            result.get("text")
            or result.get("utterances", [{}])[0].get("text")
            or result.get("alternatives", [{}])[0].get("text")
            or result.get("transcript")
            or ""
        )
        code = str(payload.get("code") or payload.get("status_code") or "")
        status = str(payload.get("status") or payload.get("message_type") or result.get("status") or "")

        if code and code not in {"0", "20000000"}:
            return {"type": "error", "text": text, "code": code}
        if status.lower() in {"final", "done", "completed"} or payload.get("is_final") is True:
            return {"type": "final", "text": text, "code": code}
        return {"type": "partial", "text": text, "code": code}
