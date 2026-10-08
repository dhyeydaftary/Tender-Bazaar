'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Brain,
  Bell,
  Globe,
  Trophy,
  Download,
  Smartphone,
  Building2,
  TrendingUp,
  Check,
  X as XIcon,
  ChevronRight,
  ArrowRight,
  Star,
  Play,
  Shield,
  CreditCard,
  Clock,
  FileText,
  Map,
  Sparkles,
  Zap,
  BarChart3,
  Users,
  ChevronDown,
  Mail,
  Phone,
  Wifi,
  MessageCircle,
  MapPin,
  IndianRupee,
  Wrench,
  Package,
  Settings,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import { cn, formatIndianNumber } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════════════════ */

function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, inView };
}

function useCounter(target: number, duration = 2000, start = false) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;
    let raf: number;
    const t0 = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);

  return value;
}

function useTypingEffect(phrases: string[], typingSpeed = 60, pauseMs = 2500) {
  const [text, setText] = useState('');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = phrases[phraseIdx];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && charIdx < phrase.length) {
      timeout = setTimeout(() => {
        setText(phrase.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
      }, typingSpeed);
    } else if (!deleting && charIdx === phrase.length) {
      timeout = setTimeout(() => setDeleting(true), pauseMs);
    } else if (deleting && charIdx > 0) {
      timeout = setTimeout(() => {
        setText(phrase.slice(0, charIdx - 1));
        setCharIdx((c) => c - 1);
      }, typingSpeed / 2);
    } else if (deleting && charIdx === 0) {
      setDeleting(false);
      setPhraseIdx((i) => (i + 1) % phrases.length);
    }

    return () => clearTimeout(timeout);
  }, [charIdx, deleting, phraseIdx, phrases, typingSpeed, pauseMs]);

  return text;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════════════════ */

const SEARCH_PHRASES = [
  'Road construction tenders in Gujarat',
  'IT services tenders above 1 Crore',
  'MSME reserved tenders in Maharashtra',
  'Solar energy tenders near Delhi',
  'Medical equipment supply for AIIMS',
];

const TICKER_ITEMS = [
  { title: 'Supply of Medical Equipment', org: 'AIIMS Delhi', value: '2.4 Cr' },
  { title: 'Highway Construction NH-48', org: 'NHAI Gujarat', value: '345 Cr' },
  { title: 'IT Infrastructure Setup', org: 'NIC, MeitY', value: '12.8 Cr' },
  { title: 'Solar Panel Installation', org: 'NTPC Rajasthan', value: '89 Cr' },
  { title: 'School Building Renovation', org: 'PWD Karnataka', value: '5.6 Cr' },
  { title: 'Water Treatment Plant', org: 'CMWSSB Chennai', value: '234 Cr' },
  { title: 'Smart City Portal Dev', org: 'Jaipur Smart City', value: '4.2 Cr' },
  { title: 'Security Services', org: 'CRPF Delhi', value: '18 Cr' },
];

const FEATURES = [
  {
    icon: Brain,
    title: 'AI Eligibility Engine',
    description:
      'Know your chances before you bid. Our AI analyzes 15+ criteria including turnover, experience, certifications, and MSME status against every tender requirement.',
    large: true,
    accent: 'from-primary-500/20 to-transparent',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    description:
      'Get notified instantly via Email, WhatsApp, SMS, or Push when matching tenders are published. Never miss a deadline.',
    accent: 'from-accent-500/20 to-transparent',
  },
  {
    icon: Globe,
    title: '50+ Portal Coverage',
    description:
      'GeM, CPPP, eProcure, and every state e-procurement portal. One search across all of India.',
    accent: 'from-blue-500/20 to-transparent',
  },
  {
    icon: Trophy,
    title: 'Tender Results',
    description:
      'Track awarded tenders, analyze winners, and learn from competition.',
    accent: 'from-amber-500/20 to-transparent',
  },
  {
    icon: Download,
    title: 'Document Downloads',
    description:
      'Download NITs, BOQs, and tender documents with one click.',
    accent: 'from-emerald-500/20 to-transparent',
  },
  {
    icon: Smartphone,
    title: 'Mobile App',
    description:
      'Full-featured iOS and Android app. Manage tenders on the go.',
    accent: 'from-purple-500/20 to-transparent',
  },
];

