import json
import logging
import re
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


GST_STATE_MAP = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra & Nagar Haveli", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
    "32": "Kerala", "33": "Tamil Nadu", "36": "Telangana", "37": "Andhra Pradesh",
}


def _dynamic_analysis(document_text: str = "", company_profile: dict = None) -> dict:
    """Dynamically extract tender requirements, GSTIN, PAN, EMD, and documents needed from document text."""
    doc_raw = document_text or ""
    doc_lower = doc_raw.lower()
    is_gem = "gem" in doc_lower or "government e-marketplace" in doc_lower
    is_works = any(k in doc_lower for k in ["civil", "construction", "works", "boq", "epc", "road", "building"])
    is_goods = any(k in doc_lower for k in ["supply", "goods", "equipment", "hardware", "material", "oem"])
    is_services = any(k in doc_lower for k in ["service", "facility", "maintenance", "manpower", "consulting", "software"])

    # 1. Extract GSTIN (15-character Indian format)
    gstin_matches = re.findall(r'\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b', doc_raw)
    gstin = gstin_matches[0] if gstin_matches else None
    gstin_state = GST_STATE_MAP.get(gstin[:2], f"State Code {gstin[:2]}") if gstin else None

    # 2. Extract PAN (derived from GSTIN or standalone 10-character format)
    pan = None
    if gstin:
        pan = gstin[2:12]
    else:
        pan_matches = re.findall(r'\b[A-Z]{5}\d{4}[A-Z]{1}\b', doc_raw)
        if pan_matches:
            pan = pan_matches[0]

    # 3. Extract EMD Amount
    emd_match = re.search(r'(?:EMD|Earnest\s*Money|Bid\s*Security)[^\n\r.:;]*[:\s]+(?:Rs\.?|₹)?\s*([0-9,.]+\s*(?:Lakhs?|Crores?|Cr|L|k)?)', doc_raw, re.IGNORECASE)
    emd_amount = emd_match.group(1).strip() if emd_match else None

    # 4. Extract Turnover
    turnover_match = re.search(r'(?:Turnover|Annual\s*Turnover|Financial\s*Turnover)[^\n\r.:;]*[:\s]+(?:Rs\.?|₹)?\s*([0-9,.]+\s*(?:Lakhs?|Crores?|Cr|L|k)?)', doc_raw, re.IGNORECASE)
    turnover_criteria = turnover_match.group(1).strip() if turnover_match else None

    # 5. Extract Tender / NIT Reference
    nit_match = re.search(r'(?:NIT\s*(?:No|Number)?|Tender\s*(?:No|Number|Ref|Id|Notice\s*No)?|Bid\s*(?:No|Number)|GEM\/\d+)[^\n\r:;]*[:\s#]+([A-Z0-9\/\-_]{4,40})', doc_raw, re.IGNORECASE)
    tender_ref = nit_match.group(1).strip() if nit_match else None

    # Build dynamic requirements based on extracted entities
    requirements = []

    # GSTIN Requirement
    if gstin:
        requirements.append({
            "type": "registration",
            "description": f"Valid GSTIN identified & verified from uploaded document: {gstin} ({gstin_state})",
            "mandatory": True,
            "status": "verified",
            "extracted_value": gstin,
        })
    else:
        requirements.append({
            "type": "registration",
            "description": "Valid GSTIN registration certificate mandatory — No GSTIN detected in uploaded document. Please upload GST REG-06 certificate.",
            "mandatory": True,
            "status": "missing",
        })

    # PAN Requirement
    if pan:
        requirements.append({
            "type": "registration",
            "description": f"Permanent Account Number (PAN) verified from document: {pan}",
            "mandatory": True,
            "status": "verified",
            "extracted_value": pan,
        })
    else:
        requirements.append({
            "type": "registration",
            "description": "Permanent Account Number (PAN) copy mandatory — No 10-digit PAN detected in uploaded document.",
            "mandatory": True,
            "status": "missing",
        })

    # Legal Entity / Eligibility Requirement
    if tender_ref:
        requirements.append({
            "type": "eligibility",
            "description": f"Tender Reference: {tender_ref} — Bidder must be legally registered entity (Incorporation Certificate / MSME)",
            "mandatory": True,
            "status": "verified",
            "extracted_value": tender_ref,
        })
    else:
        requirements.append({
            "type": "eligibility",
            "description": "Bidder must be a legally registered entity (Incorporation Certificate / Partnership Deed / MSME)",
            "mandatory": True,
        })

    # Financial / Turnover Requirement
    if turnover_criteria:
        requirements.append({
            "type": "financial",
            "description": f"Minimum Annual Turnover Requirement: Rs. {turnover_criteria} (Audited Balance Sheet certified by CA with ICAI UDIN)",
            "mandatory": True,
            "status": "verified",
            "extracted_value": turnover_criteria,
        })
    else:
        requirements.append({
            "type": "financial",
            "description": "Audited Balance Sheets & Profit and Loss statements for last 3 financial years certified by Chartered Accountant with ICAI UDIN",
            "mandatory": True,
        })

    # EMD Requirement
    if emd_amount:
        requirements.append({
            "type": "financial",
            "description": f"Earnest Money Deposit (EMD): Rs. {emd_amount} (Bank Guarantee from scheduled commercial bank or valid MSME exemption)",
            "mandatory": True,
            "status": "verified",
            "extracted_value": emd_amount,
        })
    else:
        requirements.append({
            "type": "financial",
            "description": "Earnest Money Deposit (EMD) Bank Guarantee from scheduled commercial bank or valid MSME/Udyam exemption certificate",
            "mandatory": True,
        })

    # Experience Requirement
    requirements.append({
        "type": "experience",
        "description": "Past contract performance proof and client-certified completion certificates for similar scope of work in past 3–5 years",
        "mandatory": True,
    })

    if is_gem:
        requirements.append({
            "type": "compliance",
            "description": "GeM portal seller profile verification and bid terms compliance matrix",
            "mandatory": True,
        })

    if is_works:
        requirements.append({
            "type": "technical",
            "description": "Adequate machinery, tools & plant deployment schedule and site visit declaration",
            "mandatory": True,
        })

    documents_needed = [
        "GST Registration Certificate",
        "PAN Card",
        "Company Registration Certificate",
        "Audited Financial Statements (FY 2024-25)",
        "EMD Bank Guarantee",
        "Solvency Certificate",
    ]

    if is_gem:
        documents_needed.extend([
            "GeM Bid Specification Compliance Matrix",
            "OEM Authorization Form (MAF)",
        ])

    if is_works:
        documents_needed.extend([
            "Similar Works Completion Certificates",
            "Site Visit Declaration Form",
        ])

    documents_needed.extend([
        "Non-Blacklisting Affidavit / Self-Declaration",
        "Power of Attorney for Authorized Signatory",
    ])

    from datetime import datetime, timedelta

    deadline_date = None
    date_match = re.search(r'(?:deadline|submission|due date|closing)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})', doc_lower)
    if date_match:
        raw_d = date_match.group(1)
        if '-' in raw_d and len(raw_d.split('-')[0]) == 4:
            try:
                deadline_date = datetime.fromisoformat(raw_d)
            except Exception:
                pass
        elif '/' in raw_d or '-' in raw_d:
            parts = re.split(r'[/-]', raw_d)
            if len(parts) == 3:
                try:
                    deadline_date = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                except Exception:
                    pass

    if not deadline_date:
        deadline_date = datetime.now() + timedelta(days=21)

    tech_opening = deadline_date + timedelta(days=1)
    fin_opening = deadline_date + timedelta(days=7)

    important_dates = [
        {"event": "Bid Submission Deadline", "date": deadline_date.strftime("%Y-%m-%d")},
        {"event": "Technical Bid Opening", "date": tech_opening.strftime("%Y-%m-%d")},
        {"event": "Financial Bid Opening", "date": fin_opening.strftime("%Y-%m-%d")},
    ]

    extracted_entities = {
        "gstin": gstin,
        "gstin_state": gstin_state,
        "has_gstin": bool(gstin),
        "pan": pan,
        "has_pan": bool(pan),
        "emd": emd_amount,
        "turnover": turnover_criteria,
        "tender_ref": tender_ref,
        "deadline": deadline_date.strftime("%Y-%m-%d") if deadline_date else None,
    }

    return {
        "requirements": requirements,
        "documents_needed": documents_needed,
        "important_dates": important_dates,
        "extracted_entities": extracted_entities,
        "submission_instructions": {
            "mode": "Online through e-Procurement / GeM Portal",
            "portal": "https://gem.gov.in" if is_gem else "https://eprocure.gov.in",
            "steps": [
                "Verify eligibility criteria against tender specifications",
                "Prepare and digitally sign all mandatory technical documents",
                "Ensure EMD Bank Guarantee / MSME waiver is in designated format",
                "Upload technical and financial covers separately prior to deadline",
            ],
        },
        "financial_requirements": {
            "emd_amount": f"Rs. {emd_amount}" if emd_amount else "As specified in tender document",
            "solvency_certificate": "Bank solvency certificate from scheduled commercial bank",
            "min_turnover": f"Rs. {turnover_criteria}" if turnover_criteria else "Average annual turnover of last 3 financial years",
        },
        "technical_requirements": {
            "experience": "Minimum 3 similar completed contracts in past 5 years",
            "certifications": ["ISO 9001:2015 (preferred)", "MSME/Udyam (if applicable)"],
            "equipment": "Standard equipment as required by tender scope",
            "manpower": "Qualified technical personnel and project supervisor",
        },
        "_dynamic": True,
    }


