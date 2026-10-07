'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Share2,
  ExternalLink,
  Calendar,
  Building2,
  MapPin,
  IndianRupee,
  FileText,
  Clock,
  Download,
  ChevronRight,
  Shield,
  Trophy,
  AlertTriangle,
  Check,
  X as XIcon,
  Sparkles,
  Brain,
  Info,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Eye,
  Bell,
  Loader2,
} from 'lucide-react';
import { cn, formatCurrency, formatDate, getDeadlineInfo, getCategoryInfo } from '@/lib/utils';
import { FeatureGate } from '@/components/subscription';
import {
  useTenderDetail,
  useSimilarTenders,
  type TenderDetail,
  type TenderDocument,
} from '@/lib/hooks/use-tenders';

/* ═══════════════════════════════════════════════════════════════════════════
   NORMALIZATION

   GET /tenders/:id returns the Prisma tender (plus `documents` and `results`).
   A few things the UI used to show from mock data — organization type, tender
   fee, work completion period and an eligibility score/criteria breakdown —
   are not part of that response, so they render as explicit empty states
   rather than invented values.
   ═══════════════════════════════════════════════════════════════════════════ */

const NOT_SPECIFIED = 'Not specified';

function isValidDate(value?: string | null): boolean {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function formatDateSafe(value?: string | null, fallback = NOT_SPECIFIED): string {
  return isValidDate(value) ? formatDate(value as string) : fallback;
}

function formatDateTimeSafe(value?: string | null, fallback = NOT_SPECIFIED): string {
  if (!isValidDate(value)) return fallback;
  const date = new Date(value as string);
  const time = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${formatDate(date)}, ${time}`;
}

function formatAmount(value?: number | null, fallback = NOT_SPECIFIED): string {
  if (value == null || value <= 0) return fallback;
  return formatCurrency(value);
}

function formatFileSize(bytes?: number | null): string {
  if (bytes == null || bytes <= 0) return 'Size unknown';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function getDocumentKind(doc: TenderDocument): 'pdf' | 'xlsx' | 'zip' | 'other' {
  const raw = (doc.fileType || doc.name?.split('.').pop() || '').toLowerCase();
  if (raw.includes('pdf')) return 'pdf';
  if (raw.includes('xls') || raw.includes('sheet') || raw.includes('csv')) return 'xlsx';
  if (raw.includes('zip') || raw.includes('rar') || raw.includes('compress')) return 'zip';
  return 'other';
}

function normalizeTender(t: TenderDetail) {
  return {
    id: t.id,
    title: t.title || 'Untitled tender',
    organization: t.organization || NOT_SPECIFIED,
    department: t.department || NOT_SPECIFIED,
    organizationType: NOT_SPECIFIED, // not provided by the API
    category: t.category || '',
    state: t.state || NOT_SPECIFIED,
    district: t.district || null,
    city: t.city || null,
    estimatedValue: t.estimatedValue ?? null,
    emdAmount: t.emdAmount ?? null,
    tenderFee: null as number | null, // not provided by the API
    publishedDate: t.publishedDate ?? null,
    bidSubmissionDeadline: t.bidSubmissionDeadline ?? null,
    bidOpeningDate: t.bidOpeningDate ?? null,
    preBidMeeting: t.preBidMeetingDate ?? null,
    completionPeriod: NOT_SPECIFIED, // not provided by the API
    tenderType: t.tenderType || NOT_SPECIFIED,
    status: t.status || 'UNKNOWN',
    source: t.sourcePortal || NOT_SPECIFIED,
    sourceUrl: t.sourceUrl || null,
    refNumber: t.referenceNumber || NOT_SPECIFIED,
    description: t.description || null,
    aiSummary: t.aiSummary || null,
    aiEligibilityText: t.aiEligibilityText || null,
    aiKeywords: t.aiKeywords ?? [],
    minTurnover: t.minTurnover ?? null,
    minNetWorth: t.minNetWorth ?? null,
    minExperience: t.minExperience ?? null,
    requiredCertifications: t.requiredCertifications ?? [],
    reservedForMSME: Boolean(t.reservedForMSME),
    reservedForStartups: Boolean(t.reservedForStartups),
    emdExemptMSME: Boolean(t.emdExemptMSME),
    viewCount: t.viewCount ?? 0,
    documents: t.documents ?? [],
    results: t.results ?? [],
  };
}

type NormalizedTender = ReturnType<typeof normalizeTender>;

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function MetricCard({ icon: Icon, label, value, extra, accentColor }: { icon: React.ElementType; label: string; value: string; extra?: string; accentColor?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 lg:p-5 relative overflow-hidden">
      {accentColor && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: accentColor }} />}
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-overline text-muted-foreground uppercase tracking-widest text-[10px]">{label}</span>
      </div>
      <p className="text-heading-md font-mono text-foreground font-bold tracking-tight">{value}</p>
      {extra && <p className="text-caption text-muted-foreground mt-1">{extra}</p>}
    </div>
  );
}

function RequirementRow({ label, value, met }: { label: string; value: string; met?: boolean }) {
  return (
    <div className="flex gap-3 py-2 border-b border-border/50 last:border-0 items-start">
      <span className="text-body-sm text-muted-foreground w-40 shrink-0">{label}</span>
      <span className="text-body-sm text-foreground font-medium flex items-center gap-1.5">
        {met === true && <Check className="w-3.5 h-3.5 text-accent-500 shrink-0" />}
        {met === false && <XIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
        {value}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TENDER DETAIL PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TenderDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const tenderId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [activeTab, setActiveTab] = useState<'overview' | 'eligibility' | 'documents' | 'similar' | 'results'>('overview');
  const [isSaved, setIsSaved] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const { tender: data, isLoading, error } = useTenderDetail(tenderId);
  const { similar, isLoading: similarLoading } = useSimilarTenders(tenderId);

  const tender: NormalizedTender | null = useMemo(
    () => (data ? normalizeTender(data) : null),
    [data],
  );

  /* ── Loading ───────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        <p className="text-body-sm text-muted-foreground">Loading tender details…</p>
      </div>
    );
  }

  /* ── Error / not found ─────────────────────────────────────── */
  if (error || !tender) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <nav className="flex items-center gap-2 text-body-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/tenders" className="hover:text-foreground transition-colors">Tenders</Link>
        </nav>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-heading-md text-foreground font-display mb-2">Tender not available</h3>
          <p className="text-body-sm text-muted-foreground mb-5">
            {error || 'We could not load this tender. It may have been removed.'}
          </p>
          <Link href="/tenders" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to tenders
          </Link>
        </div>
      </div>
    );
  }

  const cat = getCategoryInfo(tender.category);
  const deadline = isValidDate(tender.bidSubmissionDeadline)
    ? getDeadlineInfo(tender.bidSubmissionDeadline as string)
    : null;
  const location = [tender.state, tender.district].filter(Boolean).join(', ');

  const keyRequirements: { label: string; value: string }[] = [
    { label: 'Minimum Turnover', value: formatAmount(tender.minTurnover) },
    { label: 'Minimum Net Worth', value: formatAmount(tender.minNetWorth) },
    {
      label: 'Minimum Experience',
      value: tender.minExperience != null
        ? `${tender.minExperience} ${tender.minExperience === 1 ? 'year' : 'years'}`
        : NOT_SPECIFIED,
    },
    {
      label: 'Required Certifications',
      value: tender.requiredCertifications.length ? tender.requiredCertifications.join(', ') : NOT_SPECIFIED,
    },
    {
      label: 'EMD',
      value: tender.emdAmount != null && tender.emdAmount > 0
        ? `${formatCurrency(tender.emdAmount)}${tender.emdExemptMSME ? ' (MSME exempt)' : ''}`
        : NOT_SPECIFIED,
    },
    { label: 'Tender Fee', value: NOT_SPECIFIED },
    { label: 'Pre-bid Meeting', value: formatDateTimeSafe(tender.preBidMeeting) },
    { label: 'Work Completion', value: tender.completionPeriod },
    { label: 'Bid Opening', value: formatDateTimeSafe(tender.bidOpeningDate) },
  ];

  const detailRows: [string, string][] = [
    ['Organization', tender.organization],
    ['Department', tender.department],
    ['Organization Type', tender.organizationType],
    ['State', tender.state],
    ['District', tender.district || NOT_SPECIFIED],
    ['City', tender.city || NOT_SPECIFIED],
    ['Category', tender.category || NOT_SPECIFIED],
    ['Tender Type', tender.tenderType],
    ['Published Date', formatDateSafe(tender.publishedDate)],
    ['Submission Deadline', formatDateTimeSafe(tender.bidSubmissionDeadline)],
    ['Bid Opening Date', formatDateTimeSafe(tender.bidOpeningDate)],
    ['Pre-bid Meeting', formatDateTimeSafe(tender.preBidMeeting)],
    ['Work Completion', tender.completionPeriod],
    ['Estimated Value', formatAmount(tender.estimatedValue, 'Refer Document')],
    ['EMD Amount', formatAmount(tender.emdAmount, 'Refer Document')],
    ['Tender Fee', tender.tenderFee != null ? `₹${tender.tenderFee.toLocaleString('en-IN')}` : NOT_SPECIFIED],
    ['Reference Number', tender.refNumber],
    ['Source Portal', tender.source],
  ];

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'eligibility' as const, label: 'Eligibility' },
    { key: 'documents' as const, label: `Documents (${tender.documents.length})` },
    { key: 'similar' as const, label: 'Similar Tenders' },
    { key: 'results' as const, label: 'Results' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-body-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/tenders" className="hover:text-foreground transition-colors">Tenders</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground truncate max-w-[200px]">
          {tender.title.length > 40 ? `${tender.title.slice(0, 40)}...` : tender.title}
        </span>
      </nav>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={cn(
            'text-[10px] px-2 py-0.5 rounded font-semibold',
            tender.status === 'ACTIVE' ? 'bg-accent-500/10 text-accent-500' : 'bg-muted text-muted-foreground'
          )}>
            {tender.status}
          </span>
          <span className="text-caption text-muted-foreground font-mono">{tender.refNumber}</span>
          <span className={cn('text-[10px] px-2 py-0.5 rounded font-semibold', cat.color, cat.bgColor)}>{cat.label}</span>
          <span className="text-caption text-muted-foreground">via {tender.source}</span>
        </div>

        <h1 className="text-display-sm md:text-display-md text-foreground font-display leading-tight mb-4">
          {tender.title}
        </h1>

        <div className="flex items-center gap-4 flex-wrap text-body-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" />{tender.organization}</span>
          <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{location || NOT_SPECIFIED}</span>
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />Published {formatDateSafe(tender.publishedDate)}</span>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={() => setIsSaved(!isSaved)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border',
              isSaved ? 'bg-primary-500/10 border-primary-500/30 text-primary-500' : 'bg-card border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {isSaved ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
            {isSaved ? 'Saved' : 'Save'}
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:text-foreground transition-all">
            <Share2 className="w-4 h-4" /> Share
          </button>
          {tender.sourceUrl && (
            <a href={tender.sourceUrl} target="_blank" rel="noopener" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:text-foreground transition-all">
              <ExternalLink className="w-4 h-4" /> View Original
            </a>
          )}
        </div>
      </div>

      {/* ── Metrics Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={IndianRupee} label="Estimated Value" value={formatCurrency(tender.estimatedValue)} accentColor="#FF6B35" />
        <MetricCard
          icon={Shield}
          label="EMD / Bid Security"
          value={formatCurrency(tender.emdAmount)}
          extra={tender.emdExemptMSME ? 'MSME Exempt' : undefined}
          accentColor="#00D4AA"
        />
        <MetricCard
          icon={Clock}
          label="Submission Deadline"
          value={formatDateSafe(tender.bidSubmissionDeadline)}
          extra={deadline?.text}
          accentColor={deadline?.urgency === 'critical' ? '#EF4444' : deadline?.urgency === 'warning' ? '#F59E0B' : '#22C55E'}
        />
        <MetricCard icon={Sparkles} label="AI Eligibility" value="—" extra="Not available" />
      </div>

      {/* ── Tab Navigation ────────────────────────────────────────── */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px',
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────── */}

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* AI Summary */}
          {tender.aiSummary && (
            <div className="bg-accent-500/5 border border-accent-500/20 rounded-xl p-5 flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center shrink-0">
                <Brain className="w-5 h-5 text-accent-500" />
              </div>
              <div>
                <h3 className="text-heading-sm text-foreground font-display mb-1.5">AI Summary</h3>
                <p className="text-body-sm text-muted-foreground leading-relaxed">{tender.aiSummary}</p>
                <p className="text-caption text-muted-foreground/60 mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Generated by AI. May not be 100% accurate.
                </p>
              </div>
            </div>
          )}

          {/* Key Requirements */}
          <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
            <h3 className="text-heading-sm text-foreground font-display mb-4">Key Requirements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {keyRequirements.map((req) => (
                <div key={req.label} className="flex gap-3 py-2 border-b border-border/50 last:border-0">
                  <span className="text-body-sm text-muted-foreground w-40 shrink-0">{req.label}</span>
                  <span className="text-body-sm text-foreground font-medium">{req.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Full Details Table */}
          <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
            <h3 className="text-heading-sm text-foreground font-display mb-4">Full Details</h3>
            <div className="divide-y divide-border">
              {detailRows.map(([label, value], i) => (
                <div key={label} className={cn('flex gap-4 py-3', i % 2 === 0 && 'bg-muted/20 -mx-5 px-5 lg:-mx-6 lg:px-6')}>
                  <span className="text-body-sm text-muted-foreground w-44 shrink-0">{label}</span>
                  <span className="text-body-sm text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
            <h3 className="text-heading-sm text-foreground font-display mb-4">Description</h3>
            {tender.description ? (
              <>
                <div className={cn('text-body-sm text-muted-foreground leading-relaxed whitespace-pre-line', !descExpanded && 'line-clamp-6')}>
                  {tender.description}
                </div>
                {tender.description.length > 320 && (
                  <button onClick={() => setDescExpanded(!descExpanded)} className="mt-3 text-body-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1 transition-colors">
                    {descExpanded ? 'Show less' : 'Read more'}
                    {descExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
              </>
            ) : (
              <p className="text-body-sm text-muted-foreground">No description available for this tender.</p>
            )}
          </div>

          {/* Source link */}
          {tender.sourceUrl && (
            <a href={tender.sourceUrl} target="_blank" rel="noopener" className="flex items-center gap-2 text-body-sm text-primary-500 hover:text-primary-600 font-medium transition-colors">
              View this tender on {tender.source} <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* ELIGIBILITY */}
      {activeTab === 'eligibility' && (
        <div className="space-y-6">
          {/* No eligibility score in the tender detail response */}
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-heading-md text-foreground font-display mb-2">Eligibility check not available</h3>
            <p className="text-body-sm text-muted-foreground">
              No eligibility score or criteria-by-criteria comparison against your profile is available for this
              tender yet. The requirements published with the tender are listed below.
            </p>
          </div>

          {/* Stated requirements — straight from the tender record */}
          <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
            <h3 className="text-heading-sm text-foreground font-display mb-1">Stated Requirements</h3>
            <p className="text-caption text-muted-foreground mb-5">As published with this tender</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <RequirementRow label="Minimum Turnover" value={formatAmount(tender.minTurnover)} />
              <RequirementRow label="Minimum Net Worth" value={formatAmount(tender.minNetWorth)} />
              <RequirementRow
                label="Minimum Experience"
                value={tender.minExperience != null
                  ? `${tender.minExperience} ${tender.minExperience === 1 ? 'year' : 'years'}`
                  : NOT_SPECIFIED}
              />
              <RequirementRow
                label="Certifications"
                value={tender.requiredCertifications.length ? tender.requiredCertifications.join(', ') : NOT_SPECIFIED}
              />
              <RequirementRow label="Reserved for MSME" value={tender.reservedForMSME ? 'Yes' : 'No'} met={tender.reservedForMSME} />
              <RequirementRow label="Reserved for Startups" value={tender.reservedForStartups ? 'Yes' : 'No'} met={tender.reservedForStartups} />
              <RequirementRow label="EMD Exempt for MSME" value={tender.emdExemptMSME ? 'Yes' : 'No'} met={tender.emdExemptMSME} />
              <RequirementRow label="EMD / Bid Security" value={formatAmount(tender.emdAmount, 'Refer Document')} />
            </div>
          </div>

          {/* AI eligibility notes, when the tender has them */}
          {tender.aiEligibilityText && (
            <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
              <h3 className="text-heading-sm text-foreground font-display mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" /> Eligibility Notes
              </h3>
              <p className="text-body-sm text-muted-foreground leading-relaxed whitespace-pre-line">{tender.aiEligibilityText}</p>
              <p className="text-caption text-muted-foreground/60 mt-3 flex items-center gap-1">
                <Info className="w-3 h-3" /> Extracted by AI. Always confirm against the tender document.
              </p>
            </div>
          )}
        </div>
      )}

      {/* DOCUMENTS */}
      {activeTab === 'documents' && (
        <FeatureGate feature="documentDownload" fallbackVariant="card">
        <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-heading-sm text-foreground font-display">Documents ({tender.documents.length})</h3>
            {tender.documents.length > 0 && (
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors">
                <Download className="w-4 h-4" /> Download All
              </button>
            )}
          </div>
          {tender.documents.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-body-sm text-muted-foreground">
                No documents have been attached to this tender yet.
              </p>
              {tender.sourceUrl && (
                <a href={tender.sourceUrl} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1.5 text-body-sm text-primary-500 hover:text-primary-600 font-medium transition-colors">
                  Check the source portal <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tender.documents.map((doc) => {
                const kind = getDocumentKind(doc);
                const iconColor = kind === 'pdf' ? 'text-red-500' : kind === 'xlsx' ? 'text-green-500' : kind === 'zip' ? 'text-amber-500' : 'text-blue-500';
                return (
                  <div key={doc.id} className="flex items-center gap-4 py-3.5 group">
                    <FileText className={cn('w-5 h-5 shrink-0', iconColor)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-foreground font-medium truncate">{doc.name}</p>
                      <p className="text-caption text-muted-foreground">{formatFileSize(doc.fileSize)}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <a href={doc.fileUrl} target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> View
                      </a>
                      <a href={doc.fileUrl} download className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-500 hover:bg-primary-500/15 transition-colors flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </FeatureGate>
      )}

      {/* SIMILAR TENDERS */}
      {activeTab === 'similar' && (
        <div className="space-y-3">
          <p className="text-body-sm text-muted-foreground mb-4">
            Based on: similar title, same organization, same category
          </p>
          {similarLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-body-sm">Finding similar tenders…</span>
            </div>
          ) : similar.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-body-sm text-muted-foreground">No similar tenders found right now.</p>
            </div>
          ) : (
            similar.map((t) => (
              <Link
                key={t.id}
                href={`/tenders/${t.id}`}
                className="block bg-card border border-border rounded-xl p-5 hover:border-border/80 hover:shadow-sm transition-all"
              >
                <p className="text-body-md font-medium text-foreground hover:text-primary-500 transition-colors mb-1.5">{t.title}</p>
                <div className="flex items-center gap-4 text-body-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{t.organization || NOT_SPECIFIED}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{t.state || NOT_SPECIFIED}</span>
                  <span className="font-mono font-medium text-foreground">{formatCurrency(t.estimatedValue)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* RESULTS */}
      {activeTab === 'results' && (
        tender.results.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-heading-md text-foreground font-display mb-2">Result not yet available</h3>
            <p className="text-body-sm text-muted-foreground mb-5">
              {tender.status === 'ACTIVE'
                ? 'This tender is still active. Results will be published after bid evaluation.'
                : 'No result has been published for this tender yet.'}
            </p>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors">
              <Bell className="w-4 h-4" /> Notify me when result is published
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tender.results.map((r) => (
              <div key={r.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <Trophy className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md font-medium text-foreground">{r.winnerName}</p>
                    {r.winnerCompany && <p className="text-body-sm text-muted-foreground">{r.winnerCompany}</p>}
                    <div className="flex items-center gap-4 flex-wrap text-body-sm text-muted-foreground mt-2">
                      <span className="font-mono font-medium text-foreground">{formatAmount(r.awardedValue, 'Value not disclosed')}</span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Awarded {formatDateSafe(r.awardedDate, 'date not available')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