const STEPS = [
  {
    num: '01',
    icon: Building2,
    title: 'Complete your company profile',
    description:
      'Add your turnover, certifications, and experience details. Takes just 5 minutes.',
  },
  {
    num: '02',
    icon: Bell,
    title: 'Set up smart alerts',
    description:
      'Define keywords, categories, states, and value ranges. Get notified across all channels.',
  },
  {
    num: '03',
    icon: Trophy,
    title: 'Win tenders with AI insights',
    description:
      'Check eligibility scores, compare opportunities, and bid with confidence.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'TenderBazaar saved us 15 hours per week that we used to spend checking different government portals. The AI eligibility check is a game-changer.',
    name: 'Rajesh Patel',
    company: 'Patel Construction Pvt. Ltd.',
    role: 'Director',
    rating: 5,
  },
  {
    quote:
      'We won 3 new government contracts in the first 2 months. The smart alerts ensured we never missed an opportunity in our category.',
    name: 'Priya Sharma',
    company: 'TechVista Solutions',
    role: 'CEO',
    rating: 5,
  },
  {
    quote:
      'As an MSME, finding the right tenders was always a challenge. TenderBazaar filters specifically for MSME-reserved opportunities. Brilliant product.',
    name: 'Amit Desai',
    company: 'GreenLeaf Pharmaceuticals',
    role: 'Managing Director',
    rating: 5,
  },
];

const PLANS = [
  {
    name: 'Free',
    monthly: 0,
    yearly: 0,
    description: 'For individuals exploring tenders',
    features: [
      '5 tender views/day',
      '1 smart alert',
      '1 AI eligibility check (total)',
      'Basic search',
      'Email notifications',
    ],
    notIncluded: ['Document downloads', 'WhatsApp alerts', 'API access', 'Priority support'],
    popular: false,
    cta: 'Start Free',
  },
  {
    name: 'Starter',
    monthly: 1499,
    yearly: 14999,
    description: 'For small businesses',
    features: [
      '50 tender views/day',
      '5 smart alerts',
      '5 AI checks/month',
      'Advanced search & filters',
      'Email + Push notifications',
      'Document downloads',
    ],
    notIncluded: ['WhatsApp alerts', 'API access', 'Priority support'],
    popular: false,
    cta: 'Get Started',
  },
  {
    name: 'Professional',
    monthly: 4999,
    yearly: 49999,
    description: 'For growing businesses',
    features: [
      'Unlimited tender views',
      '20 smart alerts',
      '50 AI checks/month',
      'Advanced search & filters',
      'All notification channels',
      'Document downloads',
      'Bid assistant',
      'Tender comparison',
    ],
    notIncluded: ['API access'],
    popular: true,
    cta: 'Start Pro Trial',
  },
  {
    name: 'Enterprise',
    monthly: 14999,
    yearly: 149999,
    description: 'For large organizations',
    features: [
      'Unlimited everything',
      'Unlimited smart alerts',
      'Unlimited AI checks',
      'All notification channels',
      'API access',
      'Priority support',
      'Dedicated account manager',
      'Custom integrations',
    ],
    notIncluded: [],
    popular: false,
    cta: 'Contact Sales',
  },
];

// ─── Latest Tenders (Public showcase) ──────────────────────────────────────

type TenderCategory = 'Works' | 'Goods' | 'Services' | 'Consultancy';

const CATEGORY_COLORS: Record<TenderCategory, { badge: string; border: string; icon: string }> = {
  Works: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    border: 'border-l-red-500',
    icon: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  },
  Goods: {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    border: 'border-l-blue-500',
    icon: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  },
  Services: {
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    border: 'border-l-teal-500',
    icon: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  },
  Consultancy: {
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    border: 'border-l-purple-500',
    icon: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  },
};

const CATEGORY_ICONS: Record<TenderCategory, typeof Wrench> = {
  Works: Wrench,
  Goods: Package,
  Services: Settings,
  Consultancy: Briefcase,
};

interface LatestTender {
  id: string;
  title: string;
  organization: string;
  category: TenderCategory;
  state: string;
  location: string;
  estimatedValue: number;
  deadline: string;
  publishedDate: string;
}

