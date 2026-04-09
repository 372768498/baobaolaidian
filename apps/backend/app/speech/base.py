"""Common interfaces for speech providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass
class SpeechMetrics:
    first_byte_latency_ms: int | None = None
    final_transcript_latency_ms: int | None = None
    tts_start_latency_ms: int | None = None
    tts_total_duration_ms: int | None = None
    interrupt_count: int = 0
    error_code: str | None = None
    extras: dict[str, str | int | float] = field(default_factory=dict)


@dataclass
class AudioInput:
    audio_bytes: bytes
    audio_format: str = "wav"
    sample_rate: int = 16000
    bits_per_sample: int = 16
    channels: int = 1
    language: str = "zh-CN"


@dataclass
class STTResult:
    transcript: str
    is_final: bool = True
    metrics: SpeechMetrics = field(default_factory=SpeechMetrics)


@dataclass
class TTSChunk:
    audio_base64: str | None = None
    text_delta: str | None = None
    is_final: bool = False
    metrics: SpeechMetrics | None = None


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio: AudioInput) -> STTResult:
        """Transcribe a single utterance worth of audio bytes."""


class TTSProvider(ABC):
    @abstractmethod
    async def synthesize_stream(self, text: str) -> AsyncIterator[TTSChunk]:
        """Yield streaming TTS chunks for a single assistant reply."""

    async def interrupt(self) -> None:
        """Interrupt the current synthesis stream if the provider supports it."""
        return None
