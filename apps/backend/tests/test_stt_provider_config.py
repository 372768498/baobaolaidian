from app.config import get_settings
from app.speech.stt_provider import DoubaoStreamingASRProvider


def test_v2_protocol_requires_cluster():
    config = DoubaoStreamingASRProvider._resolve_protocol_config("/api/v2/asr")
    assert config.protocol == "v2_asr"
    assert "cluster" in config.required_fields
    assert "resource_id" not in config.required_fields


def test_v3_bigmodel_protocol_requires_resource_id_not_cluster():
    config = DoubaoStreamingASRProvider._resolve_protocol_config("/api/v3/sauc/bigmodel")
    assert config.protocol == "v3_bigmodel"
    assert "resource_id" in config.required_fields
    assert "cluster" not in config.required_fields


def test_default_resource_id_is_config_driven():
    settings = get_settings()
    provider = DoubaoStreamingASRProvider()
    assert provider.resource_id == settings.volcengine_stt_resource_id
    assert provider.resource_id == "volc.bigasr.sauc.duration"