const LATEST_TENDERS: LatestTender[] = [
  {
    id: 'TND-2026-001',
    title: 'Construction of 4-Lane Highway NH-48 Bypass Road (Pkg-III)',
    organization: 'National Highways Authority of India (NHAI)',
    category: 'Works',
    state: 'Gujarat',
    location: 'Ahmedabad',
    estimatedValue: 245_00_00_000,
    deadline: '2026-04-18',
    publishedDate: '2026-04-10',
  },
  {
    id: 'TND-2026-002',
    title: 'Supply of 500 Desktop Computers and Peripherals for District Offices',
    organization: 'Maharashtra State Electronics Development Corporation',
    category: 'Goods',
    state: 'Maharashtra',
    location: 'Mumbai',
    estimatedValue: 3_20_00_000,
    deadline: '2026-04-22',
    publishedDate: '2026-04-10',
  },
  {
    id: 'TND-2026-003',
    title: 'Annual Maintenance Contract for Smart City IoT Infrastructure',
    organization: 'Bengaluru Smart City Limited',
    category: 'Services',
    state: 'Karnataka',
    location: 'Bengaluru',
    estimatedValue: 8_50_00_000,
    deadline: '2026-04-30',
    publishedDate: '2026-04-11',
  },
  {
    id: 'TND-2026-004',
    title: 'Consultancy for DPR - Metro Line Extension Phase II',
    organization: 'Chennai Metro Rail Limited',
    category: 'Consultancy',
    state: 'Tamil Nadu',
    location: 'Chennai',
    estimatedValue: 12_00_00_000,
    deadline: '2026-05-05',
    publishedDate: '2026-04-11',
  },
  {
    id: 'TND-2026-005',
    title: 'Construction of 200-Bed District Hospital Building with Equipment',
    organization: 'UP Medical Supplies Corporation',
    category: 'Works',
    state: 'Uttar Pradesh',
    location: 'Lucknow',
    estimatedValue: 78_00_00_000,
    deadline: '2026-04-16',
    publishedDate: '2026-04-09',
  },
  {
    id: 'TND-2026-006',
    title: 'Procurement of Solar Panels (50MW) for Government Buildings',
    organization: 'Rajasthan Renewable Energy Corporation',
    category: 'Goods',
    state: 'Rajasthan',
    location: 'Jaipur',
    estimatedValue: 42_00_00_000,
    deadline: '2026-04-25',
    publishedDate: '2026-04-11',
  },
  {
    id: 'TND-2026-007',
    title: 'Housekeeping & Facility Management Services for Secretariat Complex',
    organization: 'General Administration Department, Delhi',
    category: 'Services',
    state: 'Delhi',
    location: 'New Delhi',
    estimatedValue: 6_80_00_000,
    deadline: '2026-05-10',
    publishedDate: '2026-04-10',
  },
  {
    id: 'TND-2026-008',
    title: 'EIA Study & Environmental Clearance for Industrial Corridor',
    organization: 'DMIC Development Corporation',
    category: 'Consultancy',
    state: 'Madhya Pradesh',
    location: 'Indore',
    estimatedValue: 4_50_00_000,
    deadline: '2026-04-20',
    publishedDate: '2026-04-09',
  },
];

const BROWSE_CATEGORIES = [
  {
    name: 'Works',
    count: '18,420',
    description: 'Construction, roads, bridges, buildings, and infrastructure projects',
    icon: Wrench,
    color: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    borderHover: 'hover:border-red-500/40',
    href: '/explore-tenders/category/works',
  },
  {
    name: 'Goods',
    count: '12,850',
    description: 'Equipment, materials, electronics, medical devices, and supplies',
    icon: Package,
    color: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderHover: 'hover:border-blue-500/40',
    href: '/explore-tenders/category/goods',
  },
  {
    name: 'Services',
    count: '11,340',
    description: 'IT services, consulting, maintenance, staffing, and operations',
    icon: Settings,
    color: 'bg-teal-100 dark:bg-teal-900/30',
    iconColor: 'text-teal-600 dark:text-teal-400',
    borderHover: 'hover:border-teal-500/40',
    href: '/explore-tenders/category/services',
  },
  {
    name: 'Consultancy',
    count: '8,190',
    description: 'Technical studies, surveys, DPR, environmental and financial advisory',
    icon: Briefcase,
    color: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
    borderHover: 'hover:border-purple-500/40',
    href: '/explore-tenders/category/consultancy',
  },
];

