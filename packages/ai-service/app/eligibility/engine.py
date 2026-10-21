import json
import logging
from enum import Enum
from typing import List, Optional

import anthropic
from pydantic import AliasChoices, BaseModel, Field, model_validator

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class CriterionStatus(str, Enum):
    MET = "MET"
    NOT_MET = "NOT_MET"
    PARTIALLY_MET = "PARTIALLY_MET"
    UNCLEAR = "UNCLEAR"


class CriterionImportance(str, Enum):
    CRITICAL = "CRITICAL"
    IMPORTANT = "IMPORTANT"
    OPTIONAL = "OPTIONAL"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class CriterionResult(BaseModel):
    criterion: str
    status: CriterionStatus
    detail: str
    importance: CriterionImportance


class CompanyProfile(BaseModel):
    companyName: str
    gstin: Optional[str] = None
    pan: Optional[str] = None
    companyType: Optional[str] = None
    annualTurnover: Optional[float] = None
    netWorth: Optional[float] = None
    employeeCount: Optional[int] = None
    yearsInBusiness: Optional[int] = None
    msmeRegistered: bool = False
    msmeNumber: Optional[str] = None
    msmeCategory: Optional[str] = None
    isoRegistered: bool = False
    isoCertificates: List[str] = []
    startupDpiit: bool = False
    gemRegistered: bool = False
    epfRegistered: bool = False
    gstRegistered: bool = False
    workCategories: List[str] = []
    specializations: List[str] = []
    statesOperated: List[str] = []
    pastProjectValues: List[float] = []
    maxProjectCapacity: Optional[float] = None


class TenderInfo(BaseModel):
    """Tender side of POST /eligibility/check.

    This model is the contract with the Node API's eligibility service. Because
    Pydantic ignores undeclared keys, every field the API sent that was missing
    here was dropped without a trace:

      * `organization`, `department`, `minTurnover`, `minNetWorth`,
        `minExperience` and `requiredCertifications` were all discarded, so a
        tender stating a 20 Cr turnover floor produced byte-identical output to
        one stating no requirement at all.
      * `description` was declared as a required `str` while the database column
        is nullable, so the 11% of tenders with no description were rejected
        with HTTP 422. The API caught that and silently degraded to its
        rule-based fallback, which looked to the user like a completed analysis.
      * The API's `aiEligibilityText` never matched this model's
        `eligibilityText`, so the LLM stage — gated on that field — never ran.

    The structured requirement fields below are now accepted and available to
    the engine, but note what is NOT claimed: `check_rules` does not yet score
    them, and `check_llm` reads only `eligibilityText`. They are carried so the
    data stops being lost, not because the model analyses them today.
    """

    id: str
    title: str
    # Nullable in the database; optional here so a tender without a description
    # is analysed rather than 422-ing into a silent fallback.
    description: Optional[str] = None
    organization: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    tenderType: Optional[str] = None
    state: Optional[str] = None
    estimatedValue: Optional[float] = None
    emdAmount: Optional[float] = None

    # Published eligibility thresholds. `None` means the tender did not state
    # one — which is NOT the same as a threshold of zero, and must never be
    # reported as "requirement met".
    minTurnover: Optional[float] = None
    minNetWorth: Optional[float] = None
    minExperience: Optional[int] = None
    requiredCertifications: List[str] = Field(default_factory=list)

    reservedForMSME: bool = False
    reservedForStartups: bool = False
    emdExemptMSME: bool = False

    # Accepts the API's historical `aiEligibilityText` as well as the canonical
    # `eligibilityText`, so neither side can silently drop it again.
    eligibilityText: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("eligibilityText", "aiEligibilityText"),
    )

    model_config = {"populate_by_name": True}

    @model_validator(mode="before")
    @classmethod
    def _log_unknown_fields(cls, data):
        """Log keys this model does not declare instead of dropping them mutely.

        Deliberately logs rather than rejecting: a future field added on the
        Node side should be visible in the logs, not turn every eligibility
        check into a 422 that degrades to fallback for all users.
        """
        if isinstance(data, dict):
            known = set(cls.model_fields.keys()) | {"aiEligibilityText"}
            unknown = sorted(k for k in data if k not in known)
            if unknown:
                logger.warning(
                    "TenderInfo received undeclared field(s) %s - they are ignored; "
                    "update the model if they are meant to be used",
                    unknown,
                )
        return data


