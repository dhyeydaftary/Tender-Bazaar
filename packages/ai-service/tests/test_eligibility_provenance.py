"""Provenance and certification-claim tests for the eligibility engine.

Provenance: the endpoint answers HTTP 200 whenever the rule stage completed, so
a failing model call used to be invisible. These tests pin that `llmAnalysed` is
true only after a validated model result, and that each failure mode reports a
distinct status.

Certification: the ISO criterion used to report MET whenever the company held
any ISO certificate, ignoring what the tender actually required.

No real API key is used anywhere — the "key" below is a dummy string and the
provider client is always replaced with a stub.

Runs under pytest, or standalone:

    python -m tests.test_eligibility_provenance      (from packages/ai-service)
"""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.eligibility import engine as eng  # noqa: E402
from app.eligibility.engine import (  # noqa: E402
    CompanyProfile,
    CriterionStatus,
    EligibilityEngine,
    LlmStatus,
    TenderInfo,
)

DUMMY_KEY = "test-not-a-real-key"


def _company(**over):
    base = dict(
        companyName="Test Pvt Ltd",
        companyType="PVT_LTD",
        annualTurnover=50_000_000.0,
        netWorth=20_000_000.0,
        employeeCount=40,
        yearsInBusiness=6,
        msmeRegistered=True,
        isoRegistered=True,
        isoCertificates=["ISO 9001"],
        startupDpiit=False,
        gemRegistered=True,
        epfRegistered=True,
        gstRegistered=True,
        workCategories=["GOODS"],
        specializations=["supply"],
        statesOperated=["Gujarat"],
        pastProjectValues=[5_000_000.0],
        maxProjectCapacity=100_000_000.0,
    )
    base.update(over)
    return CompanyProfile(**base)


def _tender(**over):
    base = dict(
        id="t-1",
        title="Supply of gloves",
        description="Supply",
        category="GOODS",
        state="Gujarat",
        estimatedValue=1_000_000.0,
        emdAmount=10_000.0,
    )
    base.update(over)
    return TenderInfo(**base)


class _StubMessages:
    def __init__(self, behaviour):
        self._behaviour = behaviour

    async def create(self, **_kwargs):
        return self._behaviour()


class _StubClient:
    def __init__(self, behaviour):
        self.messages = _StubMessages(behaviour)


def _install_stub(monkey_behaviour):
    """Replace anthropic.AsyncAnthropic with a stub and set a dummy key."""
    original_client = eng.anthropic.AsyncAnthropic
    original_key = eng.settings.ANTHROPIC_API_KEY

    eng.anthropic.AsyncAnthropic = lambda **_kw: _StubClient(monkey_behaviour)
    eng.settings.ANTHROPIC_API_KEY = DUMMY_KEY

    def restore():
        eng.anthropic.AsyncAnthropic = original_client
        eng.settings.ANTHROPIC_API_KEY = original_key

    return restore


def _text_response(payload):
    class _Block:
        text = json.dumps(payload)

    class _Msg:
        content = [_Block()]

    return _Msg()


# ---------------------------------------------------------------------------
# Provenance
# ---------------------------------------------------------------------------

def test_llm_success_sets_llm_analysed_true():
    restore = _install_stub(
        lambda: _text_response(
            [
                {
                    "criterion": "Prior Supply Experience",
                    "status": "NOT_MET",
                    "detail": "Requires 15 years; profile shows 6.",
                    "importance": "CRITICAL",
                }
            ]
        )
    )
    try:
        r = asyncio.run(
            EligibilityEngine().check(
                _company(), _tender(eligibilityText="Bidder must have 15 years experience.")
            )
        )
    finally:
        restore()

    assert r.llmStatus == LlmStatus.SUCCESS
    assert r.llmAnalysed is True
    assert r.llmError is None
    assert r.ruleChecksCompleted is True
    assert any(c.criterion == "Prior Supply Experience" for c in r.criteria)


def test_authentication_failure_reports_failed_not_success():
    """An invalid key must never read as a completed AI analysis."""

    def boom():
        raise eng.anthropic.AuthenticationError(
            message="invalid x-api-key",
            response=_FakeResponse(401),
            body=None,
        )

    restore = _install_stub(boom)
    try:
        r = asyncio.run(
            EligibilityEngine().check(
                _company(), _tender(eligibilityText="Bidder must hold ISO 14001.")
            )
        )
    finally:
        restore()

    assert r.llmStatus == LlmStatus.FAILED
    assert r.llmAnalysed is False
    assert r.llmError and "authentication" in r.llmError.lower()
    # The rule stage still produced a usable result.
    assert r.ruleChecksCompleted is True
    assert len(r.criteria) > 0
    # The failure reason must not leak key material.
    assert DUMMY_KEY not in (r.llmError or "")


