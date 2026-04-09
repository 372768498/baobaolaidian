"""Minimal live smoke test for Volcengine TTS v3 single-direction streaming."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from app.speech.tts_provider import DoubaoTTS2Provider


async def main() -> int:
    provider = DoubaoTTS2Provider()
    audio_chunks: list[str] = []
    final_metrics = None

    async for chunk in provider.synthesize_stream("晚上好。我会用很轻的语气陪你说几句话。"):
        if chunk.audio_base64:
            audio_chunks.append(chunk.audio_base64)
        if chunk.is_final:
            final_metrics = chunk.metrics

    audio_bytes = provider.decode_audio_chunks(audio_chunks)
    if not audio_bytes:
        print(
            f"TTS live smoke failed: no audio bytes returned, error_code={getattr(final_metrics, 'error_code', None)}",
            file=sys.stderr,
        )
        if provider.last_debug_response:
            print(f"debug={provider.last_debug_response}", file=sys.stderr)
        if provider.last_debug_attempts:
            print(f"debug_attempts={provider.last_debug_attempts}", file=sys.stderr)
        return 1

    output_path = Path("/tmp/baobao_tts_smoke.mp3")
    output_path.write_bytes(audio_bytes)
    print(
        "TTS live smoke ok:",
        {
            "audio_bytes": len(audio_bytes),
            "output": str(output_path),
            "tts_start_latency_ms": getattr(final_metrics, "tts_start_latency_ms", None),
            "tts_total_duration_ms": getattr(final_metrics, "tts_total_duration_ms", None),
            "error_code": getattr(final_metrics, "error_code", None),
        },
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
