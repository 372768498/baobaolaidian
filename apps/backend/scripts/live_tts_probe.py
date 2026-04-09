"""Probe the first bytes of the Volcengine TTS HTTP chunked response."""

from __future__ import annotations

import asyncio
import gzip
import json
import os
import sys
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv


def build_payload(text: str, request_id: str, speaker: str, model: str | None) -> dict:
    req_params = {
        "text": text,
        "speaker": speaker,
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
    }
    if model:
        req_params["model"] = model
    return {
        "user": {"uid": request_id},
        "namespace": "BidirectionalTTS",
        "req_params": req_params,
    }


async def main() -> int:
    load_dotenv(Path("/Users/d/baobaolaidian/.env"))
    request_id = str(uuid.uuid4())
    url = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
    speaker_candidates = [
        ("BV700_V2_streaming", os.environ.get("VOLCENGINE_TTS_MODEL")),
        ("zh_female_vv_uranus_bigtts", None),
        ("zh_female_xiaohe_uranus_bigtts", None),
        ("saturn_zh_female_cancan_tob", os.environ.get("VOLCENGINE_TTS_MODEL")),
    ]
    header_sets = [
        (
            "app_id_access_token",
            {
                "X-Api-App-Id": os.environ["VOLCENGINE_APP_ID"],
                "X-Api-Access-Key": os.environ["VOLCENGINE_ACCESS_TOKEN"],
                "X-Api-Resource-Id": os.environ["VOLCENGINE_TTS_RESOURCE_ID"],
                "X-Api-Request-Id": request_id,
                "Content-Type": "application/json",
            },
        ),
        (
            "app_key_access_token",
            {
                "X-Api-App-Key": os.environ["VOLCENGINE_APP_ID"],
                "X-Api-Access-Key": os.environ["VOLCENGINE_ACCESS_TOKEN"],
                "X-Api-Resource-Id": os.environ["VOLCENGINE_TTS_RESOURCE_ID"],
                "X-Api-Request-Id": request_id,
                "Content-Type": "application/json",
            },
        ),
    ]

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
        for speaker, model in speaker_candidates:
            payload = build_payload("晚上好，我在。", request_id, speaker, model)
            print(f"=== speaker={speaker} model={model} ===")
            for name, headers in header_sets:
                print(f"--- auth={name} ---")
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    print("status", response.status_code)
                    print("x-tt-logid", response.headers.get("x-tt-logid"))
                    count = 0
                    collected = bytearray()
                    async for raw in response.aiter_raw():
                        count += 1
                        collected.extend(raw)
                        preview = raw[:64]
                        print(
                            "chunk",
                            count,
                            {
                                "len": len(raw),
                                "hex": preview.hex(),
                                "ascii": preview.decode("utf-8", errors="replace"),
                            },
                        )
                        if count >= 5:
                            break
                    print("collected_len", len(collected))
                    try:
                        print("gzip_decoded", gzip.decompress(bytes(collected)).decode("utf-8", errors="replace"))
                    except Exception as exc:
                        print("gzip_decode_error", repr(exc))
            print()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