class LlmStatus(str, Enum):
    """Outcome of the LLM stage, reported independently of the HTTP status.

    The endpoint answers 200 whenever the rule stage completed, because a
    rule-based result is still useful. That made an LLM failure invisible: a
    401 from the provider was caught, logged, and the response went out looking
    like a complete analysis. Callers must be able to tell these apart.
    """

    SUCCESS = "SUCCESS"              # a validated LLM result contributed criteria
    FAILED = "FAILED"                # provider rejected the call (e.g. 401) or errored
    TIMED_OUT = "TIMED_OUT"          # provider did not answer in time
    UNAVAILABLE = "UNAVAILABLE"      # no API key configured, so never attempted
    SKIPPED_NO_TEXT = "SKIPPED_NO_TEXT"  # tender has no eligibility text to analyse


class EligibilityResult(BaseModel):
    score: float
    is_eligible: bool
    criteria: List[CriterionResult]
    suggestions: List[str]
    summary: str

    # ---- Provenance -------------------------------------------------------
    # Which stages actually produced the analysis above. `llmAnalysed` is true
    # only when a validated LLM response contributed at least one criterion —
    # never inferred from the HTTP status.
    ruleChecksCompleted: bool = True
    llmAnalysed: bool = False
    llmStatus: LlmStatus = LlmStatus.UNAVAILABLE
    llmError: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalise_cert(value: str) -> str:
    """Normalise a certification name for exact comparison.

    Case and internal whitespace only — deliberately not fuzzy. "ISO 9001" and
    "iso  9001" are the same certificate; "ISO 9001" and "ISO 14001" are not.
    """
    return " ".join(value.split()).upper()

