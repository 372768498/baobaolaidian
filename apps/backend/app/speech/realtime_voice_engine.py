"""Experimental realtime voice engine.

Not part of the default production path. This module exists so the repo has
an explicit integration point for future A/B tests with end-to-end voice.
"""


class DoubaoRealtimeVoiceEngine:
    async def start(self) -> None:
        raise NotImplementedError("Experimental engine is not enabled in production flow")
