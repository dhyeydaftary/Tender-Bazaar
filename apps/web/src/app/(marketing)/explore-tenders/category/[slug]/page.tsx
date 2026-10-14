'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useTenderCounts } from '@/lib/hooks/use-tenders';
import {
  HardHat,
  Package,
  Headphones,
  Briefcase,
  ChevronRight,
  Home,
  MapPin,
  Building2,
  Calendar,
  IndianRupee,
  ArrowUpDown,
  Filter,
  Lock,
  ArrowRight,
  Clock,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

// ─── Category Data ────────────────────────────────────────────────────────────

const CATEGORY_DATA: Record<
  string,
  {
    name: string;
    description: string;
    icon: typeof HardHat;
    color: string;
    bgColor: string;
    borderColor: string;
    activeTenders: number;
    newToday: number;
    subcategories: string[];
    tenders: {
      id: string;
      title: string;
      organization: string;
      state: string;
      value: number;
      deadline: string;
      daysLeft: number;
    }[];
  }
> = {
  works: {
    name: 'Works',
    description:
      'Construction, renovation, and infrastructure development tenders from government departments across India.',
    icon: HardHat,
    color: 'text-[#E8593C]',
    bgColor: 'bg-[#E8593C]/10',
    borderColor: 'border-l-[#E8593C]',
    activeTenders: 3842,
    newToday: 127,
    subcategories: [
      'Road Construction',
      'Building Construction',
      'Water Supply',
      'Electrical',
      'Bridge Construction',
      'Renovation',
    ],
    tenders: [
      {
        id: 'W001',
        title: 'Construction of 4-Lane Highway from Jaipur to Ajmer (NH-48)',
        organization: 'National Highways Authority of India',
        state: 'Rajasthan',
        value: 245000000,
        deadline: '2026-04-25',
        daysLeft: 14,
      },
      {
        id: 'W002',
        title: 'Renovation of Government Hospital Building - Phase II',
        organization: 'Public Works Department',
        state: 'Maharashtra',
        value: 18500000,
        deadline: '2026-04-20',
        daysLeft: 9,
      },
      {
        id: 'W003',
        title: 'Water Supply Pipeline Installation in Rural Areas',
        organization: 'Jal Shakti Department',
        state: 'Uttar Pradesh',
        value: 52000000,
        deadline: '2026-04-28',
        daysLeft: 17,
      },
      {
        id: 'W004',
        title: 'Construction of Multi-Level Parking at District Court Complex',
        organization: 'Urban Development Authority',
        state: 'Karnataka',
        value: 35000000,
        deadline: '2026-04-18',
        daysLeft: 7,
      },
      {
        id: 'W005',
        title: 'Bridge Construction Over Yamuna River Near Allahabad',
        organization: 'Ministry of Road Transport',
        state: 'Uttar Pradesh',
        value: 182000000,
        deadline: '2026-05-05',
        daysLeft: 24,
      },
      {
        id: 'W006',
        title: 'Electrical Wiring and Substation Work for New Secretariat',
        organization: 'CPWD',
        state: 'Delhi',
        value: 12000000,
        deadline: '2026-04-22',
        daysLeft: 11,
      },
      {
        id: 'W007',
        title: 'Construction of Primary Health Centres in Tribal Areas',
        organization: 'Ministry of Health',
        state: 'Madhya Pradesh',
        value: 28000000,
        deadline: '2026-04-30',
        daysLeft: 19,
      },
      {
        id: 'W008',
        title: 'Road Resurfacing and Drainage Work in Municipal Limits',
        organization: 'Municipal Corporation',
        state: 'Gujarat',
        value: 8500000,
        deadline: '2026-04-16',
        daysLeft: 5,
      },
    ],
  },
  goods: {
    name: 'Goods',
    description:
      'Procurement of equipment, supplies, and materials by government organizations through competitive bidding.',
    icon: Package,
    color: 'text-[#2563EB]',
    bgColor: 'bg-[#2563EB]/10',
    borderColor: 'border-l-[#2563EB]',
    activeTenders: 5214,
    newToday: 198,
    subcategories: [
      'IT Equipment',
      'Medical Supplies',
      'Office Furniture',
      'Vehicles',
      'Lab Equipment',
      'Stationery',
    ],
    tenders: [
      {
        id: 'G001',
        title: 'Supply of 500 Desktop Computers with Monitors for District Offices',
        organization: 'National Informatics Centre',
        state: 'Tamil Nadu',
        value: 32500000,
        deadline: '2026-04-24',
        daysLeft: 13,
      },
      {
        id: 'G002',
        title: 'Procurement of Medical Equipment for Upgraded CHCs',
        organization: 'Directorate of Health Services',
        state: 'Kerala',
        value: 85000000,
        deadline: '2026-04-19',
        daysLeft: 8,
      },
      {
        id: 'G003',
        title: 'Supply of Modular Office Furniture for New Block Offices',
        organization: 'General Administration Department',
        state: 'Bihar',
        value: 4200000,
        deadline: '2026-04-27',
        daysLeft: 16,
      },
      {
        id: 'G004',
        title: 'Purchase of 50 Electric Buses for City Transport',
        organization: 'State Transport Corporation',
        state: 'Maharashtra',
        value: 150000000,
        deadline: '2026-05-02',
        daysLeft: 21,
      },
      {
        id: 'G005',
        title: 'Lab Equipment for Engineering Colleges Under State University',
        organization: 'Department of Higher Education',
        state: 'Andhra Pradesh',
        value: 22000000,
        deadline: '2026-04-21',
        daysLeft: 10,
      },
      {
        id: 'G006',
        title: 'Annual Rate Contract for Stationery Items - FY 2026-27',
        organization: 'Government Press',
        state: 'West Bengal',
        value: 6500000,
        deadline: '2026-04-17',
        daysLeft: 6,
      },
      {
        id: 'G007',
        title: 'Supply of UPS Systems and Power Backup Solutions',
        organization: 'BSNL',
        state: 'Punjab',
        value: 18000000,
        deadline: '2026-05-01',
        daysLeft: 20,
      },
      {
        id: 'G008',
        title: 'Procurement of CCTV Cameras and Surveillance Systems',
        organization: 'Home Department',
        state: 'Telangana',
        value: 45000000,
        deadline: '2026-04-15',
        daysLeft: 4,
      },
    ],
  },
  services: {
    name: 'Services',
    description:
      'Outsourced services including IT, security, housekeeping, and facility management contracts from government bodies.',
    icon: Headphones,
    color: 'text-[#0D9488]',
    bgColor: 'bg-[#0D9488]/10',
    borderColor: 'border-l-[#0D9488]',
    activeTenders: 2987,
    newToday: 94,
    subcategories: [
      'IT Services',
      'Security Services',
      'Cleaning',
      'Catering',
      'Transport',
      'Consulting',
    ],
    tenders: [
      {
        id: 'S001',
        title: 'Annual Maintenance Contract for Data Centre Operations',
        organization: 'Ministry of Electronics & IT',
        state: 'Delhi',
        value: 42000000,
        deadline: '2026-04-26',
        daysLeft: 15,
      },
      {
        id: 'S002',
        title: 'Security Guard Services for Government Buildings (100 Personnel)',
        organization: 'Central Reserve Police Force',
        state: 'Haryana',
        value: 18000000,
        deadline: '2026-04-20',
        daysLeft: 9,
      },
      {
        id: 'S003',
        title: 'Housekeeping and Cleaning Services for Medical College Campus',
        organization: 'Department of Medical Education',
        state: 'Karnataka',
        value: 8500000,
        deadline: '2026-04-23',
        daysLeft: 12,
      },
      {
        id: 'S004',
        title: 'Catering Services for Railway Stations in Southern Zone',
        organization: 'Indian Railways',
        state: 'Tamil Nadu',
        value: 25000000,
        deadline: '2026-05-03',
        daysLeft: 22,
      },
      {
        id: 'S005',
        title: 'Fleet Management and Vehicle Hiring for State Secretariat',
        organization: 'Transport Department',
        state: 'Odisha',
        value: 15000000,
        deadline: '2026-04-18',
        daysLeft: 7,
      },
      {
        id: 'S006',
        title: 'IT Support and Help Desk Services for e-Governance Portal',
        organization: 'Department of IT',
        state: 'Rajasthan',
        value: 12000000,
        deadline: '2026-04-29',
        daysLeft: 18,
      },
      {
        id: 'S007',
        title: 'Waste Management Services for Municipal Corporation Area',
        organization: 'Urban Local Body',
        state: 'Gujarat',
        value: 55000000,
        deadline: '2026-04-16',
        daysLeft: 5,
      },
      {
        id: 'S008',
        title: 'Manpower Supply for Data Entry Operations',
        organization: 'Census Department',
        state: 'Madhya Pradesh',
        value: 9800000,
        deadline: '2026-04-22',
        daysLeft: 11,
      },
    ],
  },
  consultancy: {
    name: 'Consultancy',
    description:
      'Advisory and consulting engagements for project planning, technical assessments, and strategic implementation.',
    icon: Briefcase,
    color: 'text-[#7C3AED]',
    bgColor: 'bg-[#7C3AED]/10',
    borderColor: 'border-l-[#7C3AED]',
    activeTenders: 1456,
    newToday: 43,
    subcategories: [
      'Project Management',
      'Environmental',
      'Structural',
      'Financial Advisory',
      'Legal',
      'Technical',
    ],
    tenders: [
      {
        id: 'C001',
        title: 'DPR Preparation for Metro Rail Extension - Phase III',
        organization: 'Metro Rail Corporation',
        state: 'Maharashtra',
        value: 35000000,
        deadline: '2026-04-28',
        daysLeft: 17,
      },
      {
        id: 'C002',
        title: 'Environmental Impact Assessment for Industrial Corridor',
        organization: 'Ministry of Environment',
        state: 'Gujarat',
        value: 12000000,
        deadline: '2026-04-21',
        daysLeft: 10,
      },
      {
        id: 'C003',
        title: 'Structural Audit of Heritage Buildings in Old City Area',
        organization: 'Archaeology Department',
        state: 'Rajasthan',
        value: 8500000,
        deadline: '2026-04-19',
        daysLeft: 8,
      },
      {
        id: 'C004',
        title: 'Financial Advisory for PPP-Based Smart City Projects',
        organization: 'Smart City Mission',
        state: 'Andhra Pradesh',
        value: 22000000,
        deadline: '2026-05-04',
        daysLeft: 23,
      },
      {
        id: 'C005',
        title: 'Legal Consultancy for Land Acquisition Proceedings',
        organization: 'Revenue Department',
        state: 'Tamil Nadu',
        value: 5500000,
        deadline: '2026-04-17',
        daysLeft: 6,
      },
      {
        id: 'C006',
        title: 'Technical Feasibility Study for Solar Power Plant (50MW)',
        organization: 'Renewable Energy Development Authority',
        state: 'Karnataka',
        value: 18000000,
        deadline: '2026-04-25',
        daysLeft: 14,
      },
      {
        id: 'C007',
        title: 'Project Management Consultancy for Highway Construction',
        organization: 'National Highways Authority',
        state: 'Uttar Pradesh',
        value: 45000000,
        deadline: '2026-05-01',
        daysLeft: 20,
      },
      {
        id: 'C008',
        title: 'IT Strategy and Digital Transformation Roadmap',
        organization: 'Department of IT',
        state: 'Telangana',
        value: 15000000,
        deadline: '2026-04-15',
        daysLeft: 4,
      },
    ],
  },
};

// ─── Helper: Format Currency ──────────────────────────────────────────────────

function formatValue(value: number): string {
  if (value >= 10000000) return `${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(2)} L`;
  return value.toLocaleString('en-IN');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const counts = useTenderCounts();
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState('all');
  const [valueRange, setValueRange] = useState('all');
  const [sortBy, setSortBy] = useState('deadline');
  const [currentPage, setCurrentPage] = useState(1);

  const category = CATEGORY_DATA[slug];

  // 404-style message if slug doesn't match
  if (!category) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-16">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Category Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The category &ldquo;{slug}&rdquo; does not exist. Please browse our available categories.
          </p>
          <Link
            href="/explore-tenders"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-500/90 transition-colors"
          >
            Browse All Tenders
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const IconComponent = category.icon;

  const states = [
    'all',
    'Delhi',
    'Maharashtra',
    'Karnataka',
    'Tamil Nadu',
    'Rajasthan',
    'Gujarat',
    'Uttar Pradesh',
    'Kerala',
    'West Bengal',
    'Punjab',
    'Haryana',
    'Bihar',
    'Odisha',
    'Telangana',
    'Andhra Pradesh',
    'Madhya Pradesh',
  ];

  const activeTendersCount = counts.getCategoryCount(category.name) > 0 ? counts.getCategoryCount(category.name) : category.activeTenders;
  const newTodayCount = counts.newToday > 0 ? counts.newToday : category.newToday;

  const relatedCategories = Object.entries(CATEGORY_DATA)
    .filter(([key]) => key !== slug)
    .map(([key, data]) => ({
      slug: key,
      name: data.name,
      icon: data.icon,
      color: data.color,
      bgColor: data.bgColor,
      count: counts.getCategoryCount(data.name) > 0 ? counts.getCategoryCount(data.name) : data.activeTenders,
    }));

  return (
    <div className="min-h-screen bg-background pt-16 sm:pt-20">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Home className="w-3.5 h-3.5" />
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <Link
              href="/explore-tenders"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Tenders
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-foreground font-medium">{category.name}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Header */}
        <div className="mb-8">
          <div className="flex items-start gap-5">
            <div
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center shrink-0',
                category.bgColor
              )}
            >
              <IconComponent className={cn('w-8 h-8', category.color)} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {category.name} Tenders
              </h1>
              <p className="text-muted-foreground text-lg mb-3 max-w-2xl">
                {category.description}
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-foreground font-medium">
                  <TrendingUp className="w-4 h-4 text-primary-500" />
                  {activeTendersCount.toLocaleString('en-IN')} active tenders
                </span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1.5 text-foreground font-medium">
                  <Sparkles className="w-4 h-4 text-accent-500" />
                  {newTodayCount} new today
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Subcategory Tags */}
        <div className="mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedSubcategory(null)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                selectedSubcategory === null
                  ? 'bg-primary-500 text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
              )}
            >
              All
            </button>
            {category.subcategories.map((sub) => (
              <button
                key={sub}
                onClick={() =>
                  setSelectedSubcategory(selectedSubcategory === sub ? null : sub)
                }
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                  selectedSubcategory === sub
                    ? 'bg-primary-500 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                )}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filters:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* State Dropdown */}
              <div className="relative">
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="appearance-none bg-muted border border-border rounded-lg px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                >
                  <option value="all">All States</option>
                  {states.slice(1).map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                <MapPin className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Value Range */}
              <div className="relative">
                <select
                  value={valueRange}
                  onChange={(e) => setValueRange(e.target.value)}
                  className="appearance-none bg-muted border border-border rounded-lg px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                >
                  <option value="all">Any Value</option>
                  <option value="below-10l">Below 10 Lakh</option>
                  <option value="10l-1cr">10 Lakh - 1 Crore</option>
                  <option value="1cr-10cr">1 Crore - 10 Crore</option>
                  <option value="above-10cr">Above 10 Crore</option>
                </select>
                <IndianRupee className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none bg-muted border border-border rounded-lg px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                >
                  <option value="deadline">Closing Soon</option>
                  <option value="value-high">Value: High to Low</option>
                  <option value="value-low">Value: Low to High</option>
                  <option value="newest">Newest First</option>
                </select>
                <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Tender List */}
        <div className="space-y-4 mb-8">
          {category.tenders.map((tender) => (
            <div
              key={tender.id}
              className={cn(
                'bg-card border border-border rounded-xl p-5 shadow-card hover-lift transition-all border-l-4',
                category.borderColor
              )}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-foreground font-semibold text-base mb-2 line-clamp-2">
                    {tender.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      {tender.organization}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {tender.state}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-0.5">Estimated Value</div>
                    <div className="text-foreground font-bold text-lg">
                      <span className="text-sm font-normal text-muted-foreground">₹</span>
                      {formatValue(tender.value)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-0.5">Deadline</div>
                    <div
                      className={cn(
                        'font-semibold flex items-center gap-1',
                        tender.daysLeft <= 3
                          ? 'text-red-500'
                          : tender.daysLeft <= 7
                          ? 'text-amber-500'
                          : 'text-accent-500'
                      )}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {tender.daysLeft}d left
                    </div>
                  </div>
                  <Link
                    href="/login"
                    className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-500/90 transition-colors whitespace-nowrap"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Gate */}
        <div className="mb-12">
          <div className="flex items-center justify-center gap-2 mb-6">
            <button
              onClick={() => setCurrentPage(1)}
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors',
                currentPage === 1
                  ? 'bg-primary-500 text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              1
            </button>
            {[2, 3, 4, 5].map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors',
                  currentPage === page
                    ? 'bg-primary-500 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {page}
              </button>
            ))}
          </div>

          {currentPage > 1 && (
            <div className="bg-card border border-border rounded-xl p-8 text-center shadow-card">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                Subscribe to View More Tenders
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                You&apos;ve reached the free preview limit. Upgrade to access all{' '}
                {category.activeTenders.toLocaleString('en-IN')}+ {category.name.toLowerCase()}{' '}
                tenders with AI-powered eligibility checking and smart alerts.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/pricing"
                  className="px-6 py-3 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-500/90 transition-colors inline-flex items-center gap-2"
                >
                  View Plans Starting at ₹1,499/mo
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/register"
                  className="px-6 py-3 border border-border text-foreground font-medium rounded-lg hover:bg-muted transition-colors"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Related Categories */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Browse Other Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedCategories.map((cat) => {
              const RelatedIcon = cat.icon;
              return (
                <Link
                  key={cat.slug}
                  href={`/explore-tenders/category/${cat.slug}`}
                  className="bg-card border border-border rounded-xl p-5 shadow-card hover-lift transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center shrink-0',
                        cat.bgColor
                      )}
                    >
                      <RelatedIcon className={cn('w-6 h-6', cat.color)} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary-500 transition-colors">
                        {cat.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {cat.count.toLocaleString('en-IN')} active tenders
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
