'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Search,
  Shield,
  FileText,
  Bell,
  BarChart3,
  CheckCircle2,
  Sparkles,
  Users,
  MapPin,
  Target,
  Brain,
} from 'lucide-react';
import { cn, formatIndianNumber } from '@/lib/utils';
import { useTenderCounts } from '@/lib/hooks/use-tenders';

/* ------------------------------------------------------------------ */
/* Services data                                                       */
/* ------------------------------------------------------------------ */

interface Service {
  icon: typeof Search;
  title: string;
  description: string;
  features: string[];
  href: string;
  iconBg: string;
  iconColor: string;
}

const SERVICES: Service[] = [
  {
    icon: Search,
    title: 'Tender Search & Discovery',
    description:
      'AI-powered search across 50+ government portals. Find the most relevant tenders for your business within seconds.',
    features: [
      'Multi-portal aggregation',
      'Smart keyword matching',
      'Real-time updates',
      'Category-wise browsing',
    ],
    href: '/browse-tenders',
    iconBg: 'bg-primary-500/10',
    iconColor: 'text-primary-500',
  },
  {
    icon: Shield,
    title: 'Eligibility Assessment',
    description:
      'AI checks your company profile against tender requirements so you only bid where you qualify.',
    features: [
      'Automated document matching',
      'Turnover & experience verification',
      'MSME benefit analysis',
      'Compliance gap identification',
    ],
    href: '/services/eligibility',
    iconBg: 'bg-accent-500/10',
    iconColor: 'text-accent-500',
  },
  {
    icon: FileText,
    title: 'Bid Preparation Support',
    description:
      'Expert assistance in preparing winning bids with professional formatting and optimized financial proposals.',
    features: [
      'Technical proposal drafting',
      'Financial bid optimization',
      'Document compilation',
      'Quality review & formatting',
    ],
    href: '/services/bid-preparation',
    iconBg: 'bg-primary-500/10',
    iconColor: 'text-primary-500',
  },
  {
    icon: Brain,
    title: 'Document Management',
    description:
      'Organize and manage all tender-related documents in one secure, easily accessible platform.',
    features: [
      'Cloud storage & retrieval',
      'Document templates',
      'Version tracking',
      'Digital signature ready',
    ],
    href: '/services/documents',
    iconBg: 'bg-accent-500/10',
    iconColor: 'text-accent-500',
  },
  {
    icon: Bell,
    title: 'Smart Alerts & Tracking',
    description:
      'Never miss a deadline with intelligent notifications delivered through your preferred channels.',
    features: [
      'Multi-channel alerts (Email, WhatsApp, SMS)',
      'Custom keyword alerts',
      'Deadline reminders',
      'Corrigendum notifications',
    ],
    href: '/services/alerts',
    iconBg: 'bg-primary-500/10',
    iconColor: 'text-primary-500',
  },
  {
    icon: BarChart3,
    title: 'Result Analysis & Reporting',
    description:
      'Track tender outcomes and gain market intelligence to improve your win rate over time.',
    features: [
      'Win/loss analysis',
      'Competitor benchmarking',
      'Market trend insights',
      'Custom report generation',
    ],
    href: '/services/analytics',
    iconBg: 'bg-accent-500/10',
    iconColor: 'text-accent-500',
  },
];

/* ------------------------------------------------------------------ */
/* Process steps                                                        */
/* ------------------------------------------------------------------ */

interface ProcessStep {
  step: number;
  title: string;
  description: string;
}

const PROCESS_STEPS: ProcessStep[] = [
  {
    step: 1,
    title: 'Tell us your requirements',
    description:
      'Share your business profile, preferred categories, and target regions. Our onboarding takes less than 5 minutes.',
  },
  {
    step: 2,
    title: 'We find & analyze',
    description:
      'Our AI scans 50+ government portals daily and checks eligibility instantly against your profile.',
  },
  {
    step: 3,
    title: 'You bid & win',
    description:
      'Submit confident bids with our preparation support, document management, and deadline tracking.',
  },
];

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

