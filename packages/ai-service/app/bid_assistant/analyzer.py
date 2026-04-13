import json
import logging
from typing import Dict, List, Optional

import anthropic
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------


class CompanyProfileInput(BaseModel):
    companyName: str
    companyType: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    annualTurnover: Optional[float] = None
    netWorth: Optional[float] = None
    employeeCount: Optional[int] = None
    yearsInBusiness: Optional[int] = None
    msmeRegistered: bool = False
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


class CompanyDocument(BaseModel):
    name: str
    documentType: str
    fileUrl: Optional[str] = None


class TenderInfoInput(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    organization: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    tenderType: Optional[str] = None
    state: Optional[str] = None
    estimatedValue: Optional[float] = None
    emdAmount: Optional[float] = None
    bidSubmissionDeadline: Optional[str] = None


class CompetitorInfo(BaseModel):
    recentWinners: List[str] = []
    averageWinningBid: Optional[float] = None
    totalBidders: Optional[int] = None
    categoryTrends: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fmt_inr(value: float) -> str:
    """Format a float as an INR-friendly string (e.g. 5.2Cr, 45L)."""
    if value >= 1_00_00_000:
        return f"\u20b9{value / 1_00_00_000:.1f}Cr"
    if value >= 1_00_000:
        return f"\u20b9{value / 1_00_000:.1f}L"
    return f"\u20b9{value:,.0f}"


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences from LLM output."""
    raw = text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3].strip()
    return raw


def _mock_analysis() -> dict:
    """Return a realistic mock analysis when API key is missing."""
    return {
        "requirements": [
            {
                "type": "eligibility",
                "description": "The bidder must be a registered company/firm/LLP under Indian law",
                "mandatory": True,
            },
            {
                "type": "financial",
                "description": "Minimum annual turnover of \u20b92 Crore in last 3 financial years",
                "mandatory": True,
            },
            {
                "type": "experience",
                "description": "Must have completed at least 3 similar projects of value \u20b950 Lakhs or above in last 5 years",
                "mandatory": True,
            },
            {
                "type": "registration",
                "description": "Valid GST registration and PAN card required",
                "mandatory": True,
            },
        ],
        "documents_needed": [
            "Company Registration Certificate",
            "GST Registration Certificate",
            "PAN Card",
            "Audited Financial Statements (last 3 years)",
            "Work Completion Certificates (3 similar projects)",
            "EMD (Earnest Money Deposit) - Bank Guarantee or DD",
            "Power of Attorney for authorized signatory",
            "Self-attested undertaking of no blacklisting",
            "Technical bid documents as per NIT format",
        ],
        "important_dates": [
            {"event": "Tender Published", "date": "2026-03-15"},
            {"event": "Pre-Bid Meeting", "date": "2026-03-25"},
            {"event": "Last Date for Queries", "date": "2026-03-28"},
            {"event": "Bid Submission Deadline", "date": "2026-04-15"},
            {"event": "Technical Bid Opening", "date": "2026-04-16"},
            {"event": "Financial Bid Opening", "date": "2026-04-20"},
        ],
        "submission_instructions": {
            "mode": "Online through e-procurement portal",
            "portal": "https://eprocure.gov.in",
            "steps": [
                "Register on the e-procurement portal if not already registered",
                "Download tender documents and study all terms",
                "Prepare Technical Bid (Cover 1) and Financial Bid (Cover 2) separately",
                "Upload scanned copies of all required documents",
                "Submit EMD through online payment or upload BG scan",
                "Digitally sign and submit before the deadline",
            ],
        },
        "financial_requirements": {
            "emd_amount": "\u20b92,50,000",
            "tender_fee": "\u20b95,000",
            "min_turnover": "\u20b92 Crore (average of last 3 years)",
            "solvency_certificate": "Required from a scheduled bank",
            "performance_guarantee": "5% of contract value upon award",
        },
        "technical_requirements": {
            "experience": "3 similar completed projects in last 5 years",
            "certifications": ["ISO 9001:2015 (preferred)", "Valid labour license"],
            "equipment": "Adequate machinery and equipment as specified in NIT",
            "manpower": "Qualified technical staff including Project Manager and Site Engineer",
        },
        "_mock": True,
    }


def _mock_checklist() -> dict:
    """Return a realistic mock checklist when API key is missing."""
    return {
        "matched": [
            {
                "document": "GST Registration Certificate",
                "status": "available",
                "notes": "Valid and up to date",
            },
            {
                "document": "PAN Card",
                "status": "available",
                "notes": "Company PAN on file",
            },
            {
                "document": "Company Registration Certificate",
                "status": "available",
                "notes": "Certificate of Incorporation uploaded",
            },
        ],
        "missing": [
            {
                "document": "Audited Financial Statements (FY 2024-25)",
                "priority": "high",
                "deadline": "Required before bid submission",
            },
            {
                "document": "EMD Bank Guarantee",
                "priority": "high",
                "deadline": "Arrange from scheduled bank",
            },
            {
                "document": "Solvency Certificate",
                "priority": "medium",
                "deadline": "Obtain from bank within 2 weeks",
            },
        ],
        "recommendations": [
            "Get your FY 2024-25 financial statements audited immediately - this is typically required for tenders above \u20b91 Crore.",
            "Apply for a Bank Guarantee for EMD from your primary bank. Processing typically takes 3-5 working days.",
            "Request a solvency certificate from your bank branch. Ensure it is dated within the last 6 months.",
        ],
        "_mock": True,
    }


def _mock_strategy() -> dict:
    """Return a realistic mock strategy when API key is missing."""
    return {
        "suggested_bid_range": {
            "low": "\u20b91.85 Crore",
            "optimal": "\u20b92.10 Crore",
            "high": "\u20b92.35 Crore",
            "rationale": "Based on estimated value and historical winning bids in this category, an L1 bid around 84-94% of estimated value is competitive.",
        },
        "key_strengths": [
            "Strong experience in similar projects within the same state",
            "MSME registration provides EMD exemption advantage",
            "ISO 9001 certified - adds credibility to technical bid",
            "Local presence in the tender state reduces mobilization costs",
        ],
        "potential_risks": [
            "Tight submission deadline - only 5 days remaining",
            "EMD amount is significant - ensure liquidity planning",
            "Technical evaluation weightage is 70% - focus on quality documentation",
            "Competitor XYZ has won 3 similar tenders recently in this region",
        ],
        "win_probability": {
            "score": 68,
            "label": "Good",
            "reasoning": "Your company profile matches well with tender requirements. Key factors: relevant experience (positive), local presence (positive), but competitive field with established players (risk).",
        },
        "action_items": [
            "Start EMD processing immediately with your bank",
            "Prepare a detailed methodology section highlighting similar project experience",
            "Include client testimonials and completion certificates from past projects",
            "Price competitively - aim for the optimal range to balance competitiveness and margin",
        ],
        "_mock": True,
    }


# ---------------------------------------------------------------------------
# BidDocumentAnalyzer
# ---------------------------------------------------------------------------


class BidDocumentAnalyzer:
    def __init__(self):
        self.model = settings.AI_MODEL

    async def analyze_tender_document(
        self, document_text: str, company_profile: dict
    ) -> dict:
        """
        Analyze a tender document and extract:
        - requirements: list of all eligibility/qualification requirements
        - documents_needed: checklist of required documents
        - important_dates: all deadlines and dates
        - submission_instructions: how to submit the bid
        - financial_requirements: EMD, turnover, solvency requirements
        - technical_requirements: experience, certifications needed
        """
        if not settings.ANTHROPIC_API_KEY:
            logger.warning(
                "ANTHROPIC_API_KEY not set; returning mock analysis"
            )
            return _mock_analysis()

        try:
            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

            system_prompt = (
                "You are an expert analyst specializing in Indian government tenders "
                "and public procurement. Analyze the provided tender document text and "
                "extract structured information.\n\n"
                "Return ONLY a valid JSON object with these keys:\n"
                '- "requirements": array of objects with {type, description, mandatory}\n'
                '  (type is one of: "eligibility", "financial", "technical", "experience", "registration", "other")\n'
                '- "documents_needed": array of document name strings required for submission\n'
                '- "important_dates": array of objects with {event, date} (date as YYYY-MM-DD if available, else descriptive text)\n'
                '- "submission_instructions": object with {mode, portal, steps} where steps is an array of strings\n'
                '- "financial_requirements": object with relevant fields like emd_amount, tender_fee, min_turnover, solvency_certificate, performance_guarantee\n'
                '- "technical_requirements": object with fields like experience, certifications (array), equipment, manpower\n\n'
                "Use Indian Rupee (\u20b9) formatting with Cr/L suffixes for large amounts. "
                "If a field cannot be determined from the text, use null. "
                "Return ONLY the JSON object, no other text."
            )

            company_json = json.dumps(company_profile, indent=2, default=str)
            user_prompt = (
                f"## Company Profile (for context)\n```json\n{company_json}\n```\n\n"
                f"## Tender Document Text\n{document_text}"
            )

            message = await client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            raw_text = _strip_code_fences(message.content[0].text)
            result = json.loads(raw_text)
            return result

        except Exception:
            logger.exception("Tender document analysis failed")
            return _mock_analysis()

    async def generate_document_checklist(
        self, extracted_requirements: dict, company_documents: list
    ) -> dict:
        """
        Compare required documents against user's uploaded documents.
        Return:
        - matched: documents user already has
        - missing: documents user needs to prepare
        - recommendations: specific advice per missing document
        """
        if not settings.ANTHROPIC_API_KEY:
            logger.warning(
                "ANTHROPIC_API_KEY not set; returning mock checklist"
            )
            return _mock_checklist()

        try:
            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

            system_prompt = (
                "You are an expert in Indian government tender document preparation. "
                "Compare the required documents for a tender against the documents the "
                "company already has on file.\n\n"
                "Return ONLY a valid JSON object with these keys:\n"
                '- "matched": array of objects with {document, status, notes} for documents the company has\n'
                '- "missing": array of objects with {document, priority, deadline} for documents the company needs\n'
                '  (priority is one of: "high", "medium", "low")\n'
                '- "recommendations": array of strings with specific actionable advice for each missing document\n\n'
                "Return ONLY the JSON object, no other text."
            )

            user_prompt = (
                f"## Required Documents / Tender Requirements\n"
                f"```json\n{json.dumps(extracted_requirements, indent=2, default=str)}\n```\n\n"
                f"## Company's Existing Documents\n"
                f"```json\n{json.dumps(company_documents, indent=2, default=str)}\n```"
            )

            message = await client.messages.create(
                model=self.model,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            raw_text = _strip_code_fences(message.content[0].text)
            result = json.loads(raw_text)
            return result

        except Exception:
            logger.exception("Document checklist generation failed")
            return _mock_checklist()

    async def generate_bid_strategy(
        self,
        tender_info: dict,
        company_profile: dict,
        competitor_data: dict,
    ) -> dict:
        """
        Generate bid strategy recommendations:
        - Suggested bid amount range
        - Key strengths to highlight
        - Potential risks
        - Win probability estimate
        """
        if not settings.ANTHROPIC_API_KEY:
            logger.warning(
                "ANTHROPIC_API_KEY not set; returning mock strategy"
            )
            return _mock_strategy()

        try:
            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

            system_prompt = (
                "You are an expert bid strategist for Indian government tenders. "
                "Analyze the tender details, company profile, and competitor data to "
                "generate a comprehensive bid strategy.\n\n"
                "Return ONLY a valid JSON object with these keys:\n"
                '- "suggested_bid_range": object with {low, optimal, high, rationale} (amounts in INR with Cr/L suffixes)\n'
                '- "key_strengths": array of strings highlighting company advantages for this tender\n'
                '- "potential_risks": array of strings identifying risks and challenges\n'
                '- "win_probability": object with {score (0-100), label ("Low"/"Fair"/"Good"/"High"/"Excellent"), reasoning}\n'
                '- "action_items": array of prioritized action strings for the company\n\n'
                "Be specific and data-driven. Reference actual numbers from the inputs. "
                "Use Indian Rupee (\u20b9) formatting. "
                "Return ONLY the JSON object, no other text."
            )

            user_prompt = (
                f"## Tender Information\n"
                f"```json\n{json.dumps(tender_info, indent=2, default=str)}\n```\n\n"
                f"## Company Profile\n"
                f"```json\n{json.dumps(company_profile, indent=2, default=str)}\n```\n\n"
                f"## Competitor / Market Data\n"
                f"```json\n{json.dumps(competitor_data, indent=2, default=str)}\n```"
            )

            message = await client.messages.create(
                model=self.model,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            raw_text = _strip_code_fences(message.content[0].text)
            result = json.loads(raw_text)
            return result

        except Exception:
            logger.exception("Bid strategy generation failed")
            return _mock_strategy()