function formatTenderValue(value: number): string {
  if (value >= 1_00_00_000) {
    const crores = value / 1_00_00_000;
    return `₹${crores % 1 === 0 ? crores.toFixed(0) : crores.toFixed(1)} Cr`;
  }
  if (value >= 1_00_000) {
    const lakhs = value / 1_00_000;
    return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(1)} L`;
  }
  return `₹${value.toLocaleString('en-IN')}`;
}

function getTenderDaysLeft(deadline: string): number {
  const now = new Date();
  const dl = new Date(deadline);
  return Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getDeadlineColor(daysLeft: number): string {
  if (daysLeft <= 0) return 'text-muted-foreground';
  if (daysLeft < 7) return 'text-red-600 dark:text-red-400';
  if (daysLeft < 14) return 'text-amber-600 dark:text-amber-400';
  return 'text-green-600 dark:text-green-400';
}

const STATES_DATA = [
  { name: 'Gujarat', tenders: 3847 },
  { name: 'Maharashtra', tenders: 5234 },
  { name: 'Karnataka', tenders: 4123 },
  { name: 'Tamil Nadu', tenders: 3890 },
  { name: 'Rajasthan', tenders: 3456 },
  { name: 'Delhi', tenders: 2890 },
  { name: 'Uttar Pradesh', tenders: 4567 },
  { name: 'Madhya Pradesh', tenders: 2345 },
  { name: 'West Bengal', tenders: 1890 },
  { name: 'Kerala', tenders: 2134 },
  { name: 'Telangana', tenders: 2567 },
  { name: 'Andhra Pradesh', tenders: 1987 },
  { name: 'Punjab', tenders: 1654 },
  { name: 'Haryana', tenders: 1432 },
  { name: 'Bihar', tenders: 1234 },
  { name: 'Odisha', tenders: 1567 },
  { name: 'Jharkhand', tenders: 987 },
  { name: 'Assam', tenders: 876 },
  { name: 'Chhattisgarh', tenders: 1123 },
  { name: 'Uttarakhand', tenders: 765 },
];

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function SectionHeader({
  overline,
  title,
  subtitle,
  center = true,
}: {
  overline?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div className={cn('max-w-3xl mb-12 lg:mb-16', center && 'mx-auto text-center')}>
      {overline && (
        <p className="text-overline uppercase tracking-widest text-primary-500 mb-3">{overline}</p>
      )}
      <h2 className="text-display-md md:text-display-lg text-foreground font-display mb-4">
        {title}
      </h2>
      {subtitle && (
        <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
      )}
    </div>
  );
}

function StatCounter({
  target,
  label,
  suffix = '',
  prefix = '',
  start,
}: {
  target: number;
  label: string;
  suffix?: string;
  prefix?: string;
  start: boolean;
}) {
  const count = useCounter(target, 2000, start);
  return (
    <div className="text-center">
      <div className="text-display-sm md:text-display-md font-mono text-foreground font-bold tracking-tight">
        {prefix}
        {formatIndianNumber(count)}
        {suffix}
      </div>
      <div className="text-caption text-muted-foreground mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  const [yearlyBilling, setYearlyBilling] = useState(true);
  const statsView = useInView(0.2);
  const featuresView = useInView(0.1);
  const stepsView = useInView(0.1);
  const pricingView = useInView(0.1);
  const statesView = useInView(0.1);

  const typedText = useTypingEffect(SEARCH_PHRASES, 50, 2000);

  return (
    <>
      {/* ═══════════ HERO SECTION ═══════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-background via-background to-muted/30">
        {/* Animated background elements */}
        <div className="absolute inset-0 bg-subtle-grid opacity-40" />
        {/* Radial glow top-center */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-b from-primary-500/[0.08] to-transparent rounded-full blur-[100px]" />
        {/* Radial glow bottom-left */}
        <div className="absolute bottom-[10%] left-[-5%] w-[400px] h-[400px] bg-accent-500/[0.06] rounded-full blur-[80px]" />
        {/* Radial glow right */}
        <div className="absolute top-[30%] right-[-5%] w-[350px] h-[350px] bg-primary-500/[0.04] rounded-full blur-[80px]" />

        {/* Floating stat cards — decorative, desktop only */}
        <div className="hidden lg:block absolute top-[22%] left-[6%] animate-float" style={{ animationDelay: '0s' }}>
          <div className="bg-card/90 backdrop-blur-sm border border-border rounded-xl px-4 py-3 shadow-elevated">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-accent-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">New Today</p>
                <p className="text-sm font-bold font-mono text-foreground">+3,247</p>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:block absolute top-[18%] right-[7%] animate-float" style={{ animationDelay: '1s' }}>
          <div className="bg-card/90 backdrop-blur-sm border border-border rounded-xl px-4 py-3 shadow-elevated">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
                <Brain className="w-4 h-4 text-primary-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AI Match Score</p>
                <p className="text-sm font-bold font-mono text-foreground">87%</p>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:block absolute bottom-[28%] left-[8%] animate-float" style={{ animationDelay: '2s' }}>
          <div className="bg-card/90 backdrop-blur-sm border border-border rounded-xl px-4 py-3 shadow-elevated">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Portals Tracked</p>
                <p className="text-sm font-bold font-mono text-foreground">50+</p>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:block absolute bottom-[25%] right-[6%] animate-float" style={{ animationDelay: '1.5s' }}>
          <div className="bg-card/90 backdrop-blur-sm border border-border rounded-xl px-4 py-3 shadow-elevated">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Bell className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Alerts Sent</p>
                <p className="text-sm font-bold font-mono text-foreground">24/7</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-32 pb-16">
          {/* Overline badge */}
          <div className="inline-flex items-center gap-2 bg-primary-500/[0.08] border border-primary-500/20 rounded-full px-5 py-2 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
            </span>
            <span className="text-overline text-primary-600 dark:text-primary-400 uppercase tracking-widest font-semibold">
              India&apos;s #1 Tender Intelligence Platform
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-display-xl md:text-display-2xl font-display mb-6 leading-[1.05]">
            <span className="text-foreground">Find. Analyze.</span>{' '}
            <span className="relative">
              <span className="text-gradient-brand">Win.</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 120 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 6C20 2 40 2 60 4C80 6 100 3 118 2" stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" className="opacity-30" />
              </svg>
            </span>
          </h1>

          {/* Subline */}
          <p className="text-body-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-powered tender discovery across{' '}
            <span className="text-foreground font-semibold">50,000+</span> government
            opportunities. Know your eligibility{' '}
            <span className="text-foreground font-semibold">before</span> you bid.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-5">
            <Link
              href="/register"
              className="group relative bg-primary-500 hover:bg-primary-600 text-white px-8 py-4 rounded-xl text-base font-semibold transition-all duration-300 shadow-glow hover:shadow-[0_0_40px_rgba(255,107,53,0.3)] flex items-center gap-2.5 overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2.5">
                Start Free — No Credit Card
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </Link>
            <button className="group text-foreground hover:text-foreground px-6 py-4 rounded-xl text-base font-medium transition-all duration-200 border border-border hover:border-primary-500/30 hover:bg-primary-500/5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center group-hover:bg-primary-500/20 transition-colors">
                <Play className="w-3.5 h-3.5 text-primary-500 ml-0.5" />
              </div>
              Watch Demo
            </button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-caption text-muted-foreground mb-12">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-accent-500" />
              Free forever plan
            </span>
            <span className="w-1 h-1 rounded-full bg-border hidden sm:block" />
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-accent-500" />
              No credit card required
            </span>
            <span className="w-1 h-1 rounded-full bg-border hidden sm:block" />
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-accent-500" />
              Setup in 2 minutes
            </span>
          </div>

          {/* ── Live Search Bar ─────────────────────────────────────── */}
          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary-500/20 via-accent-500/15 to-primary-500/20 rounded-2xl blur-md opacity-50 group-hover:opacity-80 transition-opacity duration-500" />
              <div className="relative bg-card border border-border rounded-2xl flex items-center px-5 py-4 shadow-elevated">
                <Search className="w-5 h-5 text-primary-500 shrink-0" />
                <div className="flex-1 ml-3 text-left">
                  <span className="text-muted-foreground text-body-md">
                    {typedText}
                    <span className="inline-block w-0.5 h-5 bg-primary-500 ml-0.5 animate-pulse align-text-bottom" />
                  </span>
                </div>
                <Link
                  href="/explore-tenders"
                  className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-glow shrink-0 ml-3 flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  Search
                </Link>
              </div>
            </div>
            {/* Popular searches */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">Trending:</span>
              {['Road Construction', 'IT Services', 'Medical Equipment', 'Solar Energy'].map((tag) => (
                <Link
                  key={tag}
                  href={`/explore-tenders?q=${encodeURIComponent(tag)}`}
                  className="text-xs px-2.5 py-1 rounded-full bg-muted/70 text-muted-foreground hover:text-primary-500 hover:bg-primary-500/5 transition-all border border-transparent hover:border-primary-500/20"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Animated Counter Bar ──────────────────────────────────── */}
        <div ref={statsView.ref} className="relative z-10 w-full">
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-card/80 border border-border rounded-xl p-4 text-center shadow-card hover-lift transition-all">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2 text-primary-500 bg-primary-500/10">
                  <FileText className="w-4 h-4" />
                </div>
                <StatCounter target={52438} label="Active Tenders" start={statsView.inView} />
              </div>
              <div className="bg-card/80 border border-border rounded-xl p-4 text-center shadow-card hover-lift transition-all">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2 text-blue-500 bg-blue-500/10">
                  <Map className="w-4 h-4" />
                </div>
                <StatCounter target={28} label="States Covered" start={statsView.inView} />
              </div>
              <div className="bg-card/80 border border-border rounded-xl p-4 text-center shadow-card hover-lift transition-all">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2 text-accent-500 bg-accent-500/10">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <StatCounter target={3500} label="New Daily" suffix="+" start={statsView.inView} />
              </div>
              <div className="bg-card/80 border border-border rounded-xl p-4 text-center shadow-card hover-lift transition-all">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2 text-purple-500 bg-purple-500/10">
                  <Users className="w-4 h-4" />
                </div>
                <StatCounter target={15000} label="Businesses Trust Us" suffix="+" start={statsView.inView} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ LIVE TICKER ═══════════ */}
      <section className="bg-card border-y border-border overflow-hidden relative">
        <div className="mask-fade-x py-3">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 mx-6 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse" />
                <span className="text-muted-foreground">{item.title}</span>
                <span className="text-muted-foreground/60">—</span>
                <span className="text-muted-foreground">{item.org}</span>
                <span className="text-muted-foreground/60">—</span>
                <span className="text-foreground font-mono font-medium">₹{item.value}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ LATEST TENDERS — PUBLIC ═══════════ */}
      <section className="py-20 lg:py-28 bg-background relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-overline uppercase tracking-widest text-primary-500 mb-3">
                Fresh Opportunities
              </p>
              <h2 className="text-display-md md:text-display-lg text-foreground font-display">
                Latest Tenders
              </h2>
              <p className="text-body-md text-muted-foreground mt-2 max-w-xl">
                Published today from government portals across India. Updated every 30 minutes.
              </p>
            </div>
            <Link
              href="/explore-tenders"
              className="hidden sm:flex items-center gap-2 text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors"
            >
              View All Tenders
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Tender Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {LATEST_TENDERS.map((tender) => {
              const daysLeft = getTenderDaysLeft(tender.deadline);
              const colors = CATEGORY_COLORS[tender.category];

              return (
                <div
                  key={tender.id}
                  className={cn(
                    'group bg-card border border-border rounded-xl p-5 shadow-card hover-lift transition-all border-l-4 cursor-pointer',
                    colors.border
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Category & ID */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', colors.badge)}>
                          {tender.category}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">{tender.id}</span>
                        <span className="text-xs text-muted-foreground">· {tender.publishedDate}</span>
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-foreground text-sm leading-snug mb-1.5 line-clamp-2 group-hover:text-primary-500 transition-colors">
                        {tender.title}
                      </h3>

                      {/* Organization */}
                      <p className="text-xs text-muted-foreground mb-3 truncate">
                        {tender.organization}
                      </p>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {tender.state}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                          <IndianRupee className="h-3 w-3" />
                          {formatTenderValue(tender.estimatedValue).replace('₹', '')}
                        </span>
                        <span className={cn('inline-flex items-center gap-1 text-xs font-medium', getDeadlineColor(daysLeft))}>
                          <Clock className="h-3 w-3" />
                          {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
                        </span>
                      </div>
                    </div>

                    {/* View Details arrow */}
                    <Link
                      href="/login"
                      className="shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary-500 group-hover:text-white transition-all"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile "View All" link */}
          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/explore-tenders"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary-500"
            >
              View All Tenders
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Teaser strip */}
          <div className="mt-8 bg-muted/50 border border-border rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  3,500+ new tenders added daily
                </p>
                <p className="text-xs text-muted-foreground">
                  Sign up for free to get personalized alerts matching your business
                </p>
              </div>
            </div>
            <Link
              href="/register"
              className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-2"
            >
              Get Free Alerts
              <Bell className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ BROWSE BY CATEGORY ═══════════ */}
      <section className="py-20 lg:py-28 bg-card relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            overline="Categories"
            title="Browse tenders by category"
            subtitle="Find opportunities in your industry. Each category aggregates from all 50+ government portals."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {BROWSE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.name}
                  href={cat.href}
                  className={cn(
                    'group relative bg-card border border-border rounded-xl p-6 shadow-card hover-lift transition-all overflow-hidden',
                    cat.borderHover
                  )}
                >
                  {/* Subtle gradient on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-muted/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative z-10">
                    <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110', cat.color)}>
                      <Icon className={cn('h-7 w-7', cat.iconColor)} />
                    </div>

                    <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-primary-500 transition-colors">
                      {cat.name} Tenders
                    </h3>

                    <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                      {cat.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-foreground bg-muted px-2.5 py-1 rounded-full">
                        {cat.count} active
                      </span>
                      <span className="text-xs font-medium text-primary-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Explore
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Quick links row */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm text-muted-foreground">Popular:</span>
            {[
              { label: 'Road Construction', href: '/explore-tenders?q=road+construction' },
              { label: 'IT Services', href: '/explore-tenders?q=IT+services' },
              { label: 'Medical Equipment', href: '/explore-tenders?q=medical+equipment' },
              { label: 'Solar Energy', href: '/explore-tenders?q=solar+energy' },
              { label: 'MSME Reserved', href: '/explore-tenders?q=MSME' },
              { label: 'GeM Tenders', href: '/explore-tenders?q=GeM' },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:border-primary-500/30 hover:bg-primary-500/5 transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PRODUCT SHOWCASE ═══════════ */}
      <section className="py-24 lg:py-32 bg-background relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            overline="Product"
            title="One platform. Every tender."
            subtitle="Stop visiting 50 government websites. We bring every opportunity to you, organized and searchable in seconds."
          />

          {/* Browser Mockup */}
          <div className="max-w-5xl mx-auto">
            <div className="bg-card rounded-xl border border-border shadow-xl overflow-hidden">
              {/* Browser Chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/80">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-muted rounded-md px-3 py-1 text-xs text-muted-foreground font-mono max-w-sm mx-auto text-center">
                    app.tenderbazaar.com/dashboard
                  </div>
                </div>
              </div>

              {/* Dashboard Preview */}
              <div className="p-6 bg-gradient-to-b from-muted/30 to-muted/50">
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'New Today', value: '1,247', change: '+12%', changeColor: 'text-accent-600', icon: '📈' },
                    { label: 'Active Tenders', value: '52,438', change: '+324', changeColor: 'text-accent-600', icon: '📋' },
                    { label: 'Saved', value: '23', change: '5 expiring', changeColor: 'text-amber-600', icon: '⭐' },
                    { label: 'AI Score', value: '74%', change: 'avg match', changeColor: 'text-muted-foreground', icon: '🤖' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-caption text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                        <span className="text-sm">{stat.icon}</span>
                      </div>
                      <p className="text-heading-lg font-mono text-foreground">{stat.value}</p>
                      <p className={cn('text-caption mt-0.5 font-medium', stat.changeColor)}>{stat.change}</p>
                    </div>
                  ))}
                </div>

                {/* Mock Tender List */}
                <div className="space-y-2.5">
                  {[
                    { cat: 'WORKS', catColor: 'bg-red-100 text-red-700', borderColor: 'border-l-red-500', title: 'Construction of 4-Lane Highway NH-48 Junction', org: 'NHAI, Gujarat', value: '₹3,739 Cr', days: '12d', daysColor: 'text-green-600' },
                    { cat: 'GOODS', catColor: 'bg-blue-100 text-blue-700', borderColor: 'border-l-blue-500', title: 'Supply of Desktop Computers for Schools', org: 'CSC SPV, MeitY', value: '₹12.8 Cr', days: '5d', daysColor: 'text-amber-600' },
                    { cat: 'SERVICES', catColor: 'bg-teal-100 text-teal-700', borderColor: 'border-l-teal-500', title: 'Cloud Infrastructure Services for NIC', org: 'NIC, Delhi', value: '₹89.2 Cr', days: '2d', daysColor: 'text-red-600' },
                  ].map((t) => (
                    <div key={t.title} className={cn('flex items-center gap-4 bg-card border border-border rounded-xl p-3.5 hover:shadow-card-hover transition-all cursor-pointer border-l-[3px]', t.borderColor)}>
                      <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0', t.catColor)}>
                        {t.cat}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{t.org}</p>
                      </div>
                      <span className="text-sm font-mono text-foreground font-semibold shrink-0 hidden sm:block">{t.value}</span>
                      <span className={cn('text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full bg-muted', t.daysColor)}>{t.days}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES — BENTO GRID ═══════════ */}
      <section id="features" className="py-24 lg:py-32 bg-card relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            overline="Features"
            title="Built for serious bidders"
            subtitle="Every tool you need to find, qualify, and win government contracts."
          />

          <div ref={featuresView.ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={cn(
                    'group relative bg-card/50 border border-border rounded-xl p-6 lg:p-8 transition-all duration-300 hover:border-primary-500/20 hover:bg-card/80',
                    f.large && 'md:col-span-2 lg:col-span-2',
                    featuresView.inView && 'animate-slide-up',
                  )}
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}
                >
                  {/* Gradient accent on hover */}
                  {f.accent && (
                    <div className={cn('absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500', f.accent)} />
                  )}

                  <div className="relative z-10">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:bg-primary-500/10 transition-colors">
                      <Icon className="w-5 h-5 text-primary-500" />
                    </div>
                    <h3 className="text-heading-md text-foreground mb-2 font-display">{f.title}</h3>
                    <p className="text-body-sm text-muted-foreground leading-relaxed">{f.description}</p>

                    {f.large && (
                      <div className="mt-6 flex flex-wrap gap-2">
                        {['Turnover Analysis', 'Certification Match', 'Experience Check', 'MSME Eligibility', 'EMD Calculation'].map((tag) => (
                          <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="py-24 lg:py-32 bg-background relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            overline="How It Works"
            title="Three steps to winning"
            subtitle="From sign-up to your first bid in under 10 minutes."
          />

          <div ref={stepsView.ref} className="relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary-500/30 via-accent-500/30 to-transparent" />

            <div className="space-y-12 md:space-y-0 md:grid md:grid-cols-3 md:gap-8">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.num}
                    className={cn(
                      'relative text-center',
                      stepsView.inView && 'animate-slide-up',
                    )}
                    style={{ animationDelay: `${i * 200}ms`, animationFillMode: 'backwards' }}
                  >
                    {/* Number behind */}
                    <span className="text-[5rem] font-display font-extrabold text-foreground/[0.03] absolute -top-4 left-1/2 -translate-x-1/2 select-none pointer-events-none">
                      {step.num}
                    </span>
                    <div className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto mb-5 group-hover:bg-primary-500/10">
                        <Icon className="w-6 h-6 text-primary-500" />
                      </div>
                      <h3 className="text-heading-md text-foreground font-display mb-3">{step.title}</h3>
                      <p className="text-body-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section className="py-24 lg:py-32 bg-card relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            overline="Testimonials"
            title="Trusted by businesses across India"
            subtitle="Hear from companies that transformed their tendering process with TenderBazaar."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className="bg-card/50 border border-border rounded-xl p-6 lg:p-8 hover:border-border transition-all duration-300"
              >
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-primary-500 fill-primary-500" />
                  ))}
                </div>
                {/* Quote */}
                <p className="text-body-md text-foreground/80 leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center">
                    <span className="text-sm font-semibold text-foreground">
                      {t.name.split(' ').map((n) => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <p className="text-caption text-muted-foreground">
                      {t.role}, {t.company}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PRICING ═══════════ */}
      <section id="pricing" className="py-24 lg:py-32 bg-background relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            overline="Pricing"
            title="Simple, transparent pricing"
            subtitle="Start free. Upgrade when you're ready. No hidden fees."
          />

          {/* Billing toggle */}
          <div ref={pricingView.ref} className="flex items-center justify-center gap-3 mb-12">
            <span className={cn('text-sm font-medium transition-colors', !yearlyBilling ? 'text-foreground' : 'text-muted-foreground')}>
              Monthly
            </span>
            <button
              onClick={() => setYearlyBilling((y) => !y)}
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                yearlyBilling ? 'bg-primary-500' : 'bg-gray-700',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                  yearlyBilling ? 'translate-x-6' : 'translate-x-0',
                )}
              />
            </button>
            <span className={cn('text-sm font-medium transition-colors', yearlyBilling ? 'text-foreground' : 'text-muted-foreground')}>
              Yearly
            </span>
            {yearlyBilling && (
              <span className="text-xs px-2 py-0.5 bg-accent-500/10 text-accent-500 rounded-full font-medium ml-1">
                Save 17%
              </span>
            )}
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map((plan) => {
              const price = yearlyBilling
                ? Math.round(plan.yearly / 12)
                : plan.monthly;
              return (
                <div
                  key={plan.name}
                  className={cn(
                    'relative rounded-xl p-6 transition-all duration-300',
                    plan.popular
                      ? 'bg-card border-2 border-primary-500/50 shadow-glow scale-[1.02]'
                      : 'bg-card/50 border border-border hover:border-border',
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary-500 text-foreground text-xs font-semibold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <h3 className="text-heading-md text-foreground font-display">{plan.name}</h3>
                  <p className="text-body-sm text-muted-foreground mt-1 mb-4">{plan.description}</p>

                  <div className="mb-6">
                    <span className="text-display-sm font-mono text-foreground font-bold">
                      {price === 0 ? 'Free' : `₹${formatIndianNumber(price)}`}
                    </span>
                    {price > 0 && (
                      <span className="text-body-sm text-muted-foreground">/month</span>
                    )}
                  </div>

                  <Link
                    href={plan.name === 'Enterprise' ? '/contact' : '/register'}
                    className={cn(
                      'block text-center py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 mb-6',
                      plan.popular
                        ? 'bg-primary-500 hover:bg-primary-600 text-foreground shadow-glow'
                        : 'bg-muted hover:bg-white/[0.1] text-foreground border border-border',
                    )}
                  >
                    {plan.cta}
                  </Link>

                  <ul className="space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-accent-500 shrink-0 mt-0.5" />
                        <span className="text-foreground/80">{f}</span>
                      </li>
                    ))}
                    {plan.notIncluded.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <XIcon className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground/60">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Below cards guarantee text */}
          <div className="text-center mt-10">
            <p className="text-body-sm text-muted-foreground">
              All plans include: 24/7 support &middot; 30-day money-back guarantee &middot; GST invoice
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════ STATES COVERAGE ═══════════ */}
      <section className="py-24 lg:py-32 bg-card relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            overline="Coverage"
            title="Covering every state"
            subtitle="Real-time tender aggregation from all major government e-procurement portals across India."
          />

          <div ref={statesView.ref} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {STATES_DATA.map((state, i) => (
              <Link
                key={state.name}
                href={`/explore-tenders?state=${encodeURIComponent(state.name)}`}
                className={cn(
                  'group bg-card/40 border border-border rounded-lg p-4 hover:border-primary-500/30 hover:bg-card/70 transition-all duration-300',
                  statesView.inView && 'animate-scale-in',
                )}
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}
              >
                <p className="text-sm font-medium text-foreground group-hover:text-primary-500 transition-colors">
                  {state.name}
                </p>
                <p className="text-caption text-muted-foreground font-mono mt-0.5">
                  {formatIndianNumber(state.tenders)} tenders
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="py-24 lg:py-32 bg-background relative overflow-hidden">
        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary-500/[0.06] rounded-full blur-[120px]" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-display-md md:text-display-lg text-foreground font-display mb-5">
            Stop missing government contracts.
          </h2>
          <p className="text-body-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Join <span className="text-foreground font-medium">15,000+</span> businesses who use
            TenderBazaar to find and win tenders across India.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 w-full bg-muted border border-border text-foreground text-sm rounded-xl px-4 py-3.5 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
            />
            <Link
              href="/register"
              className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-foreground px-8 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-glow hover:shadow-[0_0_30px_rgba(255,107,53,0.25)] whitespace-nowrap"
            >
              Get Started Free
            </Link>
          </div>
          <p className="text-caption text-muted-foreground mt-4">
            Free forever &middot; No credit card &middot; Setup in 2 minutes
          </p>
        </div>
      </section>
    </>
  );
}
