'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';
import { usePlanInfo } from '@/lib/hooks/use-feature-gate';
import { UpgradeBanner } from '@/components/subscription';

/* ─── Indian Number Formatting ─── */

function formatINR(value: number | undefined | null): string {
  if (!value) return 'Not specified';
  if (value >= 10000000) return `\u20b9${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `\u20b9${(value / 100000).toFixed(2)} L`;
  return `\u20b9${value.toLocaleString('en-IN')}`;
}

/* ─── Types ─── */

interface Requirement {
  type: string;
  description: string;
  mandatory: boolean;
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
      const res = await api.post('/bid-assistant/analyze', { tenderId });
      stopProgress();
      setUploadProgress(100);

      if (res.data?.success && res.data?.data) {
        // The API may return data nested differently; normalize it
        const raw = res.data.data;
        const mapped: AnalysisData = {
          analysis: raw.analysis || {
            requirements: raw.requirements || [],
            documents_needed: raw.requiredDocuments || raw.documents_needed || [],
            important_dates: raw.importantDates || raw.important_dates || [],
            submission_instructions: raw.submissionInstructions || raw.submission_instructions || { mode: '', portal: '', steps: [] },
            financial_requirements: raw.financialRequirements || raw.financial_requirements || {},
            technical_requirements: raw.technicalRequirements || raw.technical_requirements || {
              experience: '',
              certifications: [],
              equipment: '',
              manpower: '',
            },
          },
          checklist: raw.checklist || raw.documentChecklist || {
            matched: [],
            missing: [],
            recommendations: [],
          },
          strategy: raw.strategy || raw.bidStrategy || {
            suggested_bid_range: raw.bidStrategy?.range || { low: '', optimal: '', high: '', rationale: '' },
            key_strengths: raw.bidStrategy?.strengths || [],
            potential_risks: raw.bidStrategy?.risks || [],
            win_probability: raw.bidStrategy?.winProbability || { score: 0, label: 'Unknown', reasoning: '' },
            action_items: raw.bidStrategy?.actionItems || [],
          },
        };
        setAnalysisData(mapped);
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
                    {req.mandatory ? (
                      <span className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded">
                        Mandatory
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        Preferred
                      </span>
                    )}
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
                <div className="space-y-2">
                  {analysisData.checklist.matched.map((doc, i) => (
                    <div key={i} className="flex items-center gap-3 bg-accent-50/50 dark:bg-accent-950/20 border border-accent-200 dark:border-accent-800 rounded-lg p-3">
                      <CheckCircle2 className="h-5 w-5 text-accent-500 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{doc.document}</p>
                        <p className="text-xs text-muted-foreground">{doc.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Missing Documents */}
              <div>
                <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Documents You Need ({analysisData.checklist.missing.length})
                </h4>
                <div className="space-y-2">
                  {analysisData.checklist.missing.map((doc, i) => (
                    <div key={i} className="flex items-center gap-3 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{doc.document}</p>
                        <p className="text-xs text-muted-foreground">{doc.deadline}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded',
                          doc.priority === 'high' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                          doc.priority === 'medium' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                          doc.priority === 'low' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                        )}>
                          {doc.priority}
                        </span>
                        <button className="px-3 py-1 text-xs font-medium bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors">
                          Prepare
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
                  const dateObj = new Date(dateItem.date);
                  const isPast = dateObj < new Date();
                  const isUpcoming = !isPast && dateObj.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
                  return (
                    <div key={i} className="flex items-start gap-4 mb-4 last:mb-0">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'h-3 w-3 rounded-full border-2 shrink-0',
                          isPast
                            ? 'bg-accent-500 border-accent-500'
                            : isUpcoming
                              ? 'bg-amber-500 border-amber-500'
                              : 'bg-white dark:bg-gray-900 border-muted-foreground'
                        )} />
                        {i < analysisData.analysis.important_dates.length - 1 && (
                          <div className="w-0.5 h-12 bg-border" />
                        )}
                      </div>
                      <div className={cn(
                        'flex-1 bg-card border rounded-lg p-4 -mt-1',
                        isPast ? 'border-accent-200 dark:border-accent-800' : isUpcoming ? 'border-amber-200 dark:border-amber-800' : 'border-border'
                      )}>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-foreground text-sm">{dateItem.event}</p>
                          {isPast && (
                            <span className="text-xs bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400 px-2 py-0.5 rounded">
                              Completed
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Upcoming
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {dateObj.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
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
    </div>
  );
}
