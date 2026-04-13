'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Check,
  X,
  ChevronDown,
  ArrowRight,
  Zap,
  Star,
  Shield,
  Building2,
  Lock,
  CreditCard,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import type { SubscriptionPlan } from '@/stores/subscription-store';

/* ------------------------------------------------------------------ */
/* Plan icon/color mapping                                             */
/* ------------------------------------------------------------------ */

const PLAN_CONFIG: Record<string, {
  icon: typeof Zap;
  ctaVariant: 'outline' | 'primary' | 'accent' | 'secondary';
  cta: string;
  ctaHref: string;
}> = {
  free: { icon: Zap, ctaVariant: 'outline', cta: 'Start Free', ctaHref: '/register' },
  starter: { icon: Star, ctaVariant: 'primary', cta: 'Get Started', ctaHref: '/register?plan=starter' },
  professional: { icon: Shield, ctaVariant: 'accent', cta: 'Choose Professional', ctaHref: '/register?plan=professional' },
  enterprise: { icon: Building2, ctaVariant: 'secondary', cta: 'Choose Enterprise', ctaHref: '/register?plan=enterprise' },
};

/* ------------------------------------------------------------------ */
/* Build feature list from plan data                                   */
/* ------------------------------------------------------------------ */

interface PlanFeature {
  label: string;
  included: boolean;
}

function buildFeatures(plan: SubscriptionPlan): PlanFeature[] {
  const unlimited = (n: number) => n === -1;

  return [
    {
      label: unlimited(plan.tenderViewsPerPage)
        ? 'Unlimited tender views'
        : `${plan.tenderViewsPerPage} tenders/page (no pagination)`,
      included: true,
    },
    {
      label: unlimited(plan.maxAlerts)
        ? 'Unlimited alerts'
        : plan.maxAlerts === 0
          ? 'No alerts'
          : `${plan.maxAlerts} alerts`,
      included: plan.maxAlerts !== 0,
    },
    {
      label: unlimited(plan.maxAiChecks)
        ? 'Unlimited AI eligibility checks'
        : plan.aiChecksResetMonthly
          ? `${plan.maxAiChecks} AI checks/month`
          : `${plan.maxAiChecks} AI check (lifetime)`,
      included: true,
    },
    {
      label: unlimited(plan.maxSavedTenders)
        ? 'Unlimited saved tenders'
        : plan.maxSavedTenders === 0
          ? 'No saved tenders'
          : `${plan.maxSavedTenders} saved tenders`,
      included: plan.maxSavedTenders !== 0,
    },
    { label: 'Document download', included: plan.documentDownload },
    { label: 'Tender calendar', included: plan.tenderCalendar },
    { label: 'AI tender summary', included: plan.aiTenderSummary },
    { label: 'WhatsApp alerts', included: plan.whatsappAlerts },
    {
      label: plan.aiBidAssistant === 'advanced'
        ? 'Advanced bid assistant'
        : plan.aiBidAssistant === 'basic'
          ? 'Basic bid assistant'
          : 'Bid assistant',
      included: plan.aiBidAssistant !== 'none',
    },
    { label: 'Export to CSV/PDF', included: plan.exportEnabled },
    { label: 'Tender comparison', included: plan.tenderComparison },
    { label: 'Competitor analysis', included: plan.competitorAnalysis },
  ];
}

/* ------------------------------------------------------------------ */
/* Comparison table data (derived from plans)                          */
/* ------------------------------------------------------------------ */

interface ComparisonCategory {
  name: string;
  rows: {
    feature: string;
    free: string;
    starter: string;
    professional: string;
    enterprise: string;
  }[];
}

