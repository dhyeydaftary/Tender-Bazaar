'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
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
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';
import { cn, formatCurrency, formatDate, getDeadlineInfo, getCategoryInfo } from '@/lib/utils';
import { FeatureGate } from '@/components/subscription';
import {
  useTenderDetail,
  useSimilarTenders,
  useSavedTenders,
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

/**
 * Only allow http(s) links out of the app.
 *
 * `sourceUrl` and document `fileUrl` come from scraped portals, so they are
 * untrusted input rendered straight into an `href`. Without this a stored
 * `javascript:`/`data:` value would execute in the user's session on click.
 * Anything that is not a parseable absolute http(s) URL returns null, and the
 * caller renders an explanatory state instead of a broken or unsafe link.
 */
function safeExternalUrl(value?: string | null): string | null {
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null; // relative or malformed
  }
  return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
}

/**
 * True when the URL only reaches the portal's front page, with no path or
 * query identifying this tender.
 */
function isPortalRootOnly(url: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (u.pathname === '' || u.pathname === '/') && u.search === '' && u.hash === '';
  } catch {
    return false;
  }
}

export type SourceLinkKind =
  | 'tender-page'    // opens this specific tender
  | 'bid-schedules'  // a GeM page specific to this bid, but not the notice
  | 'portal-listing' // a real listing/search page, not this tender
  | 'portal-root';   // the portal's front page only

/**
 * Describe what a stored `sourceUrl` actually opens.
 *
 * A link is not "View Original" just because it is a valid https URL. Verified
 * against the live portals:
 *
 *   bidplus.gem.gov.in/all-bids            -> GeM's public bid listing (HTML)
 *   bidplus.gem.gov.in/list-ra-schedules/x -> HTML page for that specific bid
 *   eprocure.gov.in/eprocure/app           -> eProcure's generic entry point
 *   <host>/ (no path)                      -> portal front page
 *
 * GeM's PDF endpoints are no longer stored here — they are TenderDocuments —
 * but they are classified anyway so any record predating the backfill is still
 * labelled honestly rather than advertised as the tender page.
 */
