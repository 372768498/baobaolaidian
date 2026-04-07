"""
应用配置 — 从环境变量加载所有配置项
使用 pydantic-settings 实现类型安全的配置管理
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── 应用基础 ────────────────────────────────
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    # ── 数据库 ──────────────────────────────────
    database_url: str = "postgresql+asyncpg://baobao:baobao_dev_2024@localhost:5432/baobao_laidan"
    sync_database_url: str = "postgresql://baobao:baobao_dev_2024@localhost:5432/baobao_laidan"

    # ── Redis ───────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── JWT 认证 ────────────────────────────────
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 43200  # 30天

    # ── LLM ─────────────────────────────────────
    anthropic_api_key: str = ""           # x-api-key 认证（官方 API）
    anthropic_auth_token: str = ""        # Bearer token 认证（代理 / AWS 网关）
    llm_model: str = "claude-haiku-4-5-20251001"
    llm_base_url: str = ""                # 代理地址，留空则用 api.anthropic.com

    # ── 语音 STT（阿里云）──────────────────────
    aliyun_access_key_id: str = ""
    aliyun_access_key_secret: str = ""
    aliyun_stt_app_key: str = ""

    # ── 语音 TTS（火山引擎）────────────────────
    volcengine_access_key: str = ""
    volcengine_secret_key: str = ""
    volcengine_tts_app_id: str = ""
    volcengine_tts_voice_type: str = "BV001_streaming"

    # ── 推送通知（Firebase）────────────────────
    firebase_project_id: str = ""
    firebase_private_key: str = ""
    firebase_client_email: str = ""

    # ── 业务规则 ────────────────────────────────
    risk_guard_enabled: bool = True
    max_call_duration_secs: int = 1800   # 单次通话最长 30 分钟
    max_calls_per_day: int = 1            # 每天最多主动来电 1 次
    call_retry_interval_mins: int = 15    # 未接补拨间隔

    # ── 分析埋点 ────────────────────────────────
    posthog_api_key: str = ""
    posthog_host: str = "https://app.posthog.com"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # 忽略 .env 中未声明的变量，避免 Extra inputs 报错


@lru_cache()
def get_settings() -> Settings:
    """单例模式：全局共享同一份配置对象"""
    return Settings()


settings = get_settings()
