'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Crown,
  Target,
  FileCheck,
  CalendarDays,
  Send,
  IndianRupee,
  Wrench,
  TrendingUp,
  Shield,
  Lightbulb,
  Copy,
  Check,
  Download,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';
import { usePlanInfo } from '@/lib/hooks/use-feature-gate';
import { UpgradeBanner } from '@/components/subscription';
import { extractDocumentText, extractDocumentEntities, ExtractedEntities } from '@/lib/document-parser';

/* ─── Indian Number Formatting ─── */

function formatINR(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Not specified';
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return String(value);
  if (num >= 10000000) return `\u20b9${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `\u20b9${(num / 100000).toFixed(2)} L`;
  return `\u20b9${num.toLocaleString('en-IN')}`;
}

/* ─── Types ─── */

interface Requirement {
  type: string;
  description: string;
  mandatory: boolean;
  status?: 'verified' | 'missing' | string;
  extractedValue?: string;
}

interface DateItem {
  event: string;
  date: string;
}

interface SubmissionInstructions {
  mode: string;
  portal: string;
  steps: string[];
}

interface ChecklistDoc {
  document: string;
  status?: string;
  notes?: string;
  priority?: string;
  deadline?: string;
}

interface WinProbability {
  score: number;
  label: string;
  reasoning: string;
}

interface BidRange {
  low: string;
  optimal: string;
  high: string;
  rationale: string;
}

interface AnalysisData {
  analysis: {
    requirements: Requirement[];
    documents_needed: string[];
    important_dates: DateItem[];
    submission_instructions: SubmissionInstructions;
    financial_requirements: Record<string, string>;
    technical_requirements: {
      experience: string;
      certifications: string[];
      equipment: string;
      manpower: string;
    };
  };
  checklist: {
    matched: ChecklistDoc[];
    missing: ChecklistDoc[];
    recommendations: string[];
  };
  strategy: {
    suggested_bid_range: BidRange;
    key_strengths: string[];
    potential_risks: string[];
    win_probability: WinProbability;
    action_items: string[];
  };
  extracted_entities?: {
    gstin?: string | null;
    gstin_state?: string | null;
    has_gstin?: boolean;
    pan?: string | null;
    has_pan?: boolean;
    emd?: string | null;
    turnover?: string | null;
    tender_ref?: string | null;
    deadline?: string | null;
    fileName?: string | null;
  };
}

interface TenderInfo {
  id: string;
  title: string;
  organization?: string;
  estimatedValue?: number;
  bidDeadline?: string;
  [key: string]: unknown;
}

/* ─── Helpers ─── */

function getDraftTemplate(docName?: string, tenderInfo?: TenderInfo | null) {
  const safeDocName = String(docName || 'Document').trim();
  const tenderTitle = tenderInfo?.title || 'Supply and Installation of Materials / Services';
  const orgName = tenderInfo?.organization || 'Tender Inviting Authority';
  const tenderRef = tenderInfo?.id ? `Tender Ref: ${tenderInfo.id}` : 'Tender Ref: GeM-Bidding-9881896';
  let today = '';
  try {
    today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    today = new Date().toDateString();
  }
  const valueFormatted = formatINR(tenderInfo?.estimatedValue);

  const lower = safeDocName.toLowerCase();

  if (lower.includes('financial') || lower.includes('audit') || lower.includes('turnover')) {
    return {
      title: 'Audited Financial Statements & Turnover Requisition',
      recipient: 'Statutory Auditor / Chartered Accountant',
      description: 'Formal requisition letter to obtain certified audited balance sheet, profit & loss, and turnover certificate with mandatory ICAI UDIN.',
      template: `Date: ${today}

To,
The Statutory Auditor / Chartered Accountant,
[Name of CA Firm]
[Address Line 1]
[City, State, PIN]

Subject: Request for Audited Financial Statements & Turnover Certificate with UDIN
Reference: ${tenderRef} - "${tenderTitle}"

Dear Sir / Madam,

We are participating in a government tender published by ${orgName}${tenderInfo?.estimatedValue ? ` with an estimated value of ${valueFormatted}` : ''}.

Under the mandatory tender criteria, bidders are required to submit CA-certified financial documents. We request your office to kindly issue the following:

1. Audited Balance Sheet and Profit & Loss Account for FY 2024–25 (with audit report & notes).
2. Annual Turnover Certificate for the preceding three financial years (FY 2022-23, 2023-24, 2024-25) highlighting the average annual turnover.
3. Net Worth Certificate as of 31st March 2025.

Kindly ensure that each certified document bears a unique ICAI UDIN (Unique Document Identification Number) as required by government e-procurement guidelines.

Thanking you,

Yours faithfully,
For [Your Company Name]

[Authorized Signatory]
[Designation & Contact Info]`,
    };
  }

  if (lower.includes('emd') || lower.includes('guarantee') || lower.includes('bg')) {
    return {
      title: 'Bank Guarantee / EMD Requisition Letter',
      recipient: 'Branch Manager, Scheduled Commercial Bank',
      description: 'Official application letter to your bank branch requesting an Irrevocable Bank Guarantee for EMD in favor of the tender authority with SFMS advice.',
      template: `Date: ${today}

To,
The Branch Manager,
[Name of Scheduled Commercial Bank]
[Branch Name / Address]
[City, State, PIN]

Subject: Requisition for Issuance of Earnest Money Deposit (EMD) Bank Guarantee
Reference: Current Account No: [Your Account Number] | ${tenderRef}

Dear Sir / Madam,

We are submitting our bid for "${tenderTitle}" invited by ${orgName}.

In accordance with the bidding conditions, we request your branch to issue an Irrevocable Bank Guarantee towards Earnest Money Deposit (EMD) with the following particulars:

1. Beneficiary Name: ${orgName}
2. Tender Reference: ${tenderRef}
3. Bank Guarantee Amount: ₹ [EMD Amount in figures and words]
4. Validity Period: 180 days from bid opening date (valid up to [Expiry Date])
5. Claim Period: 90 days beyond expiry date
6. SFMS Code / Transmission: [Beneficiary Bank IFSC & Branch Code for SFMS message]

Please debit the bank guarantee issuance charges and requisite margin from our Current Account No: [Your Account Number]. Kindly provide the original Bank Guarantee on requisite stamp paper along with the SFMS transmission confirmation.

Thanking you,

Yours faithfully,
For [Your Company Name]

[Authorized Signatory]
[Designation & Company Stamp]`,
    };
  }

  if (lower.includes('solvency')) {
    return {
      title: 'Bank Solvency Certificate Requisition',
      recipient: 'Branch Manager, Scheduled Commercial Bank',
      description: 'Official request to your banker for issuance of a Bank Solvency Certificate validating the creditworthiness and financial soundness of your firm.',
      template: `Date: ${today}

To,
The Branch Manager,
[Name of Scheduled Commercial Bank]
[Branch Name / Address]
[City, State, PIN]

Subject: Requisition for Issuance of Bank Solvency Certificate
Reference: Current Account No: [Your Account Number] in the name of [Your Company Name]

Dear Sir / Madam,

Our firm maintains Current Account No: [Your Account Number] with your branch and has maintained a satisfactory banking record.

We are currently participating in a government tender:
Tender Name: "${tenderTitle}"
Authority: ${orgName} (${tenderRef})

To satisfy the pre-qualification eligibility conditions, we require a Bank Solvency Certificate on bank letterhead confirming that our firm is solvent and financially sound up to ₹ [Required Solvency Amount / 40% of tender value].

Kindly issue the certificate in the standard format at your earliest convenience and debit any applicable bank service charges from our account.

Thanking you,

Yours faithfully,
For [Your Company Name]

[Authorized Signatory]
[Designation & Contact Info]`,
    };
  }

  return {
    title: `${docName} - Undertaking / Document Request`,
    recipient: orgName,
    description: `Formal declaration and compliance undertaking for "${docName}" ready for your official letterhead.`,
    template: `Date: ${today}

To,
${orgName}
[Tender Inviting Authority / Procurement Department]
[Address Line 1]

Subject: Submission & Undertaking for ${docName}
Reference: ${tenderRef} - "${tenderTitle}"

Dear Sir / Madam,

With reference to the subject tender, we hereby submit the enclosed ${docName} in full compliance with the terms and instructions set forth in the tender document.

We solemnly declare and affirm that:
1. The particulars and details submitted in this document are genuine, complete, and authentic.
2. We satisfy all qualifying criteria stipulated by ${orgName} in this regard.
3. We agree to furnish original documents for verification whenever demanded.

Enclosure: Certified copy of ${docName}

Yours faithfully,
For [Your Company Name]

[Authorized Signatory]
[Name, Designation & Seal]`,
  };
}

function resolveTimelineDate(
  rawDate: unknown,
  tenderInfo?: TenderInfo | null,
  eventName?: string
): { formatted: string; isPast: boolean; isUpcoming: boolean; timeRemaining: string } {
  let dateObj: Date | null = null;
  const str = String(rawDate || '').trim();

  // 1. Try direct parse if valid ISO or date string
  if (str) {
    const direct = new Date(str);
    if (!isNaN(direct.getTime()) && direct.getFullYear() > 2000) {
      dateObj = direct;
    } else {
      // 2. Try DD/MM/YYYY or DD-MM-YYYY
      const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (match) {
        const parsed = new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
        if (!isNaN(parsed.getTime())) {
          dateObj = parsed;
        }
      }
    }
  }

  // 3. Fallback: resolve from tender info if date is unparseable or relative text
  if (!dateObj || isNaN(dateObj.getTime())) {
    const rawDeadline = tenderInfo?.bidDeadline || (tenderInfo as any)?.bidSubmissionDeadline;
    let baseDate: Date;
    if (rawDeadline) {
      const parsedBase = new Date(rawDeadline);
      baseDate = !isNaN(parsedBase.getTime()) ? parsedBase : new Date(Date.now() + 18 * 86400000);
    } else {
      baseDate = new Date(Date.now() + 18 * 86400000);
    }

    const lowerEvent = String(eventName || '').toLowerCase();
    if (lowerEvent.includes('technical') || lowerEvent.includes('opening')) {
      dateObj = new Date(baseDate.getTime() + 86400000);
    } else if (lowerEvent.includes('financial')) {
      dateObj = new Date(baseDate.getTime() + 7 * 86400000);
    } else if (lowerEvent.includes('pre-bid') || lowerEvent.includes('clarification')) {
      dateObj = new Date(baseDate.getTime() - 5 * 86400000);
    } else {
      dateObj = baseDate;
    }
  }

  const now = Date.now();
  const isPast = dateObj.getTime() < now;
  const diffDays = Math.ceil((dateObj.getTime() - now) / (1000 * 60 * 60 * 24));
  const isUpcoming = !isPast && diffDays <= 7;

  let timeRemaining = '';
  if (isPast) {
    timeRemaining = 'Completed';
  } else if (diffDays === 0) {
    timeRemaining = 'Today';
  } else if (diffDays === 1) {
    timeRemaining = 'Tomorrow';
  } else {
    timeRemaining = `${diffDays} days remaining`;
  }

  let formatted = '';
  try {
    formatted = dateObj.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    formatted = dateObj.toDateString();
  }

  return { formatted, isPast, isUpcoming, timeRemaining };
}

const ANALYSIS_STEPS = [
  'Uploading document...',
  'Extracting text and tables...',
  'Identifying requirements...',
  'Analyzing financial criteria...',
  'Checking document checklist...',
  'Building bid strategy...',
  'Finalizing analysis...',
];

/* ─── Page Component ─── */

export default function BidAssistantPage() {
  const { id } = useParams();
  const tenderId = id as string;

  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressStep, setProgressStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [activeSection, setActiveSection] = useState('requirements');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Document preparation modal state
  const [preparingDoc, setPreparingDoc] = useState<ChecklistDoc | null>(null);
  const [prepareTab, setPrepareTab] = useState<'draft' | 'upload'>('draft');
  const [customDraftText, setCustomDraftText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [uploadedDocFile, setUploadedDocFile] = useState<File | null>(null);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Restore analysis data from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && tenderId) {
      try {
        const cached = sessionStorage.getItem(`tb_analysis_${tenderId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.checklist) {
            setAnalysisData(parsed);
          }
        }
      } catch {}
    }
  }, [tenderId]);

  // Persist analysisData to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && tenderId && analysisData) {
      try {
        sessionStorage.setItem(`tb_analysis_${tenderId}`, JSON.stringify(analysisData));
      } catch {}
    }
  }, [tenderId, analysisData]);

  // Subscription / plan state (from global store)
  const { planSlug, aiBidAssistant } = usePlanInfo();

  // Tender info for header
  const [tender, setTender] = useState<TenderInfo | null>(null);

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch tender details on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchTender() {
      try {
        const res = await api.get(`/tenders/${tenderId}`);
        if (!cancelled && res.data?.data) {
          const t = res.data.data.tender || res.data.data;
          setTender(t);
        }
      } catch {
        // Non-critical: header info is optional
      }
    }
    if (tenderId) fetchTender();
    return () => { cancelled = true; };
  }, [tenderId]);

  // Check bid assistant access (basic or advanced)
  const hasAccess = aiBidAssistant !== 'none';
  const showUpgradeBanner = !hasAccess;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  }, []);

  // Start simulated progress that slowly fills to ~90% while waiting for API
  const startProgress = useCallback(() => {
    setUploadProgress(0);
    setProgressStep(0);
    let current = 0;
    let step = 0;
    const stepInterval = Math.floor(30000 / ANALYSIS_STEPS.length); // ~4.3s per step
    const tickMs = 500;
    let elapsed = 0;

    progressIntervalRef.current = setInterval(() => {
      elapsed += tickMs;
      // Logarithmic progress that caps around 90%
      current = Math.min(90, 10 + 80 * (1 - Math.exp(-elapsed / 15000)));
      step = Math.min(ANALYSIS_STEPS.length - 1, Math.floor(elapsed / stepInterval));
      setUploadProgress(current);
      setProgressStep(step);
    }, tickMs);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    startProgress();

    try {
      // Clear old cached analysis from sessionStorage so new upload takes effect immediately
      if (typeof window !== 'undefined' && tenderId) {
        try {
          sessionStorage.removeItem(`tb_analysis_${tenderId}`);
        } catch {}
      }

      let fileExtractedText = '';
      try {
        fileExtractedText = await extractDocumentText(file);
      } catch (readErr) {
        console.warn('Text extraction note:', readErr);
      }

      // Extract real entities from the uploaded document
      const localEntities = extractDocumentEntities(fileExtractedText, file.name);

      const tenderContext = tender
        ? `Tender Title: ${tender.title}\nOrganization: ${tender.organization || 'Government Department'}\nEstimated Value: Rs. ${tender.estimatedValue || 0}\n`
        : '';

      const docContext = [
        `Tender Document File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        localEntities.gstin ? `Detected GSTIN: ${localEntities.gstin} (${localEntities.gstinState || ''})` : 'GSTIN: Not detected in file',
        localEntities.pan ? `Detected PAN: ${localEntities.pan}` : 'PAN: Not detected in file',
        localEntities.emd ? `Detected EMD: ${localEntities.emd}` : '',
        localEntities.turnover ? `Detected Turnover: ${localEntities.turnover}` : '',
        localEntities.tenderRef ? `Detected Tender Reference: ${localEntities.tenderRef}` : '',
        tenderContext,
        fileExtractedText ? `Extracted Content:\n${fileExtractedText}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
        .trim();

      let res: any;
      try {
        res = await api.post(`/bid-assistant/analyze/${tenderId}`, {
          tenderId,
          documentText: docContext,
        });
      } catch (err: any) {
        if (err?.response?.status === 404) {
          res = await api.post('/bid-assistant/analyze', {
            tenderId,
            documentText: docContext,
          });
        } else {
          throw err;
        }
      }

      stopProgress();
      setUploadProgress(100);

      if (res.data?.success && res.data?.data) {
        const raw = res.data.data;
        const rawEntities = raw.extracted_entities || {};

        const finalEntities = {
          gstin: rawEntities.gstin || localEntities.gstin,
          gstin_state: rawEntities.gstin_state || localEntities.gstinState,
          has_gstin: rawEntities.has_gstin ?? localEntities.hasGstin,
          pan: rawEntities.pan || localEntities.pan,
          has_pan: rawEntities.has_pan ?? localEntities.hasPan,
          emd: rawEntities.emd || localEntities.emd,
          turnover: rawEntities.turnover || localEntities.turnover,
          tender_ref: rawEntities.tender_ref || localEntities.tenderRef,
          deadline: rawEntities.deadline || localEntities.deadline,
          fileName: file.name,
        };

        // Merge raw requirements with document verification status
        let requirementsList: Requirement[] = raw.analysis?.requirements || raw.requirements || [];

        // If backend returned generic requirements, ensure GSTIN and PAN status reflect the actual document
        if (requirementsList.length === 0 || !requirementsList.some((r) => r.extractedValue)) {
          const updatedReqs: Requirement[] = [];

          if (finalEntities.has_gstin) {
            updatedReqs.push({
              type: 'registration',
              description: `Valid GSTIN verified from document: ${finalEntities.gstin} (${finalEntities.gstin_state || 'Verified State'})`,
              mandatory: true,
              status: 'verified',
              extractedValue: finalEntities.gstin || undefined,
            });
          } else {
            updatedReqs.push({
              type: 'registration',
              description: 'Valid GSTIN registration certificate mandatory — No GSTIN detected in uploaded document. Ensure Form GST REG-06 is attached.',
              mandatory: true,
              status: 'missing',
            });
          }

          if (finalEntities.has_pan) {
            updatedReqs.push({
              type: 'registration',
              description: `Permanent Account Number (PAN) verified: ${finalEntities.pan}`,
              mandatory: true,
              status: 'verified',
              extractedValue: finalEntities.pan || undefined,
            });
          } else {
            updatedReqs.push({
              type: 'registration',
              description: 'Permanent Account Number (PAN) copy mandatory — No 10-digit PAN detected in uploaded document.',
              mandatory: true,
              status: 'missing',
            });
          }

          // Add existing or standard requirements
          const otherReqs = requirementsList.filter((r) => r.type !== 'registration');
          if (otherReqs.length > 0) {
            updatedReqs.push(...otherReqs);
          } else {
            updatedReqs.push(
              {
                type: 'eligibility',
                description: finalEntities.tender_ref
                  ? `Tender Reference: ${finalEntities.tender_ref} — Bidder must be legally registered entity`
                  : 'Bidder must be a legally registered entity (Incorporation Certificate / Partnership Deed / MSME)',
                mandatory: true,
                status: finalEntities.tender_ref ? 'verified' : undefined,
              },
              {
                type: 'financial',
                description: finalEntities.turnover
                  ? `Minimum Annual Turnover Requirement: Rs. ${finalEntities.turnover} (Audited Balance Sheet certified by CA with ICAI UDIN)`
                  : 'Audited Balance Sheets & Profit and Loss statements for last 3 financial years certified by CA with ICAI UDIN',
                mandatory: true,
                status: finalEntities.turnover ? 'verified' : undefined,
                extractedValue: finalEntities.turnover || undefined,
              },
              {
                type: 'financial',
                description: finalEntities.emd
                  ? `Earnest Money Deposit (EMD): Rs. ${finalEntities.emd} (Bank Guarantee or MSME Exemption Certificate)`
                  : 'Earnest Money Deposit (EMD) Bank Guarantee from scheduled commercial bank or valid MSME/Udyam exemption certificate',
                mandatory: true,
                status: finalEntities.emd ? 'verified' : undefined,
                extractedValue: finalEntities.emd || undefined,
              },
              {
                type: 'experience',
                description: 'Past contract performance proof and client-certified completion certificates for similar scope of work in past 3-5 years',
                mandatory: true,
              }
            );
          }
          requirementsList = updatedReqs;
        }

        // Adjust document checklist to verify documents present in the uploaded file
        const checklist = raw.checklist || raw.documentChecklist || { matched: [], missing: [], recommendations: [] };
        const matchedDocs = [...(checklist.matched || [])];
        const missingDocs: ChecklistDoc[] = [];

        for (const doc of checklist.missing || []) {
          const docName = String(doc.document || (doc as any).name || '').toLowerCase();
          if (finalEntities.has_gstin && docName.includes('gst')) {
            matchedDocs.push({
              document: doc.document || 'GST Registration Certificate',
              status: 'available',
              notes: `Verified in uploaded document (${finalEntities.gstin})`,
            });
          } else if (finalEntities.has_pan && docName.includes('pan')) {
            matchedDocs.push({
              document: doc.document || 'PAN Card',
              status: 'available',
              notes: `Verified in uploaded document (${finalEntities.pan})`,
            });
          } else if (finalEntities.emd && (docName.includes('emd') || docName.includes('bank guarantee'))) {
            matchedDocs.push({
              document: doc.document || 'EMD / Bank Guarantee',
              status: 'available',
              notes: `Specified in uploaded document (Rs. ${finalEntities.emd})`,
            });
          } else {
            missingDocs.push(doc);
          }
        }

        const mapped: AnalysisData = {
          analysis: {
            requirements: requirementsList,
            documents_needed: raw.analysis?.documents_needed || raw.requiredDocuments || raw.documents_needed || [],
            important_dates: raw.analysis?.important_dates || raw.importantDates || raw.important_dates || [],
            submission_instructions: raw.analysis?.submission_instructions || raw.submissionInstructions || raw.submission_instructions || { mode: '', portal: '', steps: [] },
            financial_requirements: raw.analysis?.financial_requirements || raw.financialRequirements || raw.financial_requirements || {},
            technical_requirements: raw.analysis?.technical_requirements || raw.technicalRequirements || raw.technical_requirements || {
              experience: '',
              certifications: [],
              equipment: '',
              manpower: '',
            },
          },
          checklist: {
            matched: matchedDocs,
            missing: missingDocs,
            recommendations: checklist.recommendations || [],
          },
          strategy: raw.strategy || raw.bidStrategy || {
            suggested_bid_range: raw.bidStrategy?.range || { low: '', optimal: '', high: '', rationale: '' },
            key_strengths: raw.bidStrategy?.strengths || [],
            potential_risks: raw.bidStrategy?.risks || [],
            win_probability: raw.bidStrategy?.winProbability || { score: 0, label: 'Unknown', reasoning: '' },
            action_items: raw.bidStrategy?.actionItems || [],
          },
          extracted_entities: finalEntities,
        };
        setAnalysisData(mapped);
        if (raw.tender) {
          setTender(raw.tender);
        }
      } else {
        throw new Error(res.data?.error?.message || 'Analysis returned no data');
      }
    } catch (err: unknown) {
      stopProgress();
      setUploadProgress(0);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (err instanceof Error ? err.message : 'Failed to analyze tender. Please try again.');
      setError(msg);
      toast.error(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }, [file, tenderId, startProgress, stopProgress]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => stopProgress();
  }, [stopProgress]);

  const handleOpenPrepareModal = (doc: ChecklistDoc) => {
    try {
      const docName = doc.document || (doc as any).name || (typeof doc === 'string' ? doc : 'Required Document');
      setPreparingDoc(doc);
      setPrepareTab('draft');
      const draftInfo = getDraftTemplate(docName, tender);
      setCustomDraftText(draftInfo.template);
      setIsCopied(false);
      setUploadedDocFile(null);
      toast.info(`Opening preparation kit for "${docName}"`);
    } catch (err) {
      console.error('Error opening preparation kit:', err);
      setPreparingDoc(doc);
      setPrepareTab('draft');
      setCustomDraftText('Please prepare this document in accordance with the tender instructions.');
      setIsCopied(false);
      setUploadedDocFile(null);
    }
  };

  const handleQuickMarkReady = (doc: ChecklistDoc) => {
    const docName = doc.document || (doc as any).name || (typeof doc === 'string' ? doc : 'Required Document');
    setAnalysisData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        checklist: {
          ...prev.checklist,
          missing: prev.checklist.missing.filter((d) => (d.document || (d as any).name) !== docName),
          matched: [
            ...prev.checklist.matched,
            {
              document: docName,
              status: 'available',
              notes: 'Marked as prepared & verified for bid pack',
            },
          ],
        },
      };
    });
    toast.success(`"${docName}" marked as ready and added to your bid pack!`);
    if (preparingDoc) {
      const activeName = preparingDoc.document || (preparingDoc as any).name;
      if (activeName === docName) {
        setPreparingDoc(null);
        setUploadedDocFile(null);
      }
    }
  };

  const handleCopyDraft = async () => {
    if (!customDraftText) return;
    try {
      await navigator.clipboard.writeText(customDraftText);
      setIsCopied(true);
      toast.success('Draft request letter copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownloadDraft = () => {
    if (!preparingDoc || !customDraftText) return;
    const docName = preparingDoc.document || (preparingDoc as any).name || 'Document';
    const blob = new Blob([customDraftText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = docName.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${safeName}_Draft.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Draft letter downloaded as .txt!');
  };

  const handleMarkDocReady = () => {
    if (!preparingDoc) return;
    const docName = preparingDoc.document || (preparingDoc as any).name || 'Required Document';
    setAnalysisData((prev) => {
      if (!prev) return null;
      const note = uploadedDocFile
        ? `Uploaded: ${uploadedDocFile.name} (${(uploadedDocFile.size / 1024).toFixed(1)} KB)`
        : 'Document drafted and verified for submission';
      return {
        ...prev,
        checklist: {
          ...prev.checklist,
          missing: prev.checklist.missing.filter((d) => (d.document || (d as any).name) !== docName),
          matched: [
            ...prev.checklist.matched,
            {
              document: docName,
              status: 'available',
              notes: note,
            },
          ],
        },
      };
    });
    toast.success(`"${docName}" marked as ready and added to your bid pack!`);
    setPreparingDoc(null);
    setUploadedDocFile(null);
  };

  const sections = [
    { id: 'requirements', label: 'Requirements', icon: Target },
    { id: 'checklist', label: 'Document Checklist', icon: FileCheck },
    { id: 'dates', label: 'Important Dates', icon: CalendarDays },
    { id: 'submission', label: 'Submission', icon: Send },
    { id: 'financial', label: 'Financial', icon: IndianRupee },
    { id: 'technical', label: 'Technical', icon: Wrench },
    { id: 'strategy', label: 'Bid Strategy', icon: TrendingUp },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/tenders" className="hover:text-foreground">Tenders</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/tenders/${id}`} className="hover:text-foreground">Tender Detail</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Bid Assistant</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/tenders/${id}`}
          className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bid Document Assistant</h1>
          <p className="text-sm text-muted-foreground">
            {tender ? tender.title : 'AI-powered tender analysis and bid preparation guide'}
          </p>
        </div>
      </div>

      {/* Upgrade banner */}
      {showUpgradeBanner && (
        <div className="mb-6">
          <UpgradeBanner
            feature="AI Bid Assistant"
            requiredPlan="Professional"
            currentPlan={planSlug}
            variant="card"
          />
        </div>
      )}

      {/* Upload Section */}
      {hasAccess && !analysisData && (
        <div className="bg-card border border-border rounded-xl p-8 mb-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary-50 dark:bg-primary-950/30 mb-4">
              <FileText className="h-8 w-8 text-primary-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Upload Tender Document</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Upload the tender document (PDF) and our AI will extract all requirements,
              deadlines, and prepare a personalized bid strategy.
            </p>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer',
              isDragging
                ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                : file
                  ? 'border-accent-500 bg-accent-50/50 dark:bg-accent-950/20'
                  : 'border-border hover:border-primary-300 hover:bg-muted/50'
            )}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input
              id="file-upload"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-accent-500" />
                <div className="text-left">
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-accent-500" />
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-medium mb-1">Drag & drop your tender PDF here</p>
                <p className="text-sm text-muted-foreground">or click to browse files (PDF, max 10MB)</p>
              </>
            )}
          </div>

          {/* Upload Progress */}
          {isAnalyzing && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">{ANALYSIS_STEPS[progressStep]}</span>
                <span className="text-foreground font-medium">{Math.min(Math.round(uploadProgress), 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI is extracting requirements, dates, and financial details... This may take up to 30 seconds.
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !isAnalyzing && (
            <div className="mt-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Analysis Failed</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Analyze Button */}
          {file && !isAnalyzing && (
            <button
              onClick={handleAnalyze}
              className="mt-6 w-full py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Shield className="h-4 w-4" />
              Analyze Document with AI
            </button>
          )}
        </div>
      )}

      {/* Analysis Results */}
      {analysisData && (
        <div>
          {/* Section Tabs */}
          <div className="border-b border-border mb-6 overflow-x-auto">
            <div className="flex gap-0 min-w-max">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    activeSection === section.id
                      ? 'border-primary-500 text-primary-500'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <section.icon className="h-4 w-4" />
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {/* Requirements */}
          {activeSection === 'requirements' && (
            <div className="space-y-4">
              {/* Document Extracted Entities Banner */}
              {analysisData.extracted_entities && (
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary-500" />
                      <h4 className="text-sm font-semibold text-foreground">
                        Document Information & Compliance Check
                      </h4>
                    </div>
                    {file?.name && (
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-md text-muted-foreground font-mono">
                        {file.name}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {/* GSTIN Card */}
                    <div className={cn(
                      "p-3 rounded-lg border transition-all",
                      analysisData.extracted_entities.has_gstin
                        ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                        : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">GSTIN</span>
                        {analysisData.extracted_entities.has_gstin ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded">
                            <Check className="h-3 w-3" /> FOUND
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                            NOT FOUND
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        "text-xs font-mono font-semibold truncate",
                        analysisData.extracted_entities.has_gstin ? "text-emerald-900 dark:text-emerald-200" : "text-amber-900 dark:text-amber-200"
                      )}>
                        {analysisData.extracted_entities.gstin || 'No GSTIN in document'}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {analysisData.extracted_entities.gstin_state || 'Mandatory for bid submission'}
                      </p>
                    </div>

                    {/* PAN Card */}
                    <div className={cn(
                      "p-3 rounded-lg border transition-all",
                      analysisData.extracted_entities.has_pan
                        ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                        : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">PAN</span>
                        {analysisData.extracted_entities.has_pan ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded">
                            <Check className="h-3 w-3" /> FOUND
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                            NOT FOUND
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        "text-xs font-mono font-semibold truncate",
                        analysisData.extracted_entities.has_pan ? "text-emerald-900 dark:text-emerald-200" : "text-amber-900 dark:text-amber-200"
                      )}>
                        {analysisData.extracted_entities.pan || 'No PAN in document'}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {analysisData.extracted_entities.has_pan ? 'Income Tax verified format' : 'Mandatory tax identifier'}
                      </p>
                    </div>

                    {/* EMD Criteria */}
                    <div className="p-3 rounded-lg border bg-muted/30 border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">EMD / Deposit</span>
                        <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 px-1.5 py-0.5 rounded">
                          CRITERIA
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground truncate">
                        {analysisData.extracted_entities.emd ? `₹ ${analysisData.extracted_entities.emd}` : (tender?.emdAmount ? formatINR(tender.emdAmount) : 'As per NIT clauses')}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        Bank Guarantee / MSME waiver
                      </p>
                    </div>

                    {/* Turnover Criteria */}
                    <div className="p-3 rounded-lg border bg-muted/30 border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Turnover</span>
                        <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 px-1.5 py-0.5 rounded">
                          ANNUAL
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground truncate">
                        {analysisData.extracted_entities.turnover ? `₹ ${analysisData.extracted_entities.turnover}` : 'Last 3 FYs CA Certified'}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        ICAI UDIN Mandatory
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <h3 className="text-lg font-semibold text-foreground">Extracted Requirements</h3>
              <div className="grid gap-3">
                {analysisData.analysis.requirements.map((req, i) => (
                  <div
                    key={i}
                    className="bg-card border border-border rounded-xl p-4 flex items-start gap-3"
                  >
                    <div className={cn(
                      'mt-0.5 shrink-0 px-2 py-0.5 rounded text-xs font-medium',
                      req.type === 'eligibility' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      req.type === 'financial' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                      req.type === 'experience' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                      req.type === 'registration' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                      req.type === 'technical' && 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
                      req.type === 'other' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
                    )}>
                      {req.type}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{req.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {req.status === 'verified' && (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
                          <Check className="h-3 w-3" /> Verified
                        </span>
                      )}
                      {req.status === 'missing' && (
                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Action Needed
                        </span>
                      )}
                      {req.mandatory ? (
                        <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded">
                          Mandatory
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          Preferred
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Checklist */}
          {activeSection === 'checklist' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-foreground">Document Checklist</h3>

              {/* Matched Documents */}
              <div>
                <h4 className="text-sm font-medium text-accent-600 dark:text-accent-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Documents You Have ({analysisData.checklist.matched.length})
                </h4>
                {analysisData.checklist.matched.length === 0 ? (
                  <div className="bg-muted/30 border border-dashed border-border rounded-xl p-4 text-center">
                    <FileText className="h-6 w-6 text-muted-foreground mx-auto mb-1 opacity-50" />
                    <p className="text-xs font-semibold text-foreground">No Verified Documents on File</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      None of your company profile documents matched this tender. All required documents below are mandatory for bid submission.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {analysisData.checklist.matched.map((doc, i) => (
                      <div key={i} className="flex items-center gap-3 bg-accent-50/50 dark:bg-accent-950/20 border border-accent-200 dark:border-accent-800 rounded-lg p-3">
                        <CheckCircle2 className="h-5 w-5 text-accent-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{doc.document}</p>
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                              Verified on File
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{doc.notes}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Missing Documents */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Documents You Need (Mandatory: {analysisData.checklist.missing.length})
                  </h4>
                  <span className="text-[11px] font-medium text-red-500 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded border border-red-200/50 dark:border-red-800/50">
                    Mandatory for Bid Submission
                  </span>
                </div>
                {analysisData.checklist.missing.length === 0 ? (
                  <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3.5 text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">All required documents are prepared!</p>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                        Your bid document pack is 100% complete and ready for tender submission.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {analysisData.checklist.missing.map((doc, i) => {
                      const docName = doc.document || (doc as any).name || (typeof doc === 'string' ? doc : `Required Document ${i + 1}`);
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 hover:bg-red-50/80 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{docName}</p>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800 shrink-0">
                                MANDATORY
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{doc.deadline || 'Mandatory before bid submission'}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              id={`prepare-btn-${i}`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenPrepareModal(doc);
                              }}
                              className="px-3.5 py-1.5 text-xs font-semibold bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white rounded-lg transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer select-none"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Prepare
                            </button>
                            <button
                              type="button"
                              id={`mark-ready-btn-${i}`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleQuickMarkReady(doc);
                              }}
                              title="Mark document as ready & verified directly"
                              className="px-2.5 py-1.5 text-xs font-medium border border-border bg-card hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-500 text-muted-foreground hover:text-emerald-600 rounded-lg transition-colors flex items-center gap-1 cursor-pointer select-none"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Mark Ready</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recommendations */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Recommendations
                </h4>
                <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
                  {analysisData.checklist.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold text-sm mt-0.5">{i + 1}.</span>
                      <p className="text-sm text-foreground">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Important Dates */}
          {activeSection === 'dates' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Important Dates & Timeline</h3>
              <div className="relative">
                {analysisData.analysis.important_dates.map((dateItem, i) => {
                  const { formatted, isPast, isUpcoming, timeRemaining } = resolveTimelineDate(
                    dateItem.date,
                    tender,
                    dateItem.event
                  );

                  return (
                    <div key={i} className="flex items-start gap-4 mb-4 last:mb-0">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'h-3.5 w-3.5 rounded-full border-2 shrink-0 transition-colors',
                          isPast
                            ? 'bg-accent-500 border-accent-500 shadow-sm'
                            : isUpcoming
                              ? 'bg-amber-500 border-amber-500 shadow-sm'
                              : 'bg-primary-500 border-primary-500 shadow-sm'
                        )} />
                        {i < analysisData.analysis.important_dates.length - 1 && (
                          <div className="w-0.5 h-12 bg-border" />
                        )}
                      </div>
                      <div className={cn(
                        'flex-1 bg-card border rounded-lg p-4 -mt-1 transition-all',
                        isPast
                          ? 'border-accent-200 dark:border-accent-800'
                          : isUpcoming
                            ? 'border-amber-200 dark:border-amber-800 ring-1 ring-amber-500/10'
                            : 'border-border'
                      )}>
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-foreground text-sm">{dateItem.event}</p>
                          {isPast && (
                            <span className="text-xs bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400 px-2.5 py-0.5 rounded font-medium">
                              Completed
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2.5 py-0.5 rounded flex items-center gap-1 font-medium">
                              <AlertTriangle className="h-3 w-3" />
                              {timeRemaining}
                            </span>
                          )}
                          {!isPast && !isUpcoming && (
                            <span className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-2.5 py-0.5 rounded font-medium">
                              {timeRemaining}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary-500 shrink-0" />
                          <span>{formatted}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submission Instructions */}
          {activeSection === 'submission' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Submission Instructions</h3>
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Submission Mode</p>
                    <p className="text-sm font-medium text-foreground">{analysisData.analysis.submission_instructions.mode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Portal</p>
                    <a
                      href={analysisData.analysis.submission_instructions.portal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary-500 hover:text-primary-600"
                    >
                      {analysisData.analysis.submission_instructions.portal}
                    </a>
                  </div>
                </div>
                <h4 className="text-sm font-medium text-foreground mb-3">Steps to Submit</h4>
                <div className="space-y-3">
                  {analysisData.analysis.submission_instructions.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="shrink-0 h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <p className="text-sm text-foreground pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Financial Requirements */}
          {activeSection === 'financial' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Financial Requirements</h3>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {Object.entries(analysisData.analysis.financial_requirements).map(([key, value], i) => (
                  <div key={key} className={cn('flex justify-between py-3.5 px-5 text-sm', i > 0 && 'border-t border-border')}>
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-foreground text-right max-w-[60%]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical Requirements */}
          {activeSection === 'technical' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Technical Requirements</h3>
              <div className="grid gap-4">
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Experience Required</p>
                  <p className="text-sm font-medium text-foreground">{analysisData.analysis.technical_requirements.experience}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-2">Certifications</p>
                  <div className="flex flex-wrap gap-2">
                    {analysisData.analysis.technical_requirements.certifications.map((cert, i) => (
                      <span key={i} className="text-xs bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 px-2.5 py-1 rounded-full">
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Equipment</p>
                  <p className="text-sm font-medium text-foreground">{analysisData.analysis.technical_requirements.equipment}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Manpower</p>
                  <p className="text-sm font-medium text-foreground">{analysisData.analysis.technical_requirements.manpower}</p>
                </div>
              </div>
            </div>
          )}

          {/* Bid Strategy */}
          {activeSection === 'strategy' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-foreground">AI Bid Strategy</h3>

              {/* Win Probability */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Win Probability</h4>
                <div className="flex items-center gap-4 mb-3">
                  <div className="relative h-20 w-20">
                    <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        className="text-muted"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        className={cn(
                          analysisData.strategy.win_probability.score >= 70 ? 'text-accent-500' :
                          analysisData.strategy.win_probability.score >= 50 ? 'text-amber-500' : 'text-red-500'
                        )}
                        strokeWidth="3"
                        strokeDasharray={`${analysisData.strategy.win_probability.score}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-foreground">{analysisData.strategy.win_probability.score}%</span>
                    </div>
                  </div>
                  <div>
                    <span className={cn(
                      'text-sm font-semibold px-3 py-1 rounded-full',
                      analysisData.strategy.win_probability.score >= 70
                        ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400'
                        : analysisData.strategy.win_probability.score >= 50
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    )}>
                      {analysisData.strategy.win_probability.label}
                    </span>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md">{analysisData.strategy.win_probability.reasoning}</p>
                  </div>
                </div>
              </div>

              {/* Suggested Bid Range */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Suggested Bid Range</h4>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-xs text-muted-foreground">Aggressive</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{analysisData.strategy.suggested_bid_range.low}</p>
                  </div>
                  <div className="text-center p-3 bg-accent-50/50 dark:bg-accent-950/20 rounded-lg border-2 border-accent-500">
                    <p className="text-xs text-accent-600 dark:text-accent-400 font-medium">Optimal</p>
                    <p className="text-lg font-bold text-accent-600 dark:text-accent-400">{analysisData.strategy.suggested_bid_range.optimal}</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-muted-foreground">Conservative</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{analysisData.strategy.suggested_bid_range.high}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{analysisData.strategy.suggested_bid_range.rationale}</p>
              </div>

              {/* Strengths & Risks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-xl p-4">
                  <h4 className="text-sm font-medium text-accent-600 dark:text-accent-400 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Key Strengths
                  </h4>
                  <ul className="space-y-2">
                    {analysisData.strategy.key_strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-accent-500 shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Potential Risks
                  </h4>
                  <ul className="space-y-2">
                    {analysisData.strategy.potential_risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Items */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary-500" />
                  Recommended Action Items
                </h4>
                <div className="space-y-2">
                  {analysisData.strategy.action_items.map((action, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors">
                      <span className="shrink-0 h-5 w-5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-foreground">{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Re-analyze button */}
          <div className="mt-8 pt-6 border-t border-border">
            <button
              onClick={() => {
                setAnalysisData(null);
                setFile(null);
                setUploadProgress(0);
                setActiveSection('requirements');
                setError(null);
              }}
              className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Upload Another Document
            </button>
          </div>
        </div>
      )}

      {/* Document Preparation Modal via React Portal */}
      {mounted && preparingDoc && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          onClick={() => {
            setPreparingDoc(null);
            setUploadedDocFile(null);
          }}
        >
          <div
            className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">Prepare Document</h3>
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded uppercase tracking-wide',
                        preparingDoc.priority === 'high' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                        preparingDoc.priority === 'medium' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        preparingDoc.priority === 'low' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                      )}
                    >
                      {preparingDoc.priority || 'required'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {preparingDoc.document || (preparingDoc as any).name || 'Required Document'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreparingDoc(null);
                  setUploadedDocFile(null);
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-border px-5 gap-4 bg-muted/10">
              <button
                type="button"
                onClick={() => setPrepareTab('draft')}
                className={cn(
                  'py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer',
                  prepareTab === 'draft'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                Draft Request Letter &amp; Template
              </button>
              <button
                type="button"
                onClick={() => setPrepareTab('upload')}
                className={cn(
                  'py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer',
                  prepareTab === 'upload'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Document {uploadedDocFile && '(1 attached)'}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {prepareTab === 'draft' && (
                <div className="space-y-3">
                  <div className="bg-primary-50/50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800 rounded-xl p-3.5 text-xs text-foreground">
                    <div className="flex items-center gap-2 font-medium text-primary-700 dark:text-primary-300 mb-1">
                      <Sparkles className="h-4 w-4" />
                      <span>Formal Draft for {preparingDoc.document || (preparingDoc as any).name}</span>
                    </div>
                    <p className="text-muted-foreground">
                      Use this pre-formatted official letter, insert your company particulars, and submit it to the issuing bank, auditor, or authority. You can edit the text directly in the box below before copying or downloading.
                    </p>
                  </div>

                  <div className="relative">
                    <textarea
                      value={customDraftText}
                      onChange={(e) => setCustomDraftText(e.target.value)}
                      rows={11}
                      className="w-full text-xs font-mono p-3.5 rounded-xl border border-border bg-muted/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none leading-relaxed"
                      placeholder="Draft letter..."
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-[11px] text-muted-foreground">
                      Tip: Placeholders in [brackets] can be customized for your firm.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyDraft}
                        className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {isCopied ? 'Copied!' : 'Copy Letter'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadDraft}
                        className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download (.txt)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {prepareTab === 'upload' && (
                <div className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    Attach the signed copy, bank guarantee scan, or certified PDF of <strong className="text-foreground">{preparingDoc.document || (preparingDoc as any).name}</strong> to add directly to your tender bid submission pack.
                  </div>

                  <div
                    onClick={() => docFileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                      uploadedDocFile
                        ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                        : 'border-border hover:border-primary-500 hover:bg-muted/20'
                    )}
                  >
                    <input
                      ref={docFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setUploadedDocFile(f);
                      }}
                    />
                    {uploadedDocFile ? (
                      <div className="flex flex-col items-center">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full mb-2">
                          <Check className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">{uploadedDocFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(uploadedDocFile.size / 1024).toFixed(1)} KB &bull; Attached and ready
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedDocFile(null);
                          }}
                          className="mt-3 text-xs text-red-500 hover:underline cursor-pointer"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="p-3 bg-muted rounded-full mb-2 text-muted-foreground">
                          <Upload className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-foreground">Click to upload {preparingDoc.document || (preparingDoc as any).name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Supports PDF, DOCX, JPG, PNG (up to 25 MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20">
              <button
                type="button"
                onClick={() => {
                  setPreparingDoc(null);
                  setUploadedDocFile(null);
                }}
                className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkDocReady}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark as Ready &amp; Add to Bid Pack
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
