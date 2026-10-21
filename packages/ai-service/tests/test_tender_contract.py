"""Contract tests for TenderInfo, the tender half of POST /eligibility/check.

These guard the mismatch that made eligibility analysis quietly wrong: the Node
API sent fields this model did not declare, so Pydantic dropped them and a
tender with published thresholds produced the same output as one with none.

Runs under pytest, or standalone with no extra dependency:

    python -m tests.test_tender_contract        (from packages/ai-service)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.eligibility.engine import TenderInfo  # noqa: E402

# The exact tender payload the Node eligibility service sends.
API_PAYLOAD = {
    "id": "tender-123",
    "title": "Supply of laboratory gloves",
    "description": "Supply and delivery of nitrile gloves.",
    "organization": "Gujarat Water Supply Board",
    "department": "Procurement",
    "category": "GOODS",
    "tenderType": "OPEN",
    "state": "Gujarat",
    "estimatedValue": 1_500_000.0,
    "emdAmount": 30_000.0,
    "minTurnover": 200_000_000.0,
    "minNetWorth": 5_000_000.0,
    "minExperience": 15,
    "requiredCertifications": ["ISO 14001", "ISO 9001"],
    "reservedForMSME": True,
    "reservedForStartups": False,
    "emdExemptMSME": True,
    "eligibilityText": "Bidder must hold ISO 14001 and 15 years experience.",
}


def test_all_api_fields_are_preserved():
    """Every field the API sends must survive parsing, not be dropped."""
    t = TenderInfo(**API_PAYLOAD)

    assert t.id == "tender-123"
    assert t.organization == "Gujarat Water Supply Board"
    assert t.department == "Procurement"
    # The four that used to be discarded entirely.
    assert t.minTurnover == 200_000_000.0
    assert t.minNetWorth == 5_000_000.0
    assert t.minExperience == 15
    assert t.requiredCertifications == ["ISO 14001", "ISO 9001"]
    assert t.eligibilityText is not None and "ISO 14001" in t.eligibilityText


def test_missing_requirements_stay_explicitly_unknown():
    """Absent thresholds must be None, never coerced to 0.

    A 0 would read as "requirement of zero", i.e. trivially satisfied, which is
    the opposite of "the tender did not state one".
    """
    t = TenderInfo(id="t", title="T")

    assert t.minTurnover is None
    assert t.minNetWorth is None
    assert t.minExperience is None
    assert t.requiredCertifications == []
    assert t.eligibilityText is None
    assert t.description is None
    assert t.organization is None
    for value in (t.minTurnover, t.minNetWorth, t.minExperience):
        assert value != 0


def test_null_description_is_accepted():
    """description is nullable in the database; a null must not 422."""
    t = TenderInfo(**{**API_PAYLOAD, "description": None})
    assert t.description is None
    assert t.title == API_PAYLOAD["title"]


def test_legacy_ai_eligibility_text_alias():
    """The API's historical field name must still populate eligibilityText."""
    payload = {k: v for k, v in API_PAYLOAD.items() if k != "eligibilityText"}
    payload["aiEligibilityText"] = "Legacy field name."

    t = TenderInfo(**payload)
    assert t.eligibilityText == "Legacy field name."


def test_canonical_name_wins_and_both_names_work():
    """Canonical `eligibilityText` is honoured when present."""
    t = TenderInfo(**{**API_PAYLOAD, "aiEligibilityText": "ignored legacy"})
    assert t.eligibilityText == API_PAYLOAD["eligibilityText"]


def test_requirement_fields_change_the_parsed_model():
    """Guards the original bug: with vs without thresholds must differ.

    Before the fix both parsed identically, which is why a 20 Cr turnover floor
    had no effect on the analysis.
    """
    with_reqs = TenderInfo(**API_PAYLOAD)
    without = TenderInfo(
        **{
            k: v
            for k, v in API_PAYLOAD.items()
            if k not in {"minTurnover", "minNetWorth", "minExperience", "requiredCertifications"}
        }
    )

    assert with_reqs.model_dump() != without.model_dump()
    assert without.minTurnover is None and with_reqs.minTurnover == 200_000_000.0


def test_unknown_fields_are_ignored_but_logged(caplog=None):
    """An undeclared field must not break parsing, and must be logged."""
    import logging

    records = []

    class _Capture(logging.Handler):
        def emit(self, record):
            records.append(record.getMessage())

    logger = logging.getLogger("app.eligibility.engine")
    handler = _Capture()
    logger.addHandler(handler)
    previous_level = logger.level
    logger.setLevel(logging.WARNING)
    try:
        t = TenderInfo(**{**API_PAYLOAD, "someFutureField": "x"})
    finally:
        logger.removeHandler(handler)
        logger.setLevel(previous_level)

    assert t.id == "tender-123"  # parsing still succeeds
    assert any("someFutureField" in m for m in records), records


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
