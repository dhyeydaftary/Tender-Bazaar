'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Brain,
  Shield,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  MapPin,
  IndianRupee,
  Calendar,
  ArrowRight,
  Loader2,
  Lightbulb,
  Zap,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useLimitGate } from '@/lib/hooks/use-feature-gate';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { UpgradeBanner } from '@/components/subscription';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface Tender {
  id: string;
  title: string;
  organization: string;
  category: string;
  state: string;
  estimatedValue: number;
  bidDeadline: string;
}

type CriteriaStatus = 'pass' | 'partial' | 'fail';

interface CriteriaResult {
  name: string;
  status: CriteriaStatus;
  detail: string;
}

interface EligibilityResult {
  score: number;
  isEligible: boolean;
  criteria: CriteriaResult[];
  suggestions: string[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function formatINR(value: number): string {
  if (value >= 10000000) return `Rs.${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `Rs.${(value / 100000).toFixed(2)} L`;
  return `Rs.${value.toLocaleString('en-IN')}`;
}

function formatDate(date?: string | null): string {
  if (!date) return 'Not specified';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Not specified';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getCategoryStyle(category: string): { color: string; bg: string } {
  const map: Record<string, { color: string; bg: string }> = {
    Works: { color: 'text-[#E8593C]', bg: 'bg-[#E8593C]/10' },
    Goods: { color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/10' },
    Services: { color: 'text-[#0D9488]', bg: 'bg-[#0D9488]/10' },
    Consultancy: { color: 'text-[#7C3AED]', bg: 'bg-[#7C3AED]/10' },
  };
  return map[category] ?? { color: 'text-muted-foreground', bg: 'bg-muted' };
}

function getCriteriaIcon(status: CriteriaStatus) {
  if (status === 'pass') return CheckCircle2;
  if (status === 'partial') return AlertTriangle;
  return XCircle;
}

function getCriteriaColor(status: CriteriaStatus) {
  if (status === 'pass') return { text: 'text-accent-600 dark:text-accent-400', bg: 'bg-accent-100 dark:bg-accent-900/30' };
  if (status === 'partial') return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' };
  return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCORE RING (SVG)
   ═══════════════════════════════════════════════════════════════════════════ */

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const color = score >= 70 ? '#00D4AA' : score >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-mono font-bold text-foreground">{score}%</span>
        <span className={cn(
          'text-xs font-semibold mt-0.5',
          score >= 70 ? 'text-accent-500' : score >= 40 ? 'text-amber-500' : 'text-red-500',
        )}>
          {score >= 70 ? 'Eligible' : score >= 40 ? 'Partial' : 'Not Eligible'}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANALYZING ANIMATION
   ═══════════════════════════════════════════════════════════════════════════ */

function AnalyzingState() {
  const steps = [
    'Reading tender requirements...',
    'Analyzing eligibility criteria...',
    'Matching your company profile...',
    'Generating eligibility report...',
  ];
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 500);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="bg-card border border-border rounded-xl p-8 text-center">
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-primary-500/10 flex items-center justify-center">
            <Brain className="h-8 w-8 text-primary-500 animate-pulse" />
          </div>
          <div className="absolute -inset-2 rounded-full border-2 border-primary-500/20 animate-ping" />
        </div>
      </div>
      <h3 className="text-heading-sm font-display text-foreground mb-2">AI is analyzing this tender</h3>
      <p className="text-body-sm text-muted-foreground mb-6">This usually takes a few seconds</p>
      <div className="max-w-sm mx-auto space-y-2">
        {steps.map((step, i) => (
          <div
            key={step}
            className={cn(
              'flex items-center gap-2 text-caption transition-all duration-300',
              i <= currentStep ? 'text-foreground' : 'text-muted-foreground/40',
            )}
          >
            {i < currentStep ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-accent-500 shrink-0" />
            ) : i === currentStep ? (
              <Loader2 className="h-3.5 w-3.5 text-primary-500 animate-spin shrink-0" />
            ) : (
              <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />
            )}
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AIEligibilityCheckPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [tendersLoading, setTendersLoading] = useState(true);
  const [tendersError, setTendersError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Subscription status
  const isFreePlan = useSubscriptionStore((s) => s.isFreePlan);
  const currentPlan = useSubscriptionStore((s) => s.currentPlan);
  const subscription = useSubscriptionStore((s) => s.subscription);
  const fetchSubscription = useSubscriptionStore((s) => s.fetchSubscription);
  const hasPaidSubscription = (!isFreePlan && !!currentPlan && currentPlan.slug !== 'free') || (subscription?.status === 'ACTIVE' && currentPlan?.slug !== 'free');

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Plan limit gate for AI checks
  const aiCheckLimit = useLimitGate('maxAiChecks');
  const checksUsed = aiCheckLimit.used;
  const checksLimit = aiCheckLimit.isUnlimited ? -1 : aiCheckLimit.limit;
  const checksPercent = aiCheckLimit.isUnlimited ? 0 : checksLimit === 0 ? 100 : (checksUsed / checksLimit) * 100;

  /* ─── Fetch active tenders ─── */

  const fetchTenders = useCallback(async () => {
    try {
      setTendersLoading(true);
      setTendersError(null);
      const { data: res } = await api.get('/tenders', {
        params: { status: 'ACTIVE', limit: 100, page: 1 },
      });
      let tenderList: any[] = res?.data?.tenders || [];
      const total = res?.data?.total || tenderList.length;

      // If more than 100 tenders exist, fetch the remaining pages to show all tenders
      if (total > tenderList.length) {
        const totalPages = Math.ceil(total / 100);
        const additionalPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            api.get('/tenders', { params: { status: 'ACTIVE', limit: 100, page: i + 2 } }).catch(() => null)
          )
        );
        for (const pRes of additionalPages) {
          if (pRes?.data?.data?.tenders) {
            tenderList = tenderList.concat(pRes.data.data.tenders);
          }
        }
      }

      if (Array.isArray(tenderList)) {
        const mapped: Tender[] = tenderList.map((t: any) => ({
          id: t.id,
          title: t.title ?? 'Untitled Tender',
          organization: t.organization ?? 'Unknown Organization',
          category: t.category ?? '',
          state: t.state ?? '',
          estimatedValue: t.estimatedValue ?? 0,
          bidDeadline: t.bidSubmissionDeadline ?? t.bidDeadline ?? t.closingDate ?? '',
        }));
        setTenders(mapped);
        if (mapped.length > 0) setSelectedTender((prev) => prev ?? mapped[0]);
      }
    } catch (err: any) {
      setTendersError(err?.response?.data?.error?.message || err.message || 'Failed to load tenders');
    } finally {
      setTendersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenders();
  }, [fetchTenders]);

  /* ─── Filtered tender suggestions ─── */

  const filteredTenders = tenders.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.organization.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.state.toLowerCase().includes(q)
    );
  });

  /* ─── Run check handler ─── */

  async function handleRunCheck() {
    if (!selectedTender || isAnalyzing) return;
    setShowResults(false);
    setCheckError(null);
    setIsAnalyzing(true);
    try {
      let resData: any = null;
      try {
        const res = await api.post('/eligibility/check', {
          tenderId: selectedTender.id,
        });
        resData = res.data;
      } catch (checkErr: any) {
        if (checkErr?.response?.status === 404) {
          const res = await api.post('/eligibility', {
            tenderId: selectedTender.id,
          });
          resData = res.data;
        } else {
          throw checkErr;
        }
      }

      if (resData?.success && resData?.data) {
        const d = resData.data.result || resData.data.eligibilityCheck || resData.data;
        const rawCriteria = d.criteria || [];
        let criteria: CriteriaResult[] = [];

        if (Array.isArray(rawCriteria)) {
          criteria = rawCriteria.map((c: any) => {
            const name = c.name || c.criterion || 'Criterion';
            const rawStatus = (c.status || '').toString().toUpperCase();
            let status: CriteriaStatus = 'fail';
            if (rawStatus === 'MET' || rawStatus === 'PASS' || c.met === true || c.status === 'pass') {
              status = 'pass';
            } else if (rawStatus === 'PARTIALLY_MET' || rawStatus === 'PARTIAL' || c.status === 'partial') {
              status = 'partial';
            }
            return {
              name,
              status,
              detail: c.detail || '',
            };
          });
        } else if (rawCriteria && typeof rawCriteria === 'object') {
          criteria = Object.entries(rawCriteria).map(([key, val]: [string, any]) => {
            const name = val.name || val.criterion || key;
            const rawStatus = (val.status || (val.met ? 'MET' : 'NOT_MET')).toString().toUpperCase();
            let status: CriteriaStatus = 'fail';
            if (rawStatus === 'MET' || rawStatus === 'PASS' || val.met === true || val.status === 'pass') {
              status = 'pass';
            } else if (rawStatus === 'PARTIALLY_MET' || rawStatus === 'PARTIAL' || val.status === 'partial') {
              status = 'partial';
            }
            return {
              name,
              status,
              detail: val.detail || '',
            };
          });
        }

        let suggestions: string[] = [];
        if (Array.isArray(d.suggestions)) {
          suggestions = d.suggestions
            .map((s: any) => (typeof s === 'string' ? s : s.text ?? s.suggestion ?? ''))
            .filter(Boolean);
        }

        setResult({
          score: typeof d.score === 'number' ? Math.round(d.score) : 0,
          isEligible: Boolean(d.isEligible ?? d.is_eligible),
          criteria,
          suggestions,
        });
        setShowResults(true);
      }
    } catch (err: any) {
      setCheckError(err?.response?.data?.error?.message || err.message || 'Eligibility check failed');
      setShowResults(false);
    } finally {
      setIsAnalyzing(false);
    }
  }

  /* ─── Check another tender ─── */

  function handleCheckAnother() {
    setShowResults(false);
    setIsAnalyzing(false);
    setResult(null);
    setCheckError(null);
    setSearchQuery('');
  }

  return (
    <div>
      {/* Limit banner */}
      {!aiCheckLimit.hasCapacity && !aiCheckLimit.isUnlimited && (
        <div className="mb-6">
          <UpgradeBanner
            feature="AI Eligibility Checks"
            requiredPlan="Starter"
            currentPlan={aiCheckLimit.currentPlan}
            variant="card"
          />
        </div>
      )}

      {/* ── Header + Usage Stats ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-heading-lg text-foreground font-display">AI Eligibility Check</h1>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            Check your eligibility against any tender before you bid
          </p>
        </div>

        {/* Usage Stats Bar */}
        <div className="bg-card border border-border rounded-xl p-4 min-w-[240px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-muted-foreground">
              {aiCheckLimit.isUnlimited ? 'AI Checks (Unlimited)' : 'AI Checks'}
            </span>
            <span className={cn(
              'text-caption font-mono font-semibold',
              checksPercent > 80 ? 'text-amber-500' : 'text-foreground',
            )}>
              {aiCheckLimit.isUnlimited ? 'Unlimited' : `${checksUsed}/${checksLimit}`}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                checksPercent > 80 ? 'bg-amber-500' : 'bg-primary-500',
              )}
              style={{ width: `${aiCheckLimit.isUnlimited ? 100 : checksPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {aiCheckLimit.isUnlimited
              ? `Unlimited checks included with ${currentPlan?.name || 'Enterprise'} plan`
              : `${Math.max(0, checksLimit - checksUsed)} checks remaining on ${currentPlan?.name || 'Free'} plan`}
          </p>
        </div>
      </div>

      {/* ── How It Works ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          {
            step: 1,
            icon: Search,
            title: 'Select a Tender',
            description: 'Search and choose the tender you want to check eligibility for',
          },
          {
            step: 2,
            icon: Brain,
            title: 'AI Analyzes Requirements',
            description: 'Our AI reads the tender document and matches it against your profile',
          },
          {
            step: 3,
            icon: ShieldCheck,
            title: 'Get Your Eligibility Score',
            description: 'Receive a detailed breakdown of how well you match each criterion',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.step}
              className="bg-card border border-border rounded-xl p-5 relative overflow-hidden"
            >
              <div className="absolute top-3 right-3 text-[48px] font-mono font-bold text-muted/20 leading-none select-none">
                {item.step}
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center mb-3">
                <Icon className="h-5 w-5 text-primary-500" />
              </div>
              <h3 className="text-body-sm font-semibold text-foreground mb-1">{item.title}</h3>
              <p className="text-caption text-muted-foreground">{item.description}</p>
            </div>
          );
        })}
      </div>

      {/* ── Tender Search / Select ────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl mb-6">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-heading-sm font-display text-foreground">Select a Tender</h2>
        </div>
        <div className="p-5">
          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tender by name, ID, or organization..."
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Tender Count & Scroll Hint */}
          <div className="flex items-center justify-between text-caption text-muted-foreground mb-2 px-1">
            <span>
              {tendersLoading ? 'Loading tenders...' : `Showing ${filteredTenders.length} active tenders`}
            </span>
            {filteredTenders.length > 5 && (
              <span className="text-[11px] text-muted-foreground/70 hidden sm:inline">
                Scroll down to view all tenders
              </span>
            )}
          </div>

          {/* Tender Suggestions List */}
          <div className="divide-y divide-border border border-border rounded-lg overflow-y-auto max-h-[460px]">
            {tendersLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 text-primary-500 animate-spin mx-auto mb-2" />
                <p className="text-body-sm text-muted-foreground">Loading active tenders...</p>
              </div>
            ) : tendersError ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-body-sm text-muted-foreground mb-3">{tendersError}</p>
                <button
                  onClick={fetchTenders}
                  className="text-caption font-medium text-primary-500 hover:text-primary-600 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : filteredTenders.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-body-sm text-muted-foreground">No tenders match your search</p>
              </div>
            ) : (
              filteredTenders.map((tender) => {
                const catStyle = getCategoryStyle(tender.category);
                const isSelected = selectedTender?.id === tender.id;
                return (
                  <div
                    key={tender.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedTender(tender);
                      setShowResults(false);
                      setIsAnalyzing(false);
                      setResult(null);
                      setCheckError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedTender(tender);
                        setShowResults(false);
                        setIsAnalyzing(false);
                        setResult(null);
                        setCheckError(null);
                      }
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors cursor-pointer select-none',
                      isSelected
                        ? 'bg-primary-500/5 border-l-2 border-l-primary-500'
                        : 'hover:bg-muted/30 border-l-2 border-l-transparent',
                    )}
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      {/* Radio indicator */}
                      <div className={cn(
                        'h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                        isSelected ? 'border-primary-500' : 'border-border',
                      )}>
                        {isSelected && (
                          <div className="h-2 w-2 rounded-full bg-primary-500" />
                        )}
                      </div>

                      {/* Tender info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', catStyle.color, catStyle.bg)}>
                            {tender.category}
                          </span>
                          <span className="text-caption text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" /> {tender.state}
                          </span>
                        </div>
                        <p className={cn(
                          'text-body-sm font-medium truncate transition-colors',
                          isSelected ? 'text-primary-500 font-semibold' : 'text-foreground',
                        )}>
                          {tender.title}
                        </p>
                        <p className="text-caption text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {tender.organization}
                        </p>
                      </div>
                    </div>

                    {/* Arrow / Direct link to tender details */}
                    <Link
                      href={`/tenders/${tender.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="View tender details (opens in new tab)"
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary-500 transition-colors shrink-0 flex items-center justify-center group/arrow"
                    >
                      <ChevronRight className={cn(
                        'h-4 w-4 transition-transform group-hover/arrow:translate-x-0.5',
                        isSelected ? 'text-primary-500' : 'text-muted-foreground/60',
                      )} />
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Selected Tender + Run Check ───────────────────────────── */}
      {selectedTender && !showResults && !isAnalyzing && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-overline text-muted-foreground uppercase tracking-widest text-[10px] font-medium mb-1.5">
                Selected Tender
              </p>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href={`/tenders/${selectedTender.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 text-body-sm font-semibold text-foreground hover:text-primary-500 transition-colors"
                  title="View full tender details"
                >
                  <span className="truncate">{selectedTender.title}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {selectedTender.organization}
                </span>
                <span className="flex items-center gap-1">
                  <IndianRupee className="h-3 w-3" />
                  {formatINR(selectedTender.estimatedValue)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Deadline: {formatDate(selectedTender.bidDeadline)}
                </span>
              </div>
            </div>
            <button
              onClick={handleRunCheck}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors shrink-0 shadow-sm hover:shadow"
            >
              <Sparkles className="h-4 w-4" />
              Run Eligibility Check
            </button>
          </div>
        </div>
      )}

      {/* ── Analyzing State ───────────────────────────────────────── */}
      {isAnalyzing && <AnalyzingState />}

      {/* ── Check Error ──────────────────────────────────────────── */}
      {checkError && !isAnalyzing && (
        <div className="bg-card border border-red-200 dark:border-red-900/50 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-body-sm font-medium text-foreground mb-1">Eligibility check failed</p>
              <p className="text-caption text-muted-foreground mb-3">{checkError}</p>
              <button
                onClick={handleRunCheck}
                className="text-caption font-medium text-primary-500 hover:text-primary-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Analysis Results ───────────────────────────────────── */}
      {showResults && !isAnalyzing && result && (
        <div className="space-y-6">
          {/* Results Header */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              {/* Score Ring */}
              <div className="flex justify-center lg:justify-start">
                <ScoreRing score={result.score} size={130} />
              </div>

              {/* Summary */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-heading-sm font-display text-foreground">Eligibility Analysis Complete</h3>
                  <span className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full',
                    result.isEligible || result.score >= 70
                      ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400'
                      : result.score >= 40
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
                  )}>
                    {result.isEligible || result.score >= 70 ? (
                      <><CheckCircle2 className="h-3.5 w-3.5" /> Eligible</>
                    ) : result.score >= 40 ? (
                      <><AlertTriangle className="h-3.5 w-3.5" /> Partially Eligible</>
                    ) : (
                      <><XCircle className="h-3.5 w-3.5" /> Not Eligible</>
                    )}
                  </span>
                </div>
                <p className="text-body-sm text-muted-foreground mb-3">
                  Based on our AI analysis of the tender requirements against your company profile,
                  {result.score >= 70
                    ? ' you meet most eligibility criteria for this tender.'
                    : result.score >= 40
                      ? ' you partially meet the eligibility criteria. Some areas need attention.'
                      : ' you do not currently meet the key eligibility criteria for this tender.'}
                </p>
                {selectedTender && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {selectedTender.title}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {selectedTender.organization}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Criteria Breakdown */}
          {result.criteria.length > 0 && (
            <div className="bg-card border border-border rounded-xl">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-heading-sm font-display text-foreground">Criteria Breakdown</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
                {result.criteria.map((criteria) => {
                  const Icon = getCriteriaIcon(criteria.status);
                  const colors = getCriteriaColor(criteria.status);
                  return (
                    <div key={criteria.name} className="bg-card p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', colors.bg)}>
                          <Icon className={cn('h-4 w-4', colors.text)} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-body-sm font-medium text-foreground">{criteria.name}</p>
                          <p className="text-caption text-muted-foreground mt-0.5">{criteria.detail}</p>
                          <span className={cn(
                            'inline-block text-[10px] font-semibold mt-1.5 px-2 py-0.5 rounded-full',
                            colors.bg,
                            colors.text,
                          )}>
                            {criteria.status === 'pass' ? 'Pass' : criteria.status === 'partial' ? 'Partial' : 'Fail'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.suggestions.length > 0 && (
            <div className="bg-card border border-border rounded-xl">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <h2 className="text-heading-sm font-display text-foreground">Recommendations</h2>
              </div>
              <div className="p-5 space-y-3">
                {result.suggestions.map((rec, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-mono font-bold text-primary-500">{i + 1}</span>
                    </div>
                    <p className="text-body-sm text-muted-foreground">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {selectedTender && (
              <Link
                href={`/tenders/${selectedTender.id}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
              >
                <FileText className="h-4 w-4" />
                View Full Report
              </Link>
            )}
            <button
              onClick={handleCheckAnother}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-border bg-card hover:bg-muted/50 text-foreground font-medium rounded-lg transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
              Check Another Tender
            </button>
          </div>
        </div>
      )}

      {/* ── Plan Upgrade CTA (only shown for users without a paid subscription) ── */}
      {!hasPaidSubscription && (
        <div className="mt-8 bg-gradient-to-r from-primary-500/10 via-accent-500/10 to-primary-500/10 border border-primary-500/20 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary-500/20 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-primary-500" />
              </div>
              <div>
                <p className="text-body-sm font-semibold text-foreground">Upgrade for Unlimited AI Checks</p>
                <p className="text-caption text-muted-foreground">
                  Professional plan includes 50 AI checks/month. Enterprise gives unlimited access.
                </p>
              </div>
            </div>
            <Link
              href="/subscription"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors shrink-0"
            >
              Upgrade Plan
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
