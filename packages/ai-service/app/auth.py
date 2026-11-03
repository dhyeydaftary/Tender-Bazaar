"""Service-to-service authentication for the AI service.

Every endpoint except ``/health`` requires ``Authorization: Bearer <token>``
where the token equals ``AI_SERVICE_TOKEN``. The API server is the only
intended caller and holds the same secret; browsers never talk to this service.

Fail closed: when no token is configured the protected endpoints answer 503
rather than opening up, so a deployment that forgot the variable cannot be used
to spend the Anthropic budget. CORS is not part of this decision at all; it is
not an authentication mechanism.
"""

import hmac
from typing import Optional

from fastapi import Header, HTTPException

from app.config import settings

_BEARER = "bearer "


def _presented_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    if authorization[: len(_BEARER)].lower() != _BEARER:
        return None
    token = authorization[len(_BEARER) :].strip()
    return token or None


def check_service_token(authorization: Optional[str], configured: Optional[str] = None) -> None:
    """Raise HTTPException unless ``authorization`` carries the configured token.

    ``configured`` defaults to the live setting; tests pass it explicitly.
    """
    expected = settings.AI_SERVICE_TOKEN if configured is None else configured
    expected = (expected or "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="AI service authentication is not configured (set AI_SERVICE_TOKEN).",
        )

    presented = _presented_token(authorization)
    if presented is None or not hmac.compare_digest(presented.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(
            status_code=401,
            detail="A valid service token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_service_token(authorization: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency guarding every protected route."""
    check_service_token(authorization)