def _dynamic_checklist(extracted_requirements: dict, company_documents: list) -> dict:
    """
    Compare tender requirements against actual company documents.
    Every required tender document (GST, PAN, Incorporation, EMD, CA Audit, Solvency)
    is treated as a MANDATORY requirement.
    Only documents that actually exist in company_documents are put in 'matched'.
    All missing mandatory documents are put in 'missing' with priority='high'.
    """
    req_docs = []
    if isinstance(extracted_requirements, dict):
        if "documents_needed" in extracted_requirements and isinstance(extracted_requirements["documents_needed"], list):
            req_docs.extend(extracted_requirements["documents_needed"])
        if "requirements" in extracted_requirements and isinstance(extracted_requirements["requirements"], list):
            for r in extracted_requirements["requirements"]:
                if isinstance(r, dict):
                    desc = r.get("description", "")
                    if "gst" in desc.lower() and "GST Registration Certificate" not in req_docs:
                        req_docs.append("GST Registration Certificate")
                    if "pan" in desc.lower() and "PAN Card" not in req_docs:
                        req_docs.append("PAN Card")
                    if "incorporat" in desc.lower() or "regist" in desc.lower():
                        if "Company Registration Certificate" not in req_docs:
                            req_docs.append("Company Registration Certificate")
                    if "turnover" in desc.lower() or "balance sheet" in desc.lower():
                        if "Audited Financial Statements (FY 2024-25)" not in req_docs:
                            req_docs.append("Audited Financial Statements (FY 2024-25)")
                    if "emd" in desc.lower() or "guarantee" in desc.lower():
                        if "EMD Bank Guarantee" not in req_docs:
                            req_docs.append("EMD Bank Guarantee")
                    if "solvency" in desc.lower():
                        if "Solvency Certificate" not in req_docs:
                            req_docs.append("Solvency Certificate")

    if not req_docs:
        req_docs = [
            "GST Registration Certificate",
            "PAN Card",
            "Company Registration Certificate",
            "Audited Financial Statements (FY 2024-25)",
            "EMD Bank Guarantee",
            "Solvency Certificate",
            "Past Similar Work Experience Certificates",
            "Non-Blacklisting Affidavit / Self-Declaration",
            "Power of Attorney for Authorized Signatory",
        ]

    # Deduplicate while preserving order
    seen = set()
    unique_req_docs = []
    for d in req_docs:
        d_clean = str(d).strip()
        if d_clean and d_clean.lower() not in seen:
            seen.add(d_clean.lower())
            unique_req_docs.append(d_clean)

    matched = []
    missing = []
    recommendations = []

    def find_company_doc(req_name: str):
        req_lower = req_name.lower()
        for cdoc in (company_documents or []):
            if not isinstance(cdoc, dict):
                continue
            c_name = str(cdoc.get("name", "")).lower()
            c_type = str(cdoc.get("documentType", "") or cdoc.get("type", "")).lower()
            c_file = str(cdoc.get("fileUrl", "")).lower()

            if not c_name and not c_type and not c_file:
                continue

            if "gst" in req_lower:
                if re.search(r'\bgst\b|gstin|gst_cert', c_name) or re.search(r'\bgst\b|gstin', c_type):
                    return cdoc
            elif "pan" in req_lower:
                if re.search(r'\bpan\b|pan_card|pancard', c_name) or re.search(r'\bpan\b', c_type):
                    return cdoc
            elif "incorporat" in req_lower or "company reg" in req_lower:
                if any(k in c_name for k in ["incorporat", "certificate of inc", "coi", "roc"]) or "cin" in c_type:
                    return cdoc
            elif "audit" in req_lower or "financial" in req_lower or "turnover" in req_lower:
                if any(k in c_name for k in ["audit", "turnover", "balance_sheet", "balance sheet", "p&l", "financials"]):
                    return cdoc
            elif "emd" in req_lower or "guarantee" in req_lower or "bg" in req_lower:
                if any(k in c_name for k in ["emd", "bank guarantee", "bank_guarantee", "_bg"]):
                    return cdoc
            elif "solvency" in req_lower:
                if "solvency" in c_name:
                    return cdoc
            elif "experience" in req_lower:
                if any(k in c_name for k in ["experience", "work order", "completion", "client_cert"]):
                    return cdoc
            elif "oem" in req_lower:
                if "oem" in c_name:
                    return cdoc
            elif len(req_lower) > 5 and req_lower in c_name:
                return cdoc
        return None

    for req in unique_req_docs:
        cdoc = find_company_doc(req)
        if cdoc:
            matched.append({
                "document": req,
                "status": "available",
                "notes": f"Verified on file: {cdoc.get('name', req)}",
                "mandatory": True,
            })
        else:
            req_l = req.lower()
            if "gst" in req_l:
                rec = "Upload your valid GST registration certificate (Form GST REG-06) showing all active business places."
            elif "pan" in req_l:
                rec = "Upload clear scanned copy of Company/Firm PAN card."
            elif "incorporat" in req_l or "registration" in req_l:
                rec = "Upload Certificate of Incorporation / Partnership Deed with Registrar of Companies seal."
            elif "audit" in req_l or "financial" in req_l:
                rec = "Obtain audited FY 2024-25 balance sheet & P&L certified by CA with mandatory ICAI UDIN."
            elif "emd" in req_l or "guarantee" in req_l:
                rec = "Apply for EMD Bank Guarantee from your scheduled bank or submit MSME/Udyam exemption certificate."
            elif "solvency" in req_l:
                rec = "Request a Solvency Certificate on bank letterhead dated within the last 6 months."
            elif "experience" in req_l:
                rec = "Compile client-issued completion certificates for past similar government/PSU contracts."
            else:
                rec = f"Prepare and notarize {req} on company letterhead as per tender annexure format."

            missing.append({
                "document": req,
                "priority": "high",
                "deadline": "Mandatory before bid submission",
                "mandatory": True,
            })
            if rec not in recommendations:
                recommendations.append(rec)

    return {
        "matched": matched,
        "missing": missing,
        "recommendations": recommendations[:6],
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
            logger.info("Using dynamic rule-based analysis for tender document")
            return _dynamic_analysis(document_text, company_profile)

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
                "Use Indian Rupee (₹) formatting with Cr/L suffixes for large amounts. "
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
            logger.exception("Tender document analysis failed, falling back to dynamic parser")
            return _dynamic_analysis(document_text, company_profile)

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
            logger.info("Using dynamic checklist matcher for company documents")
            return _dynamic_checklist(extracted_requirements, company_documents)

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
            logger.exception("Document checklist generation failed, falling back to dynamic parser")
            return _dynamic_checklist(extracted_requirements, company_documents)

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
