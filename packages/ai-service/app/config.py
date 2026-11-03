import os
from typing import List

from dotenv import load_dotenv

load_dotenv()


def _origins(value: str) -> List[str]:
    """Comma-separated exact origins. A wildcard is never accepted: with
    credentialed requests it would mean "any site", and this service is not
    meant to be called from a browser at all."""
    return [o.strip() for o in value.split(",") if o.strip() and o.strip() != "*"]


class Settings:
    """Application settings loaded from environment variables."""

    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    AI_MODEL: str = os.getenv("AI_MODEL", "claude-sonnet-4-20250514")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "info")

    # Shared secret the API server presents as `Authorization: Bearer ...`.
    # Empty means every protected endpoint answers 503 (see app/auth.py).
    AI_SERVICE_TOKEN: str = os.getenv("AI_SERVICE_TOKEN", "")

    # Browser origins allowed by CORS. Empty (the default) adds no CORS
    # middleware at all, which is correct for a service only the API calls.
    AI_SERVICE_ALLOWED_ORIGINS: List[str] = _origins(os.getenv("AI_SERVICE_ALLOWED_ORIGINS", ""))

    # The interactive OpenAPI docs are off unless explicitly enabled.
    AI_SERVICE_EXPOSE_DOCS: bool = os.getenv("AI_SERVICE_EXPOSE_DOCS", "false").lower() == "true"


settings = Settings()
