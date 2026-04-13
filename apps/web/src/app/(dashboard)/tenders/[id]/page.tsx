'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { cn, formatCurrency, formatDate, getDeadlineInfo, getCategoryInfo } from '@/lib/utils';
import { FeatureGate } from '@/components/subscription';

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════════════ */

const TENDER = {
  id: '1',
  title: 'Construction of 4-Lane Highway NH-48 Junction to Mehsana Bypass including Grade Separator and Service Roads',
  organization: 'National Highways Authority of India',
  department: 'Project Implementation Unit, Ahmedabad',
  organizationType: 'Central Government',
  category: 'WORKS',
  state: 'Gujarat',
  district: 'Mehsana',
  estimatedValue: 373969000000,
  emdAmount: 3740000000,
  tenderFee: 10000,
  bidSubmissionDeadline: '2026-04-25T17:00:00',
  bidOpeningDate: '2026-04-26T11:00:00',
  publishedDate: '2026-03-14T00:00:00',
  preBidMeeting: '2026-03-15T11:00:00',
  completionPeriod: '36 months from award',
  tenderType: 'Open - Domestic',
  status: 'ACTIVE',
  source: 'CPPP',
  sourceUrl: 'https://eprocure.gov.in/cppp/',
  refNumber: 'NHAI/GJ/2026/0342',
  description: `The National Highways Authority of India invites online bids from eligible bidders for the Construction of 4-Lane Highway from NH-48 Junction to Mehsana Bypass including Grade Separator at Km 42+300 and Service Roads on both sides in the State of Gujarat under NHDP Phase IV.

The scope of work includes earthwork, sub-grade, granular sub-base, wet mix macadam, dense bituminous macadam, bituminous concrete, reinforced cement concrete works, construction of grade separator, service roads, drainage works, road furniture, and allied works.

Bidders must have experience of completing at least one similar work of value not less than ₹2,500 Crore during the last 7 years and should have an average annual turnover of not less than ₹1,500 Crore during the last 3 financial years.`,
  aiSummary: 'Major highway construction project on NH-48 in Gujarat. Requires significant infrastructure experience (₹2,500 Cr similar work) and high turnover (₹1,500 Cr avg). Grade separator at Km 42+300. 36-month completion. NHAI Project Phase IV. EMD of ₹37.40 Cr required (MSME exempt).',
  documents: [
    { name: 'NIT Document.pdf', size: '2.4 MB', type: 'pdf' },
    { name: 'Bill of Quantities (BOQ).xlsx', size: '1.8 MB', type: 'xlsx' },
    { name: 'Tender Document - Full.pdf', size: '12.6 MB', type: 'pdf' },
    { name: 'Drawings Package.zip', size: '45.2 MB', type: 'zip' },
    { name: 'Corrigendum-1.pdf', size: '340 KB', type: 'pdf' },
  ],
  eligibility: {
    score: 82,
    checkedAt: '2026-04-11T10:30:00',
    criteria: [
      { name: 'Annual Turnover', status: 'MET', required: '₹1,500 Cr (3-year avg)', yours: '₹1,850 Cr', importance: 'CRITICAL' },
      { name: 'Similar Work Experience', status: 'MET', required: '₹2,500 Cr in last 7 years', yours: '₹3,200 Cr (NH-44 Project)', importance: 'CRITICAL' },
      { name: 'Net Worth', status: 'MET', required: '₹500 Cr (positive)', yours: '₹680 Cr', importance: 'IMPORTANT' },
      { name: 'ISO 9001 Certification', status: 'MET', required: 'Valid ISO 9001:2015', yours: 'Valid till Dec 2027', importance: 'IMPORTANT' },
      { name: 'ISO 14001 Certification', status: 'NOT_MET', required: 'Valid ISO 14001:2015', yours: 'Not available', importance: 'IMPORTANT' },
      { name: 'EMD Deposit', status: 'MET', required: '₹37.40 Cr', yours: 'MSME Exempt', importance: 'CRITICAL' },
      { name: 'Solvency Certificate', status: 'MET', required: 'From scheduled bank', yours: 'SBI Certificate valid', importance: 'IMPORTANT' },
      { name: 'PAN & GST Registration', status: 'MET', required: 'Valid PAN & GSTIN', yours: 'Verified', importance: 'CRITICAL' },
      { name: 'No Blacklisting', status: 'MET', required: 'Not blacklisted by any govt org', yours: 'Clear', importance: 'CRITICAL' },
      { name: 'Equipment Ownership', status: 'UNCLEAR', required: 'Specific equipment list', yours: 'Partially available', importance: 'OPTIONAL' },
    ],
    suggestions: [
      'Obtain ISO 14001:2015 (Environmental Management) certification. Apply at any accredited certification body.',
      'Ensure equipment availability declaration is updated before bid submission.',
      'Consider forming a Joint Venture if any criteria is marginally met.',
    ],
  },
  similarTenders: [
    { id: '10', title: 'Construction of 6-Lane Expressway Ahmedabad-Dholera SIR', org: 'NHAI', value: 567000000000, state: 'Gujarat' },
    { id: '11', title: 'Highway Widening NH-27 Rajkot-Jamnagar Section', org: 'NHAI', value: 189000000000, state: 'Gujarat' },
    { id: '12', title: 'ROB Construction at Railway Crossing Km 234 Vadodara', org: 'Railways', value: 45000000000, state: 'Gujarat' },
  ],
};

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 70 ? '#22C55E' : score >= 40 ? '#F59E0B' : '#EF4444';
  const label = score >= 70 ? 'Eligible' : score >= 40 ? 'Partially Eligible' : 'Not Eligible';
  const labelColor = score >= 70 ? 'text-score-high' : score >= 40 ? 'text-score-mid' : 'text-score-low';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={6} fill="none" className="text-muted/30" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={6} fill="none" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-[1500ms] ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-display-sm font-mono font-bold text-foreground">{score}%</span>
        </div>
      </div>
      <span className={cn('text-body-sm font-semibold', labelColor)}>{label}</span>
    </div>
  );
}

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