def test_timeout_reports_timed_out():
    def boom():
        raise eng.anthropic.APITimeoutError(request=None)

    restore = _install_stub(boom)
    try:
        r = asyncio.run(
            EligibilityEngine().check(
                _company(), _tender(eligibilityText="Bidder must hold ISO 14001.")
            )
        )
    finally:
        restore()

    assert r.llmStatus == LlmStatus.TIMED_OUT
    assert r.llmAnalysed is False
    assert r.llmError


def test_unparseable_model_output_reports_failed():
    class _Block:
        text = "I think the bidder is probably eligible."

    class _Msg:
        content = [_Block()]

    restore = _install_stub(lambda: _Msg())
    try:
        r = asyncio.run(
            EligibilityEngine().check(
                _company(), _tender(eligibilityText="Bidder must hold ISO 14001.")
            )
        )
    finally:
        restore()

    assert r.llmStatus == LlmStatus.FAILED
    assert r.llmAnalysed is False


def test_no_api_key_reports_unavailable():
    original_key = eng.settings.ANTHROPIC_API_KEY
    eng.settings.ANTHROPIC_API_KEY = ""
    try:
        r = asyncio.run(
            EligibilityEngine().check(
                _company(), _tender(eligibilityText="Bidder must hold ISO 14001.")
            )
        )
    finally:
        eng.settings.ANTHROPIC_API_KEY = original_key

    assert r.llmStatus == LlmStatus.UNAVAILABLE
    assert r.llmAnalysed is False
    assert r.ruleChecksCompleted is True


def test_no_eligibility_text_reports_skipped():
    r = asyncio.run(EligibilityEngine().check(_company(), _tender()))

    assert r.llmStatus == LlmStatus.SKIPPED_NO_TEXT
    assert r.llmAnalysed is False
    assert r.llmError is None
    assert r.ruleChecksCompleted is True


# ---------------------------------------------------------------------------
# Certification claims
# ---------------------------------------------------------------------------

def _cert_criterion(result):
    return next(c for c in result.criteria if c.criterion == "Required Certifications")


def test_iso_9001_does_not_satisfy_iso_14001_requirement():
    """The original bug: a generic ISO cert marked a named requirement MET."""
    r = asyncio.run(
        EligibilityEngine().check(
            _company(isoCertificates=["ISO 9001"]),
            _tender(requiredCertifications=["ISO 14001"]),
        )
    )
    c = _cert_criterion(r)

    assert c.status == CriterionStatus.NOT_MET
    assert "ISO 14001" in c.detail


def test_holding_the_required_certification_is_met():
    r = asyncio.run(
        EligibilityEngine().check(
            _company(isoCertificates=["ISO 9001", "ISO 14001"]),
            _tender(requiredCertifications=["ISO 14001"]),
        )
    )
    assert _cert_criterion(r).status == CriterionStatus.MET


def test_case_and_spacing_differences_still_match():
    r = asyncio.run(
        EligibilityEngine().check(
            _company(isoCertificates=["iso  14001"]),
            _tender(requiredCertifications=["ISO 14001"]),
        )
    )
    assert _cert_criterion(r).status == CriterionStatus.MET


def test_missing_company_certification_data_is_unclear_not_met():
    """No evidence either way must not become a verdict."""
    r = asyncio.run(
        EligibilityEngine().check(
            _company(isoRegistered=False, isoCertificates=[]),
            _tender(requiredCertifications=["ISO 14001"]),
        )
    )
    c = _cert_criterion(r)

    assert c.status == CriterionStatus.UNCLEAR
    assert "could not be verified" in c.detail


def test_tender_states_no_requirement_is_unclear_not_met():
    """Nothing was required, so nothing can be reported as satisfied."""
    r = asyncio.run(
        EligibilityEngine().check(
            _company(isoCertificates=["ISO 9001"]),
            _tender(requiredCertifications=[]),
        )
    )
    c = _cert_criterion(r)

    assert c.status == CriterionStatus.UNCLEAR
    assert "does not state a certification requirement" in c.detail
    assert c.status != CriterionStatus.MET


def test_partial_match_is_not_met():
    r = asyncio.run(
        EligibilityEngine().check(
            _company(isoCertificates=["ISO 9001"]),
            _tender(requiredCertifications=["ISO 9001", "ISO 14001"]),
        )
    )
    c = _cert_criterion(r)

    assert c.status == CriterionStatus.NOT_MET
    assert "ISO 14001" in c.detail


class _FakeResponse:
    """Minimal stand-in for an httpx.Response, enough for anthropic errors."""

    def __init__(self, status_code):
        self.status_code = status_code
        self.headers = {}
        self.request = None


def _main() -> int:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failures = 0
    for fn in tests:
        try:
            fn()
        except AssertionError as exc:
            failures += 1
            print(f"FAIL  {fn.__name__}: {exc}")
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"ERROR {fn.__name__}: {type(exc).__name__}: {exc}")
        else:
            print(f"PASS  {fn.__name__}")
    print(f"\n{len(tests) - failures} passed, {failures} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(_main())
