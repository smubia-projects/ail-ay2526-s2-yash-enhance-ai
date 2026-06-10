"""Rate-limit adapter for Cute Fusion Lab.

Wraps the shared engine (rate_limit_engine.py) with this project's slug and its
single image-generation bucket. The engine handles X-Forwarded-For, central
config, event mode, the kill switch (503), caching, and fail-open.
"""

from __future__ import annotations

from app.rate_limit_engine import RateLimiter
from app.config import settings

limiter = RateLimiter(
    # Slug = full project folder name (canonical identifier across code + sheet).
    project="ail-ay2526-s2-yash-enhance-ai",
    buckets={"gen": settings.rate_limit_generate_max},
    redis_url=settings.redis_url,
    redis_token=settings.redis_token,
    default_window=settings.rate_limit_window_seconds,
)


def check_rate_limit(request, bucket: str = "gen") -> None:
    """Raise 503 if the demo is paused, or 429 (with queries_used) if over limit."""
    limiter.enforce(request, bucket)
