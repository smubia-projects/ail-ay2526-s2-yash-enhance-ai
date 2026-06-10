from __future__ import annotations

import base64
import io
from dataclasses import dataclass

import requests
from PIL import Image

from app.config import settings


class GenerationError(Exception):
    """Raised for errors that are safe to show directly to the user."""


@dataclass
class GenerationSettings:
    prompt: str
    negative_prompt: str  # kept for UI display only
    seed: int | None = None


class PhotoMakerService:
    def __init__(self) -> None:
        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
        })

    @staticmethod
    def _image_to_data_url(img: Image.Image) -> str:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=60)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{b64}"

    def generate(
        self,
        id_images: list[Image.Image],
        options: GenerationSettings,
    ) -> Image.Image:
        if not settings.openrouter_api_key:
            raise RuntimeError("API key not configured.")

        content_parts: list[dict] = []
        for img in id_images:
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": self._image_to_data_url(img)},
            })
        content_parts.append({"type": "text", "text": options.prompt})

        payload = {
            "model": settings.openrouter_model,
            "messages": [{"role": "user", "content": content_parts}],
            "modalities": ["image", "text"],
            "max_tokens": 1024,
        }

        for attempt in range(3):
            response = self._session.post(
                "https://openrouter.ai/api/v1/chat/completions",
                json=payload,
                timeout=180,
            )

            if response.status_code != 200:
                body = response.text[:500]
                if response.status_code in (401, 403) or "API key" in body:
                    raise RuntimeError("API key is invalid or expired.")
                policy_keywords = ["policy", "violat", "违反", "政策", "invalid_request"]
                if response.status_code == 500 and any(k in body.lower() for k in policy_keywords):
                    continue
                raise RuntimeError(f"API returned {response.status_code}.")

            result = response.json()

            if not result.get("choices"):
                continue

            message = result["choices"][0].get("message", {})
            img = self._extract_image(message)
            if img:
                return img

        raise GenerationError(
            "The AI couldn't generate an image this time. Please try again, "
            "or use a different photo."
        )

    def _extract_image(self, message: dict) -> Image.Image | None:
        images = message.get("images") or []
        if images:
            url = images[0].get("image_url", {}).get("url", "")
            if url:
                return self._decode_data_uri(url)
        return None

    @staticmethod
    def _decode_data_uri(uri: str) -> Image.Image:
        _, encoded = uri.split(",", 1)
        return Image.open(io.BytesIO(base64.b64decode(encoded))).convert("RGB")