/* ═══════════════════════════════════════════════════════════════════════════
   TENDER DETAIL PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TenderDetailPage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'eligibility' | 'documents' | 'similar' | 'results'>('overview');
  const [isSaved, setIsSaved] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showMetCriteria, setShowMetCriteria] = useState(false);

  const tender = TENDER;
  const cat = getCategoryInfo(tender.category);
  const deadline = getDeadlineInfo(tender.bidSubmissionDeadline);

  const metCriteria = tender.eligibility.criteria.filter((c) => c.status === 'MET');
  const notMetCriteria = tender.eligibility.criteria.filter((c) => c.status === 'NOT_MET');
  const unclearCriteria = tender.eligibility.criteria.filter((c) => c.status === 'UNCLEAR');

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
        <span className="text-foreground truncate max-w-[200px]">{tender.title.slice(0, 40)}...</span>
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
          <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{tender.state}, {tender.district}</span>
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />Published {formatDate(tender.publishedDate)}</span>
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
          <a href={tender.sourceUrl} target="_blank" rel="noopener" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:text-foreground transition-all">
            <ExternalLink className="w-4 h-4" /> View Original
          </a>
        </div>
      </div>

      {/* ── Metrics Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={IndianRupee} label="Estimated Value" value={formatCurrency(tender.estimatedValue)} accentColor="#FF6B35" />
        <MetricCard icon={Shield} label="EMD / Bid Security" value={formatCurrency(tender.emdAmount)} extra="MSME Exempt" accentColor="#00D4AA" />
        <MetricCard icon={Clock} label="Submission Deadline" value={formatDate(tender.bidSubmissionDeadline)} extra={deadline.text} accentColor={deadline.urgency === 'critical' ? '#EF4444' : deadline.urgency === 'warning' ? '#F59E0B' : '#22C55E'} />
        <MetricCard icon={Sparkles} label="AI Eligibility" value={`${tender.eligibility.score}%`} extra="Eligible" accentColor="#22C55E" />
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

          {/* Key Requirements */}
          <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
            <h3 className="text-heading-sm text-foreground font-display mb-4">Key Requirements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: 'Minimum Turnover', value: '₹1,500 Cr (3-year average)' },
                { label: 'Minimum Experience', value: '₹2,500 Cr similar work in 7 years' },
                { label: 'Required Certifications', value: 'ISO 9001, ISO 14001' },
                { label: 'EMD', value: '₹37.40 Cr (MSME exempt)' },
                { label: 'Tender Fee', value: '₹10,000 (non-refundable)' },
                { label: 'Pre-bid Meeting', value: '15 March 2026, 11:00 AM' },
                { label: 'Work Completion', value: '36 months from award' },
                { label: 'Bid Opening', value: '26 March 2026, 11:00 AM' },
              ].map((req) => (
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
              {[
                ['Organization', tender.organization],
                ['Department', tender.department],
                ['Organization Type', tender.organizationType],
                ['State', tender.state],
                ['District', tender.district],
                ['Category', tender.category],
                ['Tender Type', tender.tenderType],
                ['Published Date', formatDate(tender.publishedDate)],
                ['Submission Deadline', formatDate(tender.bidSubmissionDeadline) + ', 5:00 PM'],
                ['Bid Opening Date', formatDate(tender.bidOpeningDate) + ', 11:00 AM'],
                ['Pre-bid Meeting', formatDate(tender.preBidMeeting) + ', 11:00 AM'],
                ['Work Completion', tender.completionPeriod],
                ['Estimated Value', formatCurrency(tender.estimatedValue)],
                ['EMD Amount', formatCurrency(tender.emdAmount)],
                ['Tender Fee', `₹${tender.tenderFee.toLocaleString('en-IN')} (non-refundable)`],
                ['Reference Number', tender.refNumber],
              ].map(([label, value], i) => (
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
            <div className={cn('text-body-sm text-muted-foreground leading-relaxed whitespace-pre-line', !descExpanded && 'line-clamp-6')}>
              {tender.description}
            </div>
            <button onClick={() => setDescExpanded(!descExpanded)} className="mt-3 text-body-sm text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1 transition-colors">
              {descExpanded ? 'Show less' : 'Read more'}
              {descExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Source link */}
          <a href={tender.sourceUrl} target="_blank" rel="noopener" className="flex items-center gap-2 text-body-sm text-primary-500 hover:text-primary-600 font-medium transition-colors">
            View this tender on {tender.source} <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* ELIGIBILITY */}
      {activeTab === 'eligibility' && (
        <div className="space-y-6">
          {/* Score */}
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <ScoreRing score={tender.eligibility.score} />
            <p className="text-caption text-muted-foreground mt-3">
              Checked on {formatDate(tender.eligibility.checkedAt)}
            </p>
          </div>

          {/* Criteria Breakdown */}
          <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
            <h3 className="text-heading-sm text-foreground font-display mb-1">Eligibility Analysis</h3>
            <p className="text-caption text-muted-foreground mb-5">{tender.eligibility.criteria.length} criteria checked</p>

            {/* Not Met — always expanded */}
            {notMetCriteria.length > 0 && (
              <div className="mb-6">
                <h4 className="text-body-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                  <XIcon className="w-4 h-4" /> Not Met ({notMetCriteria.length})
                </h4>
                <div className="space-y-2">
                  {notMetCriteria.map((c) => (
                    <div key={c.name} className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-body-sm font-medium text-foreground">{c.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-semibold">{c.importance}</span>
                      </div>
                      <p className="text-caption text-muted-foreground">Required: {c.required} | Yours: {c.yours}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unclear */}
            {unclearCriteria.length > 0 && (
              <div className="mb-6">
                <h4 className="text-body-sm font-semibold text-amber-500 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Unclear ({unclearCriteria.length})
                </h4>
                <div className="space-y-2">
                  {unclearCriteria.map((c) => (
                    <div key={c.name} className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-body-sm font-medium text-foreground">{c.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold">{c.importance}</span>
                      </div>
                      <p className="text-caption text-muted-foreground">Required: {c.required} | Yours: {c.yours}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Met — collapsible */}
            <div>
              <button onClick={() => setShowMetCriteria(!showMetCriteria)} className="text-body-sm font-semibold text-accent-500 mb-3 flex items-center gap-2 hover:text-accent-600 transition-colors">
                <Check className="w-4 h-4" /> {metCriteria.length} criteria met
                {showMetCriteria ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showMetCriteria && (
                <div className="space-y-2">
                  {metCriteria.map((c) => (
                    <div key={c.name} className="bg-accent-500/5 border border-accent-500/10 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-body-sm font-medium text-foreground">{c.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-500/10 text-accent-500 font-semibold">{c.importance}</span>
                      </div>
                      <p className="text-caption text-muted-foreground">Required: {c.required} | Yours: {c.yours}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Suggestions */}
          <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
            <h3 className="text-heading-sm text-foreground font-display mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" /> How to Improve
            </h3>
            <div className="space-y-3">
              {tender.eligibility.suggestions.map((s, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-body-sm font-mono text-primary-500 font-bold shrink-0 w-5">{i + 1}.</span>
                  <p className="text-body-sm text-muted-foreground">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENTS */}
      {activeTab === 'documents' && (
        <FeatureGate feature="documentDownload" fallbackVariant="card">
        <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-heading-sm text-foreground font-display">Documents ({tender.documents.length})</h3>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors">
              <Download className="w-4 h-4" /> Download All
            </button>
          </div>
          <div className="divide-y divide-border">
            {tender.documents.map((doc) => {
              const iconColor = doc.type === 'pdf' ? 'text-red-500' : doc.type === 'xlsx' ? 'text-green-500' : doc.type === 'zip' ? 'text-amber-500' : 'text-blue-500';
              return (
                <div key={doc.name} className="flex items-center gap-4 py-3.5 group">
                  <FileText className={cn('w-5 h-5 shrink-0', iconColor)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm text-foreground font-medium truncate">{doc.name}</p>
                    <p className="text-caption text-muted-foreground">{doc.size}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-500 hover:bg-primary-500/15 transition-colors flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </FeatureGate>
      )}

      {/* SIMILAR TENDERS */}
      {activeTab === 'similar' && (
        <div className="space-y-3">
          <p className="text-body-sm text-muted-foreground mb-4">
            Based on: similar title, same organization, same category
          </p>
          {tender.similarTenders.map((t) => (
            <Link
              key={t.id}
              href={`/tenders/${t.id}`}
              className="block bg-card border border-border rounded-xl p-5 hover:border-border/80 hover:shadow-sm transition-all"
            >
              <p className="text-body-md font-medium text-foreground hover:text-primary-500 transition-colors mb-1.5">{t.title}</p>
              <div className="flex items-center gap-4 text-body-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{t.org}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{t.state}</span>
                <span className="font-mono font-medium text-foreground">{formatCurrency(t.value)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* RESULTS */}
      {activeTab === 'results' && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-heading-md text-foreground font-display mb-2">Result not yet available</h3>
          <p className="text-body-sm text-muted-foreground mb-5">
            This tender is still active. Results will be published after bid evaluation.
          </p>
          <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors">
            <Bell className="w-4 h-4" /> Notify me when result is published
          </button>
        </div>
      )}
    </div>
  );
}