function classifySourceLink(url: string | null): { kind: SourceLinkKind; label: string } {
  if (!url) return { kind: 'portal-root', label: 'Source unavailable' };

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { kind: 'portal-root', label: 'Source unavailable' };
  }

  const host = u.host.toLowerCase();
  const path = u.pathname.replace(/\/+$/, '');

  if (host === 'bidplus.gem.gov.in') {
    if (path === '/all-bids') return { kind: 'portal-listing', label: 'Open GeM Portal' };
    if (path.startsWith('/list-ra-schedules')) {
      return { kind: 'bid-schedules', label: 'View RA Schedules on GeM' };
    }
    // A PDF endpoint stored before the backfill: say so rather than call it a page.
    if (/^\/(showbidDocument|showradocumentPdf|showdirectradocumentPdf)/.test(path)) {
      return { kind: 'portal-listing', label: 'Download GeM Bid Document (PDF)' };
    }
  }

  if (host === 'eprocure.gov.in' && (path === '/eprocure/app' || path === '/eprocure')) {
    return { kind: 'portal-listing', label: 'Open eProcure Portal' };
  }

  if (isPortalRootOnly(url)) return { kind: 'portal-root', label: 'Open Source Portal' };

  return { kind: 'tender-page', label: 'View Original' };
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

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'eligibility' | 'documents' | 'similar' | 'results'>('overview');
  const [descExpanded, setDescExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { tender: data, isLoading, error } = useTenderDetail(tenderId);
  const { similar, isLoading: similarLoading } = useSimilarTenders(tenderId);

  // Real persistence. `isSaved` used to be local component state toggled by the
  // button, so Save reported success without storing anything: the state was
  // lost on refresh and an already-saved tender always rendered as unsaved.
  // This hook hydrates from GET /saved and reconciles 409/404 with the server.
  const { saved: savedIds, toggleSave, error: saveError } = useSavedTenders();
  const isSaved = tenderId ? savedIds.has(tenderId) : false;

  const [eligibilityCheck, setEligibilityCheck] = useState<any>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [loadingEligibility, setLoadingEligibility] = useState(false);

  useEffect(() => {
    if (!tenderId) return;
    let active = true;
    setLoadingEligibility(true);
    api
      .get(`/eligibility/tender/${tenderId}`)
      .then((res) => {
        if (!active) return;
        setEligibilityCheck(res.data?.data || null);
      })
      .catch(() => {
        if (!active) return;
        setEligibilityCheck(null);
      })
      .finally(() => {
        if (active) setLoadingEligibility(false);
      });

    return () => {
      active = false;
    };
  }, [tenderId]);

  const handleRunEligibilityCheck = async () => {
    if (!tenderId || checkingEligibility) return;
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      toast.error('Please sign in to check eligibility.');
      router.push(`/login?redirect=${encodeURIComponent(`/tenders/${tenderId}`)}`);
      return;
    }
    setCheckingEligibility(true);
    try {
      const res = await api.post('/eligibility', { tenderId });
      const check = res.data?.data?.eligibilityCheck || res.data?.data;
      setEligibilityCheck(check);
      toast.success('AI eligibility evaluation complete!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to check eligibility');
    } finally {
      setCheckingEligibility(false);
    }
  };

  // Reset per-tender view state when navigating straight from one tender to
  // another (the Similar cards do exactly that): without this the new tender
  // inherited the previous one's open tab and expanded description.
  useEffect(() => {
    setActiveTab('overview');
    setDescExpanded(false);
  }, [tenderId]);

  // Surface persistence failures instead of leaving the button silently wrong.
  useEffect(() => {
    if (saveError) toast.error(saveError);
  }, [saveError]);

  const handleToggleSave = async () => {
    if (!tenderId || isSaving) return;

    // Saving requires an account. Send the user to login with a return path
    // rather than optimistically showing "Saved" for an anonymous visitor.
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      toast.error('Please sign in to save tenders.');
      router.push(`/login?redirect=${encodeURIComponent(`/tenders/${tenderId}`)}`);
      return;
    }

    const wasSaved = isSaved;
    setIsSaving(true);
    try {
      await toggleSave(tenderId);
      toast.success(wasSaved ? 'Removed from saved tenders' : 'Saved to your tenders');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!tenderId) return;
    // Canonical app route for this tender, resolved against the real origin.
    const url = new URL(`/tenders/${tenderId}`, window.location.origin).toString();
    const title = tender?.title || 'Tender on TenderBazaar';

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return; // the OS sheet confirms; a toast here would double up
      } catch (err) {
        // A cancelled share sheet rejects with AbortError. That is the user
        // declining, not a failure, so stay silent and do not fall through to
        // the clipboard.
        if ((err as Error)?.name === 'AbortError') return;
        // Any other share failure falls through to the clipboard below.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    } catch {
      // Clipboard access is blocked outside a secure context or without
      // permission. Report it honestly and show the link so it can be copied
      // by hand, rather than claiming success.
      toast.error('Could not copy automatically', { description: url });
    }
  };

  const tender: NormalizedTender | null = useMemo(
    () => (data ? normalizeTender(data) : null),
    [data],
  );

  useEffect(() => {
    if (tenderId && data) {
      try {
        const raw = localStorage.getItem('tb_user_viewed_tenders');
        const list: Array<{ id: string; timestamp: number; category?: string }> = raw ? JSON.parse(raw) : [];
        const now = Date.now();
        const recent = list.find((v) => v.id === tenderId && now - v.timestamp < 60000);
        if (!recent) {
          list.push({ id: tenderId, timestamp: now, category: data.category });
          localStorage.setItem('tb_user_viewed_tenders', JSON.stringify(list.slice(-500)));
        }
      } catch {}
    }
  }, [tenderId, data]);

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
  // Validated once and reused by every outbound link on the page.
  const sourceUrl = safeExternalUrl(tender.sourceUrl);
  // What the stored link actually opens, so every label matches reality.
  const sourceLink = classifySourceLink(sourceUrl);

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
            onClick={handleToggleSave}
            disabled={isSaving}
            aria-pressed={isSaved}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border disabled:opacity-60 disabled:cursor-not-allowed',
              isSaved ? 'bg-primary-500/10 border-primary-500/30 text-primary-500' : 'bg-card border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSaved ? (
              <BookmarkCheck className="w-4 h-4 fill-current" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
            {isSaved ? 'Saved' : 'Save'}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:text-foreground transition-all"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:text-foreground transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              {sourceLink.label}
            </a>
          ) : (
            // Rendered disabled rather than hidden, so it is clear the source
            // link is missing/unusable for this record instead of the button
            // silently disappearing.
            <span
              title="No usable source link is recorded for this tender"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground/50 cursor-not-allowed"
            >
              <ExternalLink className="w-4 h-4" /> Source unavailable
            </span>
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
        <MetricCard
          icon={Sparkles}
          label="AI Eligibility"
          value={
            eligibilityCheck
              ? `${Math.round(eligibilityCheck.score)}%`
              : loadingEligibility
              ? '...'
              : 'Not Checked'
          }
          extra={
            eligibilityCheck
              ? eligibilityCheck.isEligible
                ? 'Eligible'
                : 'Needs Review'
              : 'Check Now'
          }
          accentColor={
            eligibilityCheck
              ? eligibilityCheck.isEligible
                ? '#22C55E'
                : '#F59E0B'
              : '#00D4AA'
          }
        />
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

          {/* Source link at the foot of the overview. Same validated URL as the
              View Original button in the header, so the two can never disagree
              or point at different tenders. */}
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-body-sm text-primary-500 hover:text-primary-600 font-medium transition-colors"
            >
              {sourceLink.kind === 'tender-page'
                ? `View this tender on ${tender.source}`
                : sourceLink.kind === 'bid-schedules'
                  ? `${sourceLink.label} (reverse-auction schedules for this bid)`
                  : `${sourceLink.label} — no direct link to this tender was recorded`}{' '}
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <p className="text-caption text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              No usable source link is recorded for this tender.
            </p>
          )}
        </div>
      )}

      {/* ELIGIBILITY */}
      {activeTab === 'eligibility' && (
        <div className="space-y-6">
          {eligibilityCheck ? (
            <>
              {/* AI Score & Eligibility Summary */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-16 h-16 rounded-2xl flex items-center justify-center font-display font-bold text-2xl border',
                        eligibilityCheck.isEligible
                          ? 'bg-green-500/10 border-green-500/30 text-green-500'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                      )}
                    >
                      {Math.round(eligibilityCheck.score)}%
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-heading-sm font-display text-foreground">
                          {eligibilityCheck.isEligible ? 'Eligible to Bid' : 'Requirements Need Review'}
                        </h3>
                        <span
                          className={cn(
                            'px-2.5 py-0.5 rounded-full text-caption font-semibold uppercase tracking-wider border',
                            eligibilityCheck.isEligible
                              ? 'bg-green-500/15 text-green-500 border-green-500/30'
                              : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                          )}
                        >
                          {eligibilityCheck.isEligible ? 'Passed' : 'Partial Match'}
                        </span>
                      </div>
                      <p className="text-body-sm text-muted-foreground mt-1">
                        AI evaluation based on your company profile and tender requirements
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRunEligibilityCheck}
                    disabled={checkingEligibility}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-caption font-semibold border border-border transition-colors disabled:opacity-50"
                  >
                    {checkingEligibility ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Re-evaluate
                  </button>
                </div>
              </div>

              {/* Criteria Breakdown */}
              {Array.isArray(eligibilityCheck.criteria) && eligibilityCheck.criteria.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5 lg:p-6 space-y-3">
                  <h3 className="text-heading-sm font-display text-foreground mb-4">Criteria Evaluation</h3>
                  <div className="space-y-3">
                    {eligibilityCheck.criteria.map((crit: any, idx: number) => {
                      const status = (crit.status || '').toLowerCase();
                      const isPass = status === 'pass' || status === 'met';
                      const isPartial = status === 'partial' || status === 'partially_met';
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-background/50"
                        >
                          <div className="mt-0.5 shrink-0">
                            {isPass ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : isPartial ? (
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                            ) : (
                              <XIcon className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-body-sm font-semibold text-foreground">{crit.name}</p>
                              <span
                                className={cn(
                                  'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border',
                                  isPass
                                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                    : isPartial
                                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                                )}
                              >
                                {isPass ? 'Met' : isPartial ? 'Partial' : 'Not Met'}
                              </span>
                            </div>
                            {crit.detail && (
                              <p className="text-caption text-muted-foreground mt-1 leading-relaxed">
                                {crit.detail}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {Array.isArray(eligibilityCheck.suggestions) && eligibilityCheck.suggestions.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
                  <h3 className="text-heading-sm font-display text-foreground mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" /> AI Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {eligibilityCheck.suggestions.map((sug: string, idx: number) => (
                      <li key={idx} className="text-body-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary-500 font-bold">•</span>
                        <span>{sug}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mx-auto mb-4 text-primary-500">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-heading-md text-foreground font-display mb-2">Check Your Eligibility with AI</h3>
              <p className="text-body-sm text-muted-foreground max-w-lg mx-auto mb-6">
                Evaluate your company profile against this tender's qualification criteria, turnover, experience,
                and certifications to see your match score.
              </p>
              <button
                onClick={handleRunEligibilityCheck}
                disabled={checkingEligibility}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-body-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-primary-500/25"
              >
                {checkingEligibility ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Evaluating Requirements...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Run AI Eligibility Check
                  </>
                )}
              </button>
            </div>
          )}

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
            {/* "Download All" was a button with no click handler, and there is
                no bulk-download endpoint behind it, so it advertised a
                capability that does not exist. Removed rather than left inert;
                the per-document actions below are the real ones. */}
          </div>
          {tender.documents.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-body-sm text-muted-foreground">
                No documents have been attached to this tender yet.
              </p>
              {sourceUrl && (
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-body-sm text-primary-500 hover:text-primary-600 font-medium transition-colors">
                  Check the source portal <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tender.documents.map((doc) => {
                const kind = getDocumentKind(doc);
                const docUrl = safeExternalUrl(doc.fileUrl);
                const iconColor = kind === 'pdf' ? 'text-red-500' : kind === 'xlsx' ? 'text-green-500' : kind === 'zip' ? 'text-amber-500' : 'text-blue-500';
                return (
                  <div key={doc.id} className="flex items-center gap-4 py-3.5 group">
                    <FileText className={cn('w-5 h-5 shrink-0', iconColor)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-foreground font-medium truncate">{doc.name}</p>
                      <p className="text-caption text-muted-foreground">{formatFileSize(doc.fileSize)}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {/* `fileUrl` is ingested from the source portal, so it
                          gets the same scheme validation as the source link. An
                          unusable value shows as such instead of rendering a
                          link that fails or runs a non-http scheme. */}
                      {docUrl ? (
                        <>
                          <a href={docUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" /> View
                          </a>
                          <a href={docUrl} download className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-500 hover:bg-primary-500/15 transition-colors flex items-center gap-1.5">
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        </>
                      ) : (
                        <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground/60" title="This document has no usable download link recorded">
                          Link unavailable
                        </span>
                      )}
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
            {/* Originally a button with no click handler. Per-tender result
                alerts genuinely do not exist: there is no subscription model,
                the results service emits no notification, and while a
                TENDER_RESULT notification type and queue handler exist nothing
                anywhere enqueues one.

                Left disabled rather than repurposed. Making it save the tender
                would quietly swap one capability for another, so a user who
                clicked expecting an alert would get a bookmark and no alert.
                Saving is still available from the header button, which says
                what it does. */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Result alerts for individual tenders are not supported yet"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-muted text-muted-foreground cursor-not-allowed"
            >
              <Bell className="w-4 h-4" /> Notify me when result is published
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 font-semibold uppercase tracking-wide">
                Coming soon
              </span>
            </button>
            <p className="text-caption text-muted-foreground/70 mt-3">
              Result alerts for individual tenders are not supported yet.
            </p>
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