interface Stat {
  value: string;
  label: string;
  icon: typeof Target;
}

const STATS: Stat[] = [
  { value: '50,000+', label: 'Active Tenders', icon: Target },
  { value: '28', label: 'States Covered', icon: MapPin },
  { value: '92%', label: 'AI Accuracy', icon: Sparkles },
  { value: '15,000+', label: 'Businesses', icon: Users },
];

/* ------------------------------------------------------------------ */
/* Page Component                                                       */
/* ------------------------------------------------------------------ */

export default function ServicesPage() {
  const counts = useTenderCounts();
  const dynamicStats: Stat[] = [
    {
      value: counts.active > 0 ? `${formatIndianNumber(counts.active)}+` : '50,000+',
      label: 'Active Tenders',
      icon: Target,
    },
    { value: '28', label: 'States Covered', icon: MapPin },
    { value: '92%', label: 'AI Accuracy', icon: Sparkles },
    { value: '15,000+', label: 'Businesses', icon: Users },
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="pt-28 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-overline inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-muted-foreground mb-6">
            <Sparkles className="h-3.5 w-3.5 text-primary-500" />
            Our Services
          </span>

          <h1 className="text-display-lg font-display text-foreground max-w-4xl mx-auto mb-6">
            End-to-end tender support for your business
          </h1>

          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto mb-10">
            From discovery to delivery, TenderBazaar provides comprehensive
            consultancy services to help Indian businesses win more government
            contracts with confidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-6 py-3 font-medium text-white',
                'bg-primary-500 hover:bg-primary-600 transition-colors shadow-card'
              )}
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-6 py-3 font-medium',
                'border border-border text-foreground hover:bg-muted transition-colors'
              )}
            >
              Talk to an Expert
            </Link>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 bg-muted/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-display-md font-display text-foreground mb-4">
              Everything you need to win tenders
            </h2>
            <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
              Our platform combines powerful AI technology with expert guidance
              to cover every aspect of the tender lifecycle.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((service) => (
              <div
                key={service.title}
                className={cn(
                  'group rounded-2xl border border-border bg-card p-6',
                  'shadow-card hover:shadow-card-hover transition-all duration-300',
                  'hover:-translate-y-1'
                )}
              >
                <div
                  className={cn(
                    'inline-flex items-center justify-center h-12 w-12 rounded-xl mb-5',
                    service.iconBg
                  )}
                >
                  <service.icon className={cn('h-6 w-6', service.iconColor)} />
                </div>

                <h3 className="text-heading-md font-display text-foreground mb-2">
                  {service.title}
                </h3>

                <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                  {service.description}
                </p>

                <ul className="space-y-2 mb-5">
                  {service.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <CheckCircle2 className="h-4 w-4 text-accent-500 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={service.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary-500 hover:text-primary-600 transition-colors group-hover:gap-2"
                >
                  Learn more
                  <ArrowRight className="h-3.5 w-3.5 transition-all" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How We Help Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-display-md font-display text-foreground mb-4">
              How we help you succeed
            </h2>
            <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
              A simple three-step process to transform how your business
              approaches government tenders.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PROCESS_STEPS.map((step) => (
              <div key={step.step} className="text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary-500 text-white text-lg font-bold mb-5">
                  {step.step}
                </div>
                <h3 className="text-heading-md font-display text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-16 bg-muted/50 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {dynamicStats.map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="h-6 w-6 text-primary-500 mx-auto mb-3" />
                <p className="text-display-md font-display text-foreground">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-display-md font-display text-foreground mb-4">
            Ready to win more government contracts?
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Join thousands of Indian businesses already using TenderBazaar to
            discover, prepare, and win government tenders.
          </p>
          <Link
            href="/register"
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-8 py-4 font-medium text-white text-lg',
              'bg-primary-500 hover:bg-primary-600 transition-colors shadow-card'
            )}
          >
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
