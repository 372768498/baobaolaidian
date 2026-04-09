from app.speech.tts_provider import DoubaoTTS2Provider


def test_resolve_http_stream_url_from_ws_url():
    assert DoubaoTTS2Provider._resolve_http_stream_url(
        "wss://openspeech.bytedance.com/api/v3/tts/unidirectional/stream"
    ) == "https://openspeech.bytedance.com/api/v3/tts/unidirectional"


def test_parse_chunk_line_for_audio_and_final():
    audio = DoubaoTTS2Provider._parse_chunk_line('{"code":0,"message":"","data":"ZmFrZQ=="}')
    assert audio == {"type": "audio", "audio_base64": "ZmFrZQ==", "code": "0"}

    final = DoubaoTTS2Provider._parse_chunk_line('{"code":20000000,"message":"OK","data":null}')
    assert final == {"type": "final", "audio_base64": None, "code": "20000000"}


def test_decode_audio_chunks():
    decoded = DoubaoTTS2Provider.decode_audio_chunks(["ZmFrZQ==", "LWF1ZGlv"])
    assert decoded == b"fake-audio"
