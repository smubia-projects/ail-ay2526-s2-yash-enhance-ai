import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    app_name: str = "Cute Fusion Lab API"
    output_dir: Path = Path(os.getenv("OUTPUT_DIR", str(BACKEND_ROOT / "generated")))

    # OpenRouter inference
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-2.5-flash-image"

    target_image_size: int = 384

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
