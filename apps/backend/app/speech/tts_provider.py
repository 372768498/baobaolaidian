"""Text-to-speech providers."""

from __future__ import annotations

import json
import logging
import uuid
from base64 import b64decode, b64encode
from datetime import datetime
from json import JSONDecodeError
from typing import AsyncIterator
from urllib.parse import urlparse, urlunparse

import httpx
from app.config import get_settings
from app.speech.base import SpeechMetrics, TTSChunk, TTSProvider

logger = logging.getLogger(__name__)
settings = get_settings()


class MockTTSProvider(TTSProvider):
    """Fallback TTS provider that only yields text deltas for local testing."""

    async def synthesize_stream(self, text: str) -> AsyncIterator[TTSChunk]:
        metrics = SpeechMetrics(tts_start_latency_ms=0, tts_total_duration_ms=0)
        step = 18
        for i in range(0, len(text), step):
            yield TTSChunk(text_delta=text[i:i + step], is_final=False, metrics=metrics)
        yield TTSChunk(is_final=True, metrics=metrics)


class DoubaoTTS2Provider(TTSProvider):
    """
    豆包语音合成 2.0 provider.

    当前先把 provider interface、配置命名与 orchestrator 耦合解开。
    前端完成音频播放后，可在这里切换到真正的 V3 单向流式 TTS 输出。
    """

    def __init__(self) -> None:
        self.app_id = settings.volcengine_app_id
        self.access_token = settings.volcengine_access_token
        self.resource_id = settings.volcengine_tts_resource_id
        self.model = settings.volcengine_tts_model
        self.voice_type = settings.volcengine_tts_voice_type
        self.ws_url = settings.volcengine_tts_ws_url
        self.cluster = settings.volcengine_tts_cluster
        self._interrupt_count = 0
        self._interrupted = False
        self.last_debug_response: dict[str, str | int | None] = {}
        self.last_debug_attempts: list[dict[str, str | int | None]] = []

    async def synthesize_stream(self, text: str) -> AsyncIterator[TTSChunk]:
        started_at = datetime.utcnow()
        if not all([self.app_id, self.access_token, self.voice_type, self.ws_url]):
            logger.warning("doubao tts provider not fully configured, using mock stream")
            async for chunk in MockTTSProvider().synthesize_stream(text):
                chunk.metrics.interrupt_count = self._interrupt_count
                yield chunk
            return

        self._interrupted = False
        self.last_debug_response = {}
        self.last_debug_attempts = []
        request_id = str(uuid.uuid4())
        headers = {
            "X-Api-App-Id": self.app_id,
            "X-Api-Access-Key": self.access_token,
            "X-Api-Resource-Id": self.resource_id,
            "X-Api-Request-Id": request_id,
            "Content-Type": "application/json",
        }
        payload = self._build_payload(text, request_id)
        first_latency_ms: int | None = None
        total_duration_ms: int | None = None
        error_code: str | None = None
        response_has_audio = False
        auth_mode = "unknown"

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
                for auth_mode, headers in self._build_header_candidates(request_id):
                    response_has_audio = False
                    error_code = None
                    try:
                        async with client.stream(
                            "POST",
                            self._resolve_http_stream_url(self.ws_url),
                            headers=headers,
                            json=payload,
                        ) as response:
                            attempt_info = {
                                "status_code": response.status_code,
                                "x_tt_logid": response.headers.get("x-tt-logid"),
                                "headers": json.dumps(dict(response.headers), ensure_ascii=False),
                                "auth_mode": auth_mode,
                                "sent_auth_header_names": ",".join(
                                    key for key in headers.keys()
                                    if key.lower() in {"authorization", "x-api-app-id", "x-api-app-key", "x-api-access-key"}
                                ),
                            }
                            if response.status_code == 401:
                                body = await response.aread()
                                debug_info = {
                                    **attempt_info,
                                    "body": body.decode("utf-8", errors="replace"),
                                }
                                self.last_debug_response = debug_info
                                self.last_debug_attempts.append(debug_info)
                                error_code = "tts_http_401"
                                continue
                            response.raise_for_status()
                            self.last_debug_attempts.append({**attempt_info, "body": None})
                            async for parsed in self._iter_response_chunks(response):
                                if self._interrupted:
                                    break
                                if parsed["type"] == "audio" and parsed["audio_base64"]:
                                    response_has_audio = True
                                    if first_latency_ms is None:
                                        first_latency_ms = int((datetime.utcnow() - started_at).total_seconds() * 1000)
                                    yield TTSChunk(
                                        audio_base64=parsed["audio_base64"],
                                        metrics=SpeechMetrics(
                                            tts_start_latency_ms=first_latency_ms,
                                            interrupt_count=self._interrupt_count,
                                            error_code=error_code,
                                            extras={
                                                "resource_id": self.resource_id,
                                                "model": self.model,
                                                "voice_type": self.voice_type,
                                                "auth_mode": auth_mode,
                                            },
                                        ),
                                    )
                                elif parsed["type"] == "error":
                                    error_code = parsed["code"] or "tts_error"
                                    break
                                elif parsed["type"] == "final":
                                    total_duration_ms = int((datetime.utcnow() - started_at).total_seconds() * 1000)
                                    break
                    except httpx.HTTPError as exc:
                        logger.error("doubao tts request failed with auth_mode=%s: %s", auth_mode, exc)
                        response = getattr(exc, "response", None)
                        if response is not None:
                            try:
                                body = response.text
                            except Exception:
                                body = None
                            debug_info = {
                                **attempt_info,
                                "body": body,
                            }
                            self.last_debug_response = debug_info
                            self.last_debug_attempts.append(debug_info)
                        error_code = f"tts_http_{getattr(getattr(exc, 'response', None), 'status_code', 'transport_error')}"
                    if response_has_audio or self._interrupted:
                        break
        except Exception as exc:
            logger.error("doubao tts request failed: %s", exc)
            error_code = "tts_transport_error"

        if not response_has_audio and error_code is None:
            error_code = "tts_empty_stream"

        yield TTSChunk(
            is_final=True,
            metrics=SpeechMetrics(
                tts_start_latency_ms=first_latency_ms,
                tts_total_duration_ms=total_duration_ms,
                interrupt_count=self._interrupt_count,
                error_code=error_code,
                extras={
                    "resource_id": self.resource_id,
                    "model": self.model,
                    "voice_type": self.voice_type,
                    "auth_mode": auth_mode,
                },
            ),
        )

    async def interrupt(self) -> None:
        self._interrupt_count += 1
        self._interrupted = True

    @staticmethod
    def _resolve_http_stream_url(ws_url: str) -> str:
        parsed = urlparse(ws_url)
        scheme = "https" if parsed.scheme == "wss" else "http"
        path = parsed.path.removesuffix("/stream")
        return urlunparse((scheme, parsed.netloc, path, "", "", ""))

    def _build_payload(self, text: str, request_id: str) -> dict:
        return {
            "user": {"uid": request_id},
            "namespace": "BidirectionalTTS",
            "req_params": {
                "text": text,
                "speaker": self.voice_type,
                "model": self.model,
                "audio_params": {
                    "format": "mp3",
                    "sample_rate": 24000,
                },
                "additions": json.dumps(
                    {
                        "context_texts": ["请用温柔、低刺激、适合陪伴通话的中文口语表达。"],
                        "explicit_language": "zh-cn",
                    },
                    ensure_ascii=False,
                ),
            },
        }

    def _build_header_candidates(self, request_id: str) -> list[tuple[str, dict[str, str]]]:
        candidates: list[tuple[str, dict[str, str]]] = []
        # 这里只尝试豆包语音应用级凭证组合，不再尝试 IAM 风格 AK/SK 或 X-Api-Key。
        candidates.append((
            "app_id_access_token",
            {
                "X-Api-App-Id": self.app_id,
                "X-Api-Access-Key": self.access_token,
                "X-Api-Resource-Id": self.resource_id,
                "X-Api-Request-Id": request_id,
                "Content-Type": "application/json",
            },
        ))
        candidates.append((
            "app_key_access_token",
            {
                "X-Api-App-Key": self.app_id,
                "X-Api-Access-Key": self.access_token,
                "X-Api-Resource-Id": self.resource_id,
                "X-Api-Request-Id": request_id,
                "Content-Type": "application/json",
            },
        ))
        candidates.append((
            "app_id_bearer_access_token",
            {
                "X-Api-App-Id": self.app_id,
                "Authorization": f"Bearer;{self.access_token}",
                "X-Api-Resource-Id": self.resource_id,
                "X-Api-Request-Id": request_id,
                "Content-Type": "application/json",
            },
        ))
        candidates.append((
            "app_key_bearer_access_token",
            {
                "X-Api-App-Key": self.app_id,
                "Authorization": f"Bearer;{self.access_token}",
                "X-Api-Resource-Id": self.resource_id,
                "X-Api-Request-Id": request_id,
                "Content-Type": "application/json",
            },
        ))
        return candidates

    @staticmethod
    def _parse_chunk_line(line: str) -> dict[str, str | None] | None:
        raw = (line or "").strip()
        if not raw:
            return None
        payload = json.loads(raw)
        code = str(payload.get("code", ""))
        if code == "0":
            data = payload.get("data")
            if data:
                return {"type": "audio", "audio_base64": str(data), "code": code}
            return None
        if code == "20000000":
            return {"type": "final", "audio_base64": None, "code": code}
        return {"type": "error", "audio_base64": None, "code": code or "tts_error"}

    @staticmethod
    def decode_audio_chunks(chunks: list[str]) -> bytes:
        return b"".join(b64decode(chunk) for chunk in chunks if chunk)

    async def _iter_response_chunks(self, response: httpx.Response):
        content_type = (response.headers.get("content-type") or "").lower()
        if "text/plain" in content_type:
            saw_audio = False
            text_buffer = bytearray()
            async for chunk in response.aiter_bytes():
                if not chunk:
                    continue
                stripped = chunk.lstrip()
                if not saw_audio and stripped.startswith(b"{"):
                    text_buffer.extend(stripped)
                    try:
                        parsed = self._parse_chunk_line(text_buffer.decode("utf-8", errors="replace"))
                    except JSONDecodeError:
                        continue
                    text_buffer.clear()
                    if parsed:
                        yield parsed
                    continue
                if not saw_audio and text_buffer:
                    text_buffer.extend(chunk)
                    try:
                        parsed = self._parse_chunk_line(text_buffer.decode("utf-8", errors="replace"))
                    except JSONDecodeError:
                        continue
                    text_buffer.clear()
                    if parsed:
                        yield parsed
                    continue
                saw_audio = True
                yield {
                    "type": "audio",
                    "audio_base64": b64encode(chunk).decode("utf-8"),
                    "code": "0",
                }
            yield {"type": "final", "audio_base64": None, "code": "20000000"}
            return

        async for line in response.aiter_lines():
            parsed = self._parse_chunk_line(line)
            if parsed:
                yield parsed
