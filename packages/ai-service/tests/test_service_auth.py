"""Service-to-service authentication of the AI service.

Every endpoint except /health requires `Authorization: Bearer <AI_SERVICE_TOKEN>`
and answers 503 while no token is configured, so an unauthenticated deployment
can never be used to spend the Anthropic budget. CORS sends no headers unless
exact origins are configured, and never for "*".

Runs under pytest (fastapi's TestClient needs httpx, already a dependency):

    python -m pytest tests/test_service_auth.py        (from packages/ai-service)
"""

import importlib
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.auth import check_service_token  # noqa: E402

TOKEN = "unit-test-service-token-0123456789"

PROTECTED = [
    ("/eligibility/check", {"company": {"companyName": "Acme"}, "tender": {"id": "t", "title": "x"}}),
    ("/eligibility/bulk", {"company": {"companyName": "Acme"}, "tenders": []}),
    ("/ai/summary", {"title": "t", "description": "d"}),
    ("/ai/categorize", {"title": "t"}),
    ("/bid-assistant/analyze", {"document_text": "d", "company_profile": {}}),
    ("/bid-assistant/checklist", {"requirements": {}, "company_documents": []}),
    ("/bid-assistant/strategy", {"tender_info": {}, "company_profile": {}}),
]


def load_app(monkeypatch, token, origins="", docs="false"):
    """Import a fresh app with the given settings (settings load at import)."""
    monkeypatch.setenv("AI_SERVICE_TOKEN", token)
    monkeypatch.setenv("AI_SERVICE_ALLOWED_ORIGINS", origins)
    monkeypatch.setenv("AI_SERVICE_EXPOSE_DOCS", docs)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    for name in ("app.config", "app.auth", "app.main"):
        sys.modules.pop(name, None)
    main = importlib.import_module("app.main")
    return main.app


def test_check_service_token_rules():
    with pytest.raises(HTTPException) as unconfigured:
        check_service_token("Bearer anything", configured="")
    assert unconfigured.value.status_code == 503

    with pytest.raises(HTTPException) as missing:
        check_service_token(None, configured=TOKEN)
    assert missing.value.status_code == 401

    for bad in ("Bearer wrong", "Basic " + TOKEN, TOKEN, "Bearer ", "Bearer " + TOKEN + "x"):
        with pytest.raises(HTTPException) as wrong:
            check_service_token(bad, configured=TOKEN)
        assert wrong.value.status_code == 401, bad

    assert check_service_token("Bearer " + TOKEN, configured=TOKEN) is None
    assert check_service_token("bearer " + TOKEN, configured=TOKEN) is None, "scheme is case-insensitive"


def test_protected_endpoints_reject_missing_and_invalid_tokens(monkeypatch):
    client = TestClient(load_app(monkeypatch, TOKEN))

    assert client.get("/health").status_code == 200, "health stays public for the platform's checks"

    for path, body in PROTECTED:
        missing = client.post(path, json=body)
        assert missing.status_code == 401, path
        assert missing.headers.get("www-authenticate") == "Bearer"

        wrong = client.post(path, json=body, headers={"Authorization": "Bearer not-the-token"})
        assert wrong.status_code == 401, path


def test_valid_token_reaches_the_handler(monkeypatch):
    client = TestClient(load_app(monkeypatch, TOKEN))
    # Categorisation needs no Anthropic key: the classifier has a rule-based path.
    response = client.post("/ai/categorize", json={"title": "Supply of laboratory gloves"}, headers={"Authorization": f"Bearer {TOKEN}"})
    assert response.status_code == 200, response.text


def test_unconfigured_token_fails_closed(monkeypatch):
    client = TestClient(load_app(monkeypatch, ""))
    assert client.get("/health").status_code == 200
    for path, body in PROTECTED:
        response = client.post(path, json=body, headers={"Authorization": "Bearer anything"})
        assert response.status_code == 503, path
        assert "AI_SERVICE_TOKEN" in response.json()["detail"]


def test_docs_are_off_by_default(monkeypatch):
    client = TestClient(load_app(monkeypatch, TOKEN))
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404

    exposed = TestClient(load_app(monkeypatch, TOKEN, docs="true"))
    assert exposed.get("/openapi.json").status_code == 200


def test_cors_is_off_by_default_and_never_wildcard(monkeypatch):
    client = TestClient(load_app(monkeypatch, TOKEN))
    response = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers

    wildcard = TestClient(load_app(monkeypatch, TOKEN, origins="*"))
    response = wildcard.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in response.headers, "a wildcard origin is dropped"

    exact = TestClient(load_app(monkeypatch, TOKEN, origins="https://admin.tenderbazaar.example"))
    allowed = exact.get("/health", headers={"Origin": "https://admin.tenderbazaar.example"})
    assert allowed.headers.get("access-control-allow-origin") == "https://admin.tenderbazaar.example"
    denied = exact.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in denied.headers