function buildComparison(plans: SubscriptionPlan[]): ComparisonCategory[] {
  const p = (slug: string) => plans.find((pl) => pl.slug === slug);
  const f = p('free');
  const s = p('starter');
  const pr = p('professional');
  const e = p('enterprise');
  if (!f || !s || !pr || !e) return [];

  const limit = (n: number) => n === -1 ? 'Unlimited' : n === 0 ? 'no' : String(n);
  const bool = (v: boolean) => v ? 'yes' : 'no';
  const tier = (v: string) => v === 'none' ? 'no' : v === 'basic' ? 'Basic' : 'Advanced';

  return [
    {
      name: 'Tender Access',
      rows: [
        { feature: 'Tender Views', free: `${f.tenderViewsPerPage}/page`, starter: 'Unlimited', professional: 'Unlimited', enterprise: 'Unlimited' },
        { feature: 'Pagination', free: bool(f.paginationAllowed), starter: bool(s.paginationAllowed), professional: bool(pr.paginationAllowed), enterprise: bool(e.paginationAllowed) },
        { feature: 'Advanced Filters', free: bool(f.advancedFilters), starter: bool(s.advancedFilters), professional: bool(pr.advancedFilters), enterprise: bool(e.advancedFilters) },
        { feature: 'Saved Tenders', free: limit(f.maxSavedTenders), starter: limit(s.maxSavedTenders), professional: limit(pr.maxSavedTenders), enterprise: limit(e.maxSavedTenders) },
        { feature: 'Document Download', free: bool(f.documentDownload), starter: bool(s.documentDownload), professional: bool(pr.documentDownload), enterprise: bool(e.documentDownload) },
        { feature: 'Bulk Download', free: bool(f.bulkDownload), starter: bool(s.bulkDownload), professional: bool(pr.bulkDownload), enterprise: bool(e.bulkDownload) },
        { feature: 'Export (CSV/PDF)', free: bool(f.exportEnabled), starter: bool(s.exportEnabled), professional: bool(pr.exportEnabled), enterprise: bool(e.exportEnabled) },
      ],
    },
    {
      name: 'Alerts & Notifications',
      rows: [
        { feature: 'Tender Alerts', free: limit(f.maxAlerts), starter: limit(s.maxAlerts), professional: limit(pr.maxAlerts), enterprise: limit(e.maxAlerts) },
        { feature: 'Email Alerts', free: bool(f.emailAlerts), starter: bool(s.emailAlerts), professional: bool(pr.emailAlerts), enterprise: bool(e.emailAlerts) },
        { feature: 'Push Notifications', free: bool(f.pushAlerts), starter: bool(s.pushAlerts), professional: bool(pr.pushAlerts), enterprise: bool(e.pushAlerts) },
        { feature: 'WhatsApp Alerts', free: bool(f.whatsappAlerts), starter: bool(s.whatsappAlerts), professional: bool(pr.whatsappAlerts), enterprise: bool(e.whatsappAlerts) },
        { feature: 'Corrigendum Alerts', free: bool(f.corrigendumAlerts), starter: bool(s.corrigendumAlerts), professional: bool(pr.corrigendumAlerts), enterprise: bool(e.corrigendumAlerts) },
      ],
    },
    {
      name: 'AI & Intelligence',
      rows: [
        { feature: 'AI Eligibility Checks', free: `${f.maxAiChecks} total`, starter: `${s.maxAiChecks}/mo`, professional: `${pr.maxAiChecks}/mo`, enterprise: 'Unlimited' },
        { feature: 'AI Tender Summary', free: bool(f.aiTenderSummary), starter: bool(s.aiTenderSummary), professional: bool(pr.aiTenderSummary), enterprise: bool(e.aiTenderSummary) },
        { feature: 'Bid Assistant', free: tier(f.aiBidAssistant), starter: tier(s.aiBidAssistant), professional: tier(pr.aiBidAssistant), enterprise: tier(e.aiBidAssistant) },
        { feature: 'Tender Comparison', free: bool(f.tenderComparison), starter: bool(s.tenderComparison), professional: bool(pr.tenderComparison), enterprise: bool(e.tenderComparison) },
        { feature: 'AI Matching', free: tier(f.aiMatching), starter: tier(s.aiMatching), professional: tier(pr.aiMatching), enterprise: tier(e.aiMatching) },
        { feature: 'Competitor Analysis', free: bool(f.competitorAnalysis), starter: bool(s.competitorAnalysis), professional: bool(pr.competitorAnalysis), enterprise: bool(e.competitorAnalysis) },
      ],
    },
    {
      name: 'Platform & Support',
      rows: [
        { feature: 'Tender Calendar', free: bool(f.tenderCalendar), starter: bool(s.tenderCalendar), professional: bool(pr.tenderCalendar), enterprise: bool(e.tenderCalendar) },
        { feature: 'Multi-Language', free: bool(f.multiLanguage), starter: bool(s.multiLanguage), professional: bool(pr.multiLanguage), enterprise: bool(e.multiLanguage) },
        { feature: 'Team Members', free: String(f.maxTeamMembers), starter: String(s.maxTeamMembers), professional: String(pr.maxTeamMembers), enterprise: String(e.maxTeamMembers) },
        { feature: 'e-Tendering Support', free: bool(f.eTenderingSupport), starter: bool(s.eTenderingSupport), professional: bool(pr.eTenderingSupport), enterprise: bool(e.eTenderingSupport) },
        { feature: 'Dedicated Manager', free: bool(f.dedicatedManager), starter: bool(s.dedicatedManager), professional: bool(pr.dedicatedManager), enterprise: bool(e.dedicatedManager) },
        {
          feature: 'Support Level',
          free: 'Help Center',
          starter: 'Email',
          professional: 'Email + Chat',
          enterprise: 'Priority Phone',
        },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* FAQ data                                                           */
/* ------------------------------------------------------------------ */

const FAQ_ITEMS = [
  {
    question: 'Can I upgrade or downgrade my plan anytime?',
    answer: 'Yes, you can change your plan at any time. When upgrading, the new features are available immediately and you will be charged a prorated amount. When downgrading, the change takes effect at the end of your current billing cycle.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major Indian payment methods through Razorpay including UPI, credit/debit cards (Visa, Mastercard, RuPay), net banking, and wallets. All payments are processed securely.',
  },
  {
    question: 'Do you charge GST on subscriptions?',
    answer: 'Yes, 18% GST is applicable on all paid plans as per Indian tax regulations. The prices shown are exclusive of GST. GST details will be included on your invoice.',
  },
  {
    question: 'How do I cancel my subscription?',
    answer: 'You can cancel your subscription anytime from the Subscription page in your dashboard. After cancellation, you will continue to have access to your current plan features until the end of the billing cycle.',
  },
  {
    question: 'What happens when I reach my plan limits?',
    answer: 'When you reach a limit (like AI checks or saved tenders), you will see an upgrade prompt. You can upgrade instantly to get more capacity without losing any data.',
  },
  {
    question: 'Can I get a refund if I am not satisfied?',
    answer: 'We offer a 7-day refund policy for first-time subscribers on paid plans. If you are not satisfied within the first 7 days, contact our support team for a full refund.',
  },
  {
    question: 'Is my payment information secure?',
    answer: 'Absolutely. All payments are processed through Razorpay, a PCI DSS Level 1 certified payment gateway. We never store your card details on our servers. All transactions are encrypted with 256-bit SSL.',
  },
  {
    question: 'What is the free plan AI check limit?',
    answer: 'The free plan includes 1 AI eligibility check as a lifetime allowance. Once used, you will need to upgrade to a paid plan for more checks. Paid plans reset monthly.',
  },
];

/* ------------------------------------------------------------------ */
/* Helper: format price in INR                                        */
/* ------------------------------------------------------------------ */

function formatPrice(value: number): string {
  if (value === 0) return '0';
  return value.toLocaleString('en-IN');
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

function BillingToggle({ isYearly, onToggle }: { isYearly: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className={cn('text-sm font-medium transition-colors', !isYearly ? 'text-foreground' : 'text-muted-foreground')}>
        Monthly
      </span>
      <button
        onClick={onToggle}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isYearly ? 'bg-primary-500' : 'bg-muted',
        )}
        role="switch"
        aria-checked={isYearly}
        aria-label="Toggle yearly billing"
      >
        <span className={cn('pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform', isYearly ? 'translate-x-5.5' : 'translate-x-0.5')} />
      </button>
      <span className={cn('text-sm font-medium transition-colors', isYearly ? 'text-foreground' : 'text-muted-foreground')}>
        Yearly
      </span>
      {isYearly && (
        <span className="inline-flex items-center rounded-full bg-accent-500/20 px-2.5 py-0.5 text-xs font-semibold text-accent-400">
          Save ~17%
        </span>
      )}
    </div>
  );
}

function PricingCard({ plan, isYearly }: { plan: SubscriptionPlan; isYearly: boolean }) {
  const config = PLAN_CONFIG[plan.slug] || PLAN_CONFIG.free;
  const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
  const period = plan.monthlyPrice === 0 ? 'forever' : isYearly ? '/year' : '/month';
  const features = buildFeatures(plan);

  const ctaClasses: Record<string, string> = {
    outline: 'border-2 border-border text-foreground hover:bg-muted transition-all',
    primary: 'bg-primary-500 text-white hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/20',
    accent: 'bg-accent-500 text-white hover:bg-accent-600 transition-all shadow-lg shadow-accent-500/20',
    secondary: 'bg-muted text-foreground hover:bg-muted transition-all border border-border',
  };

  return (
    <div
      className={cn(
        'relative rounded-xl p-8 flex flex-col transition-all duration-300',
        plan.isPopular
          ? 'bg-muted border-2 border-accent-500/50 shadow-xl shadow-accent-500/10 ring-1 ring-accent-500/20'
          : 'bg-card border border-border hover:border-border',
      )}
    >
      {plan.isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-500 px-4 py-1 text-xs font-semibold text-white shadow-md shadow-accent-500/30">
            <Sparkles className="h-3 w-3" />
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <div className={cn('inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4', plan.isPopular ? 'bg-accent-500/20 text-accent-400' : 'bg-primary-500/10 text-primary-500')}>
          <config.icon className="h-5 w-5" />
        </div>
        <h3 className="text-xl font-bold text-foreground font-display">{plan.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-foreground font-mono">{'\u20B9'}{formatPrice(price)}</span>
          <span className="text-sm text-muted-foreground">{period}</span>
        </div>
        {isYearly && plan.yearlyPrice > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {'\u20B9'}{formatPrice(Math.round(plan.yearlyPrice / 12))}/mo billed annually
          </p>
        )}
        {plan.monthlyPrice > 0 && (
          <p className="text-xs text-muted-foreground mt-1">+ 18% GST</p>
        )}
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature) => (
          <li key={feature.label} className="flex items-start gap-2.5">
            {feature.included ? (
              <Check className="h-4 w-4 mt-0.5 text-accent-500 shrink-0" />
            ) : (
              <X className="h-4 w-4 mt-0.5 text-muted-foreground/60 shrink-0" />
            )}
            <span className={cn('text-sm', feature.included ? 'text-foreground/80' : 'text-muted-foreground/60')}>
              {feature.label}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={config.ctaHref}
        className={cn('w-full inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold', ctaClasses[config.ctaVariant])}
      >
        {config.cta}
      </Link>
    </div>
  );
}

function ComparisonAccordion({ categories }: { categories: ComparisonCategory[] }) {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (name: string) => {
    setOpenCategories((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="space-y-3">
      {categories.map((category) => {
        const isOpen = openCategories[category.name] ?? false;
        return (
          <div key={category.name} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleCategory(category.name)}
              className="flex items-center justify-between w-full px-6 py-4 text-left hover:bg-muted/50 transition-colors"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-foreground">{category.name}</span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200', isOpen && 'rotate-180')} />
            </button>
            <div className={cn('overflow-hidden transition-all duration-300', isOpen ? 'max-h-[800px]' : 'max-h-0')}>
              <div className="px-6 pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 pr-4 font-medium text-muted-foreground min-w-[200px] text-xs uppercase tracking-wider">Feature</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground min-w-[100px] text-xs uppercase tracking-wider">Free</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground min-w-[100px] text-xs uppercase tracking-wider">Starter</th>
                        <th className="text-center py-3 px-4 font-medium text-primary-500 min-w-[100px] text-xs uppercase tracking-wider">Professional</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground min-w-[100px] text-xs uppercase tracking-wider">Enterprise</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.rows.map((row) => (
                        <tr key={row.feature} className="border-b border-border last:border-0">
                          <td className="py-3 pr-4 text-foreground/80 font-medium text-sm">{row.feature}</td>
                          {(['free', 'starter', 'professional', 'enterprise'] as const).map((planKey) => {
                            const val = row[planKey];
                            return (
                              <td key={planKey} className="py-3 px-4 text-center">
                                {val === 'yes' ? (
                                  <Check className="h-4 w-4 text-accent-500 mx-auto" />
                                ) : val === 'no' ? (
                                  <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                                ) : (
                                  <span className="text-foreground font-medium font-mono text-sm">{val}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={idx} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="flex items-center justify-between w-full px-6 py-4 text-left hover:bg-muted/50 transition-colors"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-foreground pr-4">{item.question}</span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200', isOpen && 'rotate-180')} />
            </button>
            <div className={cn('overflow-hidden transition-all duration-200', isOpen ? 'max-h-96' : 'max-h-0')}>
              <div className="px-6 pb-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await api.get('/plans');
        const data = res.data?.data;
        if (Array.isArray(data)) {
          setPlans(data);
        }
      } catch {
        // Use fallback — page still renders with empty state
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const comparison = buildComparison(plans);

  return (
    <div className="bg-background min-h-screen">
      {/* Hero */}
      <section className="pt-32 pb-16 md:pb-20 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary-500/[0.04] rounded-full blur-[120px]" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-muted border border-muted rounded-full px-4 py-1.5 mb-6">
            <CreditCard className="w-3.5 h-3.5 text-primary-500" />
            <span className="text-overline text-foreground/80 uppercase tracking-widest">Pricing</span>
          </div>
          <h1 className="text-display-md md:text-display-lg lg:text-display-xl font-display text-foreground mb-4 tracking-tight">
            Simple, transparent pricing
          </h1>
          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Choose the plan that fits your business. Start free and upgrade as you grow.
            All prices exclusive of 18% GST. Cancel anytime.
          </p>
          <BillingToggle isYearly={isYearly} onToggle={() => setIsYearly((prev) => !prev)} />
        </div>
      </section>

      {/* Pricing cards */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <PricingCard key={plan.id} plan={plan} isYearly={isYearly} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Feature comparison accordion */}
      {comparison.length > 0 && (
        <section className="py-24 bg-card border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <p className="text-overline uppercase tracking-widest text-primary-500 mb-3">Comparison</p>
              <h2 className="text-display-md md:text-display-lg font-display text-foreground mb-4">Compare all features</h2>
              <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
                A detailed comparison of everything included in each plan
              </p>
            </div>
            <div className="max-w-5xl mx-auto">
              <ComparisonAccordion categories={comparison} />
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-24 bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-overline uppercase tracking-widest text-primary-500 mb-3">FAQ</p>
            <h2 className="text-display-md md:text-display-lg font-display text-foreground mb-4">Frequently asked questions</h2>
            <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about billing and subscriptions
            </p>
          </div>
          <div className="max-w-3xl mx-auto">
            <FaqAccordion />
          </div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="py-12 bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <span className="text-sm font-medium">Trusted by 15,000+ businesses</span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <span className="text-sm font-medium">SSL encrypted &amp; secure</span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="text-sm font-medium">Razorpay verified merchant</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-display-md md:text-display-lg font-display text-foreground mb-4">
            Ready to win more tenders?
          </h2>
          <p className="text-body-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of businesses using TenderBazaar to discover and bid on
            government contracts across India.
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center justify-center rounded-xl bg-primary-500 px-8 py-3.5 text-base font-semibold text-white hover:bg-primary-600 transition-all shadow-glow hover:shadow-[0_0_30px_rgba(255,107,53,0.25)] gap-2"
          >
            Get started for free
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </div>
  );
}
