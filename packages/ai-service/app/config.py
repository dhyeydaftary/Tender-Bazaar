import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""

    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    AI_MODEL: str = os.getenv("AI_MODEL", "claude-sonnet-4-20250514")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "info")


settings = Settings()
