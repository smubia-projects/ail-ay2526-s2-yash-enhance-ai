import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    app_name: str = "Cute Fusion Lab API"
    output_dir: Path = Path(os.getenv("OUTPUT_DIR", str(BACKEND_ROOT / "generated")))

    # AI API configuration
    api_key: str = ""
    image_model_name: str = "google/gemini-2.5-flash-image"
    api_base_url: str = "https://openrouter.ai/api/v1"

    target_image_size: int = 384

    # Rate limiting (per IP, per project) — fallback when central config is absent
    rate_limit_generate_max: int = 5
    rate_limit_window_seconds: int = 5 * 24 * 60 * 60  # 5 days
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    upstash_redis_url: str = ""
    upstash_redis_token: str = ""

    @property
    def redis_url(self) -> str:
        """Accept both Upstash-default (REST_) and short env var names."""
        return self.upstash_redis_rest_url or self.upstash_redis_url

    @property
    def redis_token(self) -> str:
        """Accept both Upstash-default (REST_) and short env var names."""
        return self.upstash_redis_rest_token or self.upstash_redis_token

    # Telegram
    telegram_bot_token: str = ""

    cors_origins: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


settings = Settings()
