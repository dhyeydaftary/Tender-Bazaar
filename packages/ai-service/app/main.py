import logging
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.eligibility.engine import (
    CompanyProfile,
    EligibilityEngine,
    EligibilityResult,
    TenderInfo,
)
from app.summarizer.tender_summary import TenderSummarizer
from app.categorizer.nlp_classifier import TenderClassifier
from app.bid_assistant.analyzer import (
    BidDocumentAnalyzer,
    CompanyProfileInput,
    CompanyDocument,
    TenderInfoInput,
    CompetitorInfo,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TenderBazaar AI Service",
    description="AI-powered eligibility checking, summarization, and classification for Indian government tenders",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Singleton instances
# ---------------------------------------------------------------------------

eligibility_engine = EligibilityEngine()
summarizer = TenderSummarizer()
classifier = TenderClassifier()
bid_analyzer = BidDocumentAnalyzer()

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class EligibilityCheckRequest(BaseModel):
    company: CompanyProfile
    tender: TenderInfo


class BulkEligibilityRequest(BaseModel):
    company: CompanyProfile
    tenders: List[TenderInfo] = Field(..., max_length=10)


class BulkEligibilityResponse(BaseModel):
    results: List[EligibilityResult]


class SummaryRequest(BaseModel):
    title: str
    description: str
    organization: Optional[str] = ""
    category: Optional[str] = ""


class ClassifyRequest(BaseModel):
    title: str
    description: Optional[str] = ""


class BidAnalyzeRequest(BaseModel):
    document_text: str
    company_profile: dict


class BidChecklistRequest(BaseModel):
    requirements: dict
    company_documents: List[dict] = []


class BidStrategyRequest(BaseModel):
    tender_info: dict
    company_profile: dict
    competitors: dict = {}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-service"}


@app.post("/eligibility/check", response_model=EligibilityResult)
async def check_eligibility(req: EligibilityCheckRequest):
    try:
        result = await eligibility_engine.check(req.company, req.tender)
        return result
    except Exception as exc:
        logger.exception("Eligibility check failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/eligibility/bulk", response_model=BulkEligibilityResponse)
async def bulk_check_eligibility(req: BulkEligibilityRequest):
    if len(req.tenders) > 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 tenders allowed per bulk request",
        )
    try:
        results: List[EligibilityResult] = []
        for tender in req.tenders:
            result = await eligibility_engine.check(req.company, tender)
            results.append(result)
        return BulkEligibilityResponse(results=results)
    except Exception as exc:
        logger.exception("Bulk eligibility check failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/ai/summary")
async def generate_summary(req: SummaryRequest):
    try:
        result = await summarizer.summarize(
            title=req.title,
            description=req.description,
            organization=req.organization or "",
            category=req.category or "",
        )
        return result
    except Exception as exc:
        logger.exception("Summary generation failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/ai/categorize")
async def categorize_tender(req: ClassifyRequest):
    try:
        result = await classifier.classify(
            title=req.title,
            description=req.description or "",
        )
        return result
    except Exception as exc:
        logger.exception("Categorization failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Bid Assistant Routes
# ---------------------------------------------------------------------------


@app.post("/bid-assistant/analyze")
async def bid_analyze(req: BidAnalyzeRequest):
    try:
        result = await bid_analyzer.analyze_tender_document(
            document_text=req.document_text,
            company_profile=req.company_profile,
        )
        return result
    except Exception as exc:
        logger.exception("Bid document analysis failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/bid-assistant/checklist")
async def bid_checklist(req: BidChecklistRequest):
    try:
        result = await bid_analyzer.generate_document_checklist(
            extracted_requirements=req.requirements,
            company_documents=req.company_documents,
        )
        return result
    except Exception as exc:
        logger.exception("Bid checklist generation failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/bid-assistant/strategy")
async def bid_strategy(req: BidStrategyRequest):
    try:
        result = await bid_analyzer.generate_bid_strategy(
            tender_info=req.tender_info,
            company_profile=req.company_profile,
            competitor_data=req.competitors,
        )
        return result
    except Exception as exc:
        logger.exception("Bid strategy generation failed")
        raise HTTPException(status_code=500, detail=str(exc))
