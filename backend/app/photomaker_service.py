from __future__ import annotations

import base64
import io
import re
from dataclasses import dataclass

import openai
import requests
from PIL import Image

from app.config import settings


@dataclass
class GenerationSettings:
    prompt: str
    negative_prompt: str  # kept for UI display only
    seed: int | None = None


class PhotoMakerService:
    def __init__(self) -> None:
        self._client = openai.OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
        )

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
            raise RuntimeError("API key not configured. Set OPENROUTER_API_KEY in .env")

        content_parts: list[dict] = []
        for img in id_images:
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": self._image_to_data_url(img)},
            })
        content_parts.append({"type": "text", "text": options.prompt})

        # Retry up to 3 times for probabilistic content policy rejections
        for attempt in range(3):
            try:
                response = self._client.chat.completions.create(
                    model=settings.openrouter_model,
                    messages=[{"role": "user", "content": content_parts}],
                    max_tokens=1024,
                    extra_body={"modalities": ["text", "image"]},
                )
                return self._extract_image(response.choices[0].message.content)
            except openai.AuthenticationError:
                raise RuntimeError(
                    "Invalid API key. Set OPENROUTER_API_KEY in .env"
                )
            except openai.BadRequestError:
                if attempt < 2:
                    continue
                raise RuntimeError(
                    "Content policy blocked after 3 attempts. "
                    "Try a different mode or different photos."
                )

    def _extract_image(self, content) -> Image.Image:
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict):
                    if part.get("type") == "image_url":
                        url = part.get("image_url", {}).get("url", "")
                        return self._download_image(url)
                    if part.get("type") == "image":
                        b64 = part.get("data") or part.get("b64_json", "")
                        if b64:
                            return Image.open(
                                io.BytesIO(base64.b64decode(b64))
                            ).convert("RGB")
            raise RuntimeError("No image found in response parts.")

        if isinstance(content, str):
            urls = re.findall(r'!\[.*?\]\((https?://[^\s)]+)\)', content)
            if not urls:
                urls = re.findall(r'(https?://\S+\.(?:png|jpg|jpeg|webp))', content)
            if urls:
                return self._download_image(urls[0])

        raise RuntimeError(
            f"Could not extract image from API response. "
            f"Content type: {type(content).__name__}"
        )

    def _download_image(self, url: str) -> Image.Image:
        if url.startswith("data:"):
            _, encoded = url.split(",", 1)
            return Image.open(io.BytesIO(base64.b64decode(encoded))).convert("RGB")
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content)).convert("RGB")