def _fmt_inr(value: float) -> str:
    """Format a float as an INR-friendly string (e.g. 5.2Cr, 45L)."""
    if value >= 1_00_00_000:
        return f"\u20b9{value / 1_00_00_000:.1f}Cr"
    if value >= 1_00_000:
        return f"\u20b9{value / 1_00_000:.1f}L"
    return f"\u20b9{value:,.0f}"


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class EligibilityEngine:

    # ------------------------------------------------------------------
    # Rule-based checks
    # ------------------------------------------------------------------

    def check_rules(
        self, company: CompanyProfile, tender: TenderInfo
    ) -> List[CriterionResult]:
        results: List[CriterionResult] = []

        # 1. Category match
        if tender.category and company.workCategories:
            cat_lower = tender.category.lower()
            matched = any(
                cat_lower in wc.lower() or wc.lower() in cat_lower
                for wc in company.workCategories
            )
            results.append(
                CriterionResult(
                    criterion="Category Match",
                    status=CriterionStatus.MET if matched else CriterionStatus.NOT_MET,
                    detail=(
                        f"Tender category '{tender.category}' matches company work categories"
                        if matched
                        else f"Tender category '{tender.category}' not found in company work categories: {', '.join(company.workCategories)}"
                    ),
                    importance=CriterionImportance.IMPORTANT,
                )
            )

        # 2. Geographic coverage
        if tender.state and company.statesOperated:
            state_lower = tender.state.lower()
            covered = any(s.lower() == state_lower for s in company.statesOperated)
            results.append(
                CriterionResult(
                    criterion="Geographic Coverage",
                    status=CriterionStatus.MET if covered else CriterionStatus.NOT_MET,
                    detail=(
                        f"Company operates in {tender.state}"
                        if covered
                        else f"Company does not operate in {tender.state}. Current states: {', '.join(company.statesOperated)}"
                    ),
                    importance=CriterionImportance.IMPORTANT,
                )
            )

        # 3. MSME reservation
        if tender.reservedForMSME:
            results.append(
                CriterionResult(
                    criterion="MSME Reservation",
                    status=(
                        CriterionStatus.MET
                        if company.msmeRegistered
                        else CriterionStatus.NOT_MET
                    ),
                    detail=(
                        f"Company is MSME registered ({company.msmeCategory or 'category not specified'})"
                        if company.msmeRegistered
                        else "Tender is reserved for MSME but company is not MSME registered"
                    ),
                    importance=CriterionImportance.CRITICAL,
                )
            )

        # 4. Startup reservation
        if tender.reservedForStartups:
            results.append(
                CriterionResult(
                    criterion="Startup (DPIIT) Reservation",
                    status=(
                        CriterionStatus.MET
                        if company.startupDpiit
                        else CriterionStatus.NOT_MET
                    ),
                    detail=(
                        "Company has DPIIT startup recognition"
                        if company.startupDpiit
                        else "Tender is reserved for DPIIT-recognised startups but company lacks recognition"
                    ),
                    importance=CriterionImportance.CRITICAL,
                )
            )

        # 5. EMD exemption (only when applicable)
        if tender.emdExemptMSME and tender.emdAmount and tender.emdAmount > 0:
            if company.msmeRegistered:
                results.append(
                    CriterionResult(
                        criterion="EMD Exemption for MSME",
                        status=CriterionStatus.MET,
                        detail=f"MSME exemption saves EMD of {_fmt_inr(tender.emdAmount)}",
                        importance=CriterionImportance.OPTIONAL,
                    )
                )
            else:
                results.append(
                    CriterionResult(
                        criterion="EMD Exemption for MSME",
                        status=CriterionStatus.NOT_MET,
                        detail=(
                            f"EMD of {_fmt_inr(tender.emdAmount)} required; "
                            "MSME registration would qualify for exemption"
                        ),
                        importance=CriterionImportance.OPTIONAL,
                    )
                )

        # 6. Project capacity
        if (
            company.maxProjectCapacity is not None
            and tender.estimatedValue is not None
            and tender.estimatedValue > 0
        ):
            enough = company.maxProjectCapacity >= tender.estimatedValue
            results.append(
                CriterionResult(
                    criterion="Project Capacity",
                    status=CriterionStatus.MET if enough else CriterionStatus.NOT_MET,
                    detail=(
                        f"Max project capacity {_fmt_inr(company.maxProjectCapacity)} "
                        f"{'meets' if enough else 'is below'} "
                        f"tender value {_fmt_inr(tender.estimatedValue)}"
                    ),
                    importance=CriterionImportance.IMPORTANT,
                )
            )

        # 7. Past experience (max past value >= 40% of tender value)
        if (
            company.pastProjectValues
            and tender.estimatedValue is not None
            and tender.estimatedValue > 0
        ):
            max_past = max(company.pastProjectValues)
            threshold = tender.estimatedValue * 0.4
            enough = max_past >= threshold
            results.append(
                CriterionResult(
                    criterion="Past Project Experience",
                    status=CriterionStatus.MET if enough else CriterionStatus.NOT_MET,
                    detail=(
                        f"Largest past project {_fmt_inr(max_past)} "
                        f"{'meets' if enough else 'is below'} "
                        f"40% threshold ({_fmt_inr(threshold)}) of tender value {_fmt_inr(tender.estimatedValue)}"
                    ),
                    importance=CriterionImportance.IMPORTANT,
                )
            )

        # 8. Years in business (require 3 years for tenders > 10Cr)
        if (
            tender.estimatedValue is not None
            and tender.estimatedValue > 10_00_00_000
        ):
            if company.yearsInBusiness is not None:
                enough = company.yearsInBusiness >= 3
                results.append(
                    CriterionResult(
                        criterion="Years in Business",
                        status=CriterionStatus.MET if enough else CriterionStatus.NOT_MET,
                        detail=(
                            f"Company has {company.yearsInBusiness} years of experience "
                            f"({'meets' if enough else 'does not meet'} "
                            f"minimum 3-year requirement for tenders above \u20b910Cr)"
                        ),
                        importance=CriterionImportance.IMPORTANT,
                    )
                )
            else:
                results.append(
                    CriterionResult(
                        criterion="Years in Business",
                        status=CriterionStatus.UNCLEAR,
                        detail="Years in business not specified; tenders above \u20b910Cr typically require at least 3 years",
                        importance=CriterionImportance.IMPORTANT,
                    )
                )

        # 9. Certifications.
        #
        # This used to mark the criterion MET whenever the company held *any*
        # ISO certificate, without ever looking at what the tender asked for.
        # A tender requiring ISO 14001 was reported as satisfied by a company
        # holding only ISO 9001 — an unsupported claim about a named
        # requirement. The requirement itself was also invisible until
        # `requiredCertifications` was added to TenderInfo.
        #
        # Matching is exact on a normalised string (case and whitespace), which
        # is all that can be done reliably here. No attempt is made to read
        # requirements out of free-text eligibility prose: that is not
        # implemented, and anything it could not match is reported as needing
        # verification rather than guessed.
        held = {_normalise_cert(c) for c in (company.isoCertificates or []) if c and c.strip()}
        required = [c for c in (tender.requiredCertifications or []) if c and c.strip()]

        if required:
            missing = [c for c in required if _normalise_cert(c) not in held]

            if not held:
                # The tender names requirements but the profile carries no
                # certification data, so there is no evidence either way.
                results.append(
                    CriterionResult(
                        criterion="Required Certifications",
                        status=CriterionStatus.UNCLEAR,
                        detail=(
                            f"This tender requires {', '.join(required)}. Your profile lists no "
                            "certifications, so this could not be verified — add them to your "
                            "company profile or confirm against the tender document."
                        ),
                        importance=CriterionImportance.IMPORTANT,
                    )
                )
            elif missing:
                results.append(
                    CriterionResult(
                        criterion="Required Certifications",
                        status=CriterionStatus.NOT_MET,
                        detail=(
                            f"This tender requires {', '.join(required)}. Not found in your profile: "
                            f"{', '.join(missing)}. You hold: {', '.join(sorted(company.isoCertificates))}."
                        ),
                        importance=CriterionImportance.IMPORTANT,
                    )
                )
            else:
                results.append(
                    CriterionResult(
                        criterion="Required Certifications",
                        status=CriterionStatus.MET,
                        detail=(
                            f"Holds every certification this tender names: {', '.join(required)}."
                        ),
                        importance=CriterionImportance.IMPORTANT,
                    )
                )
        else:
            # The tender states no certification requirement. Reporting MET here
            # would assert that a requirement was satisfied when none was
            # published, so this stays an explicit "nothing to verify" note and
            # is kept distinct from any generic recommendation.
            detail = (
                "This tender does not state a certification requirement"
                + (
                    f"; your profile lists {', '.join(sorted(company.isoCertificates))}."
                    if held
                    else " and your profile lists none."
                )
                + " Confirm against the tender document, which may name certifications"
                " not captured in the published fields."
            )
            results.append(
                CriterionResult(
                    criterion="Required Certifications",
                    status=CriterionStatus.UNCLEAR,
                    detail=detail,
                    importance=CriterionImportance.OPTIONAL,
                )
            )

        # 10. GeM registration
        if tender.tenderType and "gem" in tender.tenderType.lower():
            results.append(
                CriterionResult(
                    criterion="GeM Registration",
                    status=(
                        CriterionStatus.MET
                        if company.gemRegistered
                        else CriterionStatus.NOT_MET
                    ),
                    detail=(
                        "Company is registered on GeM"
                        if company.gemRegistered
                        else "Tender is on GeM but company is not registered on the platform"
                    ),
                    importance=CriterionImportance.OPTIONAL,
                )
            )

        return results

    # ------------------------------------------------------------------
    # LLM-based checks
    # ------------------------------------------------------------------

    async def check_llm(
        self, company: CompanyProfile, tender: TenderInfo
    ) -> tuple[List[CriterionResult], LlmStatus, Optional[str]]:
        """Run the LLM stage and report precisely what happened.

        Returns (criteria, status, error). It used to return a bare list, so an
        empty list meant "no extra criteria", "no API key", and "the provider
        rejected the request" indistinguishably — which is how a 401 ended up
        presented as a successful AI analysis.
        """
        if not tender.eligibilityText:
            return [], LlmStatus.SKIPPED_NO_TEXT, None

        if not settings.ANTHROPIC_API_KEY:
            logger.warning("ANTHROPIC_API_KEY not set; skipping LLM eligibility check")
            return [], LlmStatus.UNAVAILABLE, "No model API key is configured."

        try:
            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

            company_json = company.model_dump_json(indent=2)
            system_prompt = (
                "You are an expert in Indian government tender eligibility analysis. "
                "Analyse the company profile against the tender eligibility criteria and "
                "identify additional eligibility requirements NOT already covered by these "
                "standard checks: category match, geographic coverage, MSME/startup "
                "reservation, EMD exemption, project capacity, past experience, years in "
                "business, ISO certification, and GeM registration.\n\n"
                "Return ONLY a JSON array of objects with these fields:\n"
                '  - "criterion": short name of the eligibility requirement\n'
                '  - "status": one of "MET", "NOT_MET", "PARTIALLY_MET", "UNCLEAR"\n'
                '  - "detail": one-sentence explanation with specific numbers where possible\n'
                '  - "importance": one of "CRITICAL", "IMPORTANT", "OPTIONAL"\n\n'
                "If there are no additional criteria, return an empty array [].\n"
                "Return ONLY the JSON array, no other text."
            )

            user_prompt = (
                f"## Company Profile\n```json\n{company_json}\n```\n\n"
                f"## Tender Eligibility Criteria\n{tender.eligibilityText}"
            )

            message = await client.messages.create(
                model=settings.AI_MODEL,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            raw_text = message.content[0].text.strip()
            # Strip markdown code fences if present
            if raw_text.startswith("```"):
                raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3].strip()

            parsed: list = json.loads(raw_text)

            results: List[CriterionResult] = []
            for item in parsed:
                try:
                    results.append(
                        CriterionResult(
                            criterion=item["criterion"],
                            status=CriterionStatus(item["status"]),
                            detail=item["detail"],
                            importance=CriterionImportance(item["importance"]),
                        )
                    )
                except (KeyError, ValueError) as exc:
                    logger.warning("Skipping malformed LLM criterion: %s — %s", item, exc)

            # SUCCESS only when a validated response actually produced criteria.
            # An empty array is a legitimate model answer ("no extra criteria"),
            # so it still counts as a completed analysis.
            return results, LlmStatus.SUCCESS, None

        except anthropic.APITimeoutError as exc:
            logger.warning("LLM eligibility check timed out: %s", exc)
            return [], LlmStatus.TIMED_OUT, "The model did not respond in time."
        except anthropic.AuthenticationError:
            # Deliberately does not echo the provider message, which can quote
            # the offending key material.
            logger.warning("LLM eligibility check rejected: provider authentication failed")
            return [], LlmStatus.FAILED, "The model provider rejected the request (authentication failed)."
        except anthropic.RateLimitError:
            logger.warning("LLM eligibility check rejected: provider rate limit")
            return [], LlmStatus.FAILED, "The model provider rate-limited the request."
        except json.JSONDecodeError as exc:
            logger.warning("LLM returned unparseable JSON: %s", exc)
            return [], LlmStatus.FAILED, "The model returned a response that could not be parsed."
        except Exception as exc:  # noqa: BLE001
            logger.exception("LLM eligibility check failed")
            return [], LlmStatus.FAILED, f"The model call failed ({type(exc).__name__})."

    # ------------------------------------------------------------------
    # Suggestions
    # ------------------------------------------------------------------

    def generate_suggestions(self, criteria: List[CriterionResult]) -> List[str]:
        suggestions: List[str] = []
        suggestion_map = {
            "MSME Reservation": (
                "Register as an MSME on Udyam Registration portal "
                "(https://udyamregistration.gov.in) to become eligible for MSME-reserved tenders."
            ),
            "Startup (DPIIT) Reservation": (
                "Apply for DPIIT startup recognition at "
                "https://www.startupindia.gov.in to qualify for startup-reserved tenders."
            ),
            # Keyed to the renamed criterion. This is a generic recommendation,
            # not a statement about this tender's published requirements.
            "Required Certifications": (
                "Add your certifications to your company profile, and obtain any the "
                "tender document names (e.g. ISO 9001, ISO 14001) to strengthen your bid."
            ),
            "GeM Registration": (
                "Register on the Government e-Marketplace (GeM) at "
                "https://gem.gov.in to participate in GeM tenders."
            ),
            "Project Capacity": (
                "Consider forming a Joint Venture (JV) or consortium with "
                "a larger firm to meet the project capacity requirement."
            ),
            "Past Project Experience": (
                "Build experience by bidding on smaller projects first, or "
                "form a JV with an experienced partner to meet past-experience thresholds."
            ),
            "Years in Business": (
                "Some tenders require minimum years of operation. Consider JV partnerships "
                "with established firms while your company builds tenure."
            ),
            "Geographic Coverage": (
                "Open a branch office or partner with a local firm in the tender's "
                "state to demonstrate geographic presence."
            ),
            "Category Match": (
                "Expand your registered work categories to include the tender's "
                "category, or bid only on tenders matching your existing categories."
            ),
            "EMD Exemption for MSME": (
                "MSME registration would qualify you for EMD exemption, "
                "reducing upfront costs. Register at https://udyamregistration.gov.in."
            ),
        }

        for cr in criteria:
            if cr.status in (CriterionStatus.NOT_MET, CriterionStatus.PARTIALLY_MET):
                mapped = suggestion_map.get(cr.criterion)
                if mapped:
                    suggestions.append(mapped)
                else:
                    suggestions.append(
                        f"Address '{cr.criterion}': {cr.detail}"
                    )

        return suggestions

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    def calculate_score(
        self, criteria: List[CriterionResult]
    ) -> tuple[float, bool]:
        if not criteria:
            return 0.0, False

        met = sum(1 for c in criteria if c.status == CriterionStatus.MET)
        not_met = sum(1 for c in criteria if c.status == CriterionStatus.NOT_MET)
        partial = sum(
            1
            for c in criteria
            if c.status == CriterionStatus.PARTIALLY_MET
        )
        total = len(criteria)

        has_critical_fail = any(
            c.status == CriterionStatus.NOT_MET
            and c.importance == CriterionImportance.CRITICAL
            for c in criteria
        )

        score = (met + partial * 0.5) / total * 100

        if has_critical_fail:
            score = min(score, 40.0)

        is_eligible = score >= 60.0 and not has_critical_fail

        return round(score, 1), is_eligible

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    async def check(
        self, company: CompanyProfile, tender: TenderInfo
    ) -> EligibilityResult:
        # Rule-based checks
        rule_criteria = self.check_rules(company, tender)

        # LLM checks (only if eligibility text present)
        llm_criteria, llm_status, llm_error = await self.check_llm(company, tender)

        # Combine
        all_criteria = rule_criteria + llm_criteria

        # Score
        score, is_eligible = self.calculate_score(all_criteria)

        # Suggestions
        suggestions = self.generate_suggestions(all_criteria)

        # Summary
        met_count = sum(1 for c in all_criteria if c.status == CriterionStatus.MET)
        total = len(all_criteria)
        summary = (
            f"Eligibility score: {score}/100. "
            f"{met_count} of {total} criteria met. "
            f"{'Company appears eligible for this tender.' if is_eligible else 'Company may not meet all requirements for this tender.'}"
        )

        return EligibilityResult(
            score=score,
            is_eligible=is_eligible,
            criteria=all_criteria,
            suggestions=suggestions,
            summary=summary,
            ruleChecksCompleted=True,
            # True only when the LLM stage genuinely succeeded. Note this is
            # independent of whether it added criteria: a successful call that
            # found nothing extra still analysed the tender.
            llmAnalysed=llm_status == LlmStatus.SUCCESS,
            llmStatus=llm_status,
            llmError=llm_error,
        )
