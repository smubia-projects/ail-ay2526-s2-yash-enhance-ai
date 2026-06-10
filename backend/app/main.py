from __future__ import annotations

import logging
import secrets
from pathlib import Path
from uuid import uuid4

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.config import settings
from app.image_utils import load_image_from_bytes, preprocess_reference_image
from app.photomaker_service import GenerationError, GenerationSettings, PhotoMakerService
from app.presets import PRESETS
from app.prompt_builder import build_prompts
from app.telegram_bot import TelegramBotPoller

logger = logging.getLogger(__name__)


class PresetResponse(BaseModel):
    key: str
    title: str
    description: str


class GenerateResponse(BaseModel):
    image_url: str
    filename: str
    seed: int
    mode: str
    prompt: str
    negative_prompt: str


settings.output_dir.mkdir(parents=True, exist_ok=True)
service = PhotoMakerService()

# Telegram bot poller
tg_bot: TelegramBotPoller | None = None
if settings.telegram_bot_token:
    tg_bot = TelegramBotPoller(settings.telegram_bot_token, settings.output_dir)

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    if tg_bot:
        tg_bot.start()


@app.on_event("shutdown")
def shutdown_event() -> None:
    if tg_bot:
        tg_bot.stop()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/telegram-bot")
def get_telegram_bot():
    if tg_bot and tg_bot.bot_username:
        return {"username": tg_bot.bot_username}
    return {"username": None}


@app.get("/api/presets", response_model=list[PresetResponse])
def list_presets() -> list[PresetResponse]:
    return [
        PresetResponse(key=item.key, title=item.title, description=item.description)
        for item in PRESETS.values()
    ]


async def _read_and_prepare(file: UploadFile) -> "Image.Image":
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"{file.filename} is not an image file.")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail=f"{file.filename} is empty.")

    try:
        image = load_image_from_bytes(raw)
        return preprocess_reference_image(image)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/generate", response_model=GenerateResponse)
async def generate(
    person_a: UploadFile = File(...),
    person_b: UploadFile | None = File(None),
    mode: str = Form("kid"),
    custom_prompt: str = Form(""),
    gender: str = Form(""),
    hair: str = Form(""),
    skin: str = Form(""),
    eyes: str = Form(""),
    nose: str = Form(""),
    ears: str = Form(""),
    cheekbones: str = Form(""),
    jawline: str = Form(""),
    seed: int | None = Form(None),
) -> GenerateResponse:
    preset = PRESETS.get(mode)
    if preset is None:
        raise HTTPException(status_code=400, detail=f"Unknown mode '{mode}'.")

    image_a = await _read_and_prepare(person_a)
    id_images = [image_a]

    if person_b is not None:
        image_b = await _read_and_prepare(person_b)
        id_images.append(image_b)

    single_mode = len(id_images) == 1
    final_seed = seed if seed is not None else secrets.randbelow(2_147_483_647)
    facial_features = {
        "skin": skin or None,
        "eyes": eyes or None,
        "nose": nose or None,
        "ears": ears or None,
        "cheekbones": cheekbones or None,
        "jawline": jawline or None,
    }
    prompt, negative_prompt = build_prompts(
        preset, custom_prompt,
        gender=gender or None,
        hair=hair or None,
        single=single_mode,
        facial_features=facial_features,
    )

    options = GenerationSettings(
        prompt=prompt,
        negative_prompt=negative_prompt,
        seed=final_seed if seed is not None else None,
    )

    try:
        result_image = await run_in_threadpool(service.generate, id_images, options)
    except GenerationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected generation error")
        raise HTTPException(
            status_code=500,
            detail="Something went wrong on our end. Please try again.",
        ) from exc

    filename = f"{uuid4().hex}.png"
    output_path = Path(settings.output_dir) / filename
    result_image.save(output_path, format="PNG")

    return GenerateResponse(
        image_url=f"/api/images/{filename}",
        filename=filename,
        seed=final_seed,
        mode=mode,
        prompt=prompt,
        negative_prompt=negative_prompt,
    )


class TelegramRequest(BaseModel):
    filename: str
    username: str


class TelegramResponse(BaseModel):
    ok: bool
    detail: str


@app.post("/api/send-telegram", response_model=TelegramResponse)
async def send_telegram(body: TelegramRequest) -> TelegramResponse:
    if not settings.telegram_bot_token:
        raise HTTPException(
            status_code=500,
            detail="Telegram bot token not configured. Set TELEGRAM_BOT_TOKEN in .env",
        )

    # Resolve @username — strip leading @
    username = body.username.strip().lstrip("@")
    if not username:
        raise HTTPException(status_code=400, detail="Telegram username is required.")

    # Verify image file exists
    image_path = settings.output_dir / body.filename
    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found.")

    api_url = f"https://api.telegram.org/bot{settings.telegram_bot_token}"

    # Try sending with @username as chat_id (works if user has messaged the bot)
    chat_id = f"@{username}" if not username.lstrip("-").isdigit() else username

    try:
        with open(image_path, "rb") as photo:
            resp = requests.post(
                f"{api_url}/sendPhoto",
                data={"chat_id": chat_id, "caption": "Your Cute Fusion Lab result!"},
                files={"photo": (body.filename, photo, "image/png")},
                timeout=30,
            )

        result = resp.json()
        if result.get("ok"):
            return TelegramResponse(ok=True, detail=f"Sent to @{username}")

        err = result.get("description", "Unknown error")
        # Common error: user hasn't messaged the bot yet
        if "chat not found" in err.lower():
            raise HTTPException(
                status_code=400,
                detail=f"User @{username} hasn't started a chat with the bot yet. "
                       "They need to message the bot first.",
            )
        raise HTTPException(status_code=400, detail=f"Telegram error: {err}")

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to contact Telegram: {exc}"
        ) from exc


# Mount static files AFTER all routes so it doesn't shadow /api/* endpoints
app.mount("/api/images", StaticFiles(directory=str(settings.output_dir)), name="images")

