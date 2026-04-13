'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  MapPin,
  Eye,
  Lightbulb,
  Users,
  Target,
  Heart,
  Globe,
  Mail,
  Phone,
  Sparkles,
} from 'lucide-react';
import { cn, formatIndianNumber } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Hooks                                                              */
/* ------------------------------------------------------------------ */

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
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);

  return value;
}

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

const STATS = [
  { target: 50000, label: 'Active Tenders', suffix: '+', prefix: '' },
  { target: 28, label: 'States Covered', suffix: '', prefix: '' },
  { target: 15000, label: 'Businesses Trust Us', suffix: '+', prefix: '' },
  { target: 3500, label: 'New Tenders Daily', suffix: '+', prefix: '' },
];

interface TeamMember {
  name: string;
  title: string;
  bio: string;
  initials: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Arjun Mehta',
    title: 'Co-Founder & CEO',
    bio: 'Former procurement officer with 12 years of experience in government contracting. Built TenderBazaar to solve the information asymmetry he witnessed firsthand.',
    initials: 'AM',
  },
  {
    name: 'Sneha Iyer',
    title: 'Co-Founder & CTO',
    bio: 'Ex-Google engineer with expertise in AI/ML and data engineering. Leads the technical vision behind our AI-powered eligibility engine and scraping infrastructure.',
    initials: 'SI',
  },
  {
    name: 'Rohan Deshmukh',
    title: 'VP of Product',
    bio: 'Product leader with experience at Flipkart and Razorpay. Focused on building intuitive tools that simplify complex government procurement workflows.',
    initials: 'RD',
  },
  {
    name: 'Ananya Krishnan',
    title: 'Head of Operations',
    bio: 'Operations expert with a background in logistics and public sector consulting. Ensures TenderBazaar delivers reliable, accurate tender data every day.',
    initials: 'AK',
  },
];

interface ValueCard {
  title: string;
  description: string;
  icon: typeof Eye;
}

const VALUES: ValueCard[] = [
  {
    title: 'Transparency',
    icon: Eye,
    description:
      'Government procurement should be open and accessible to every business. We believe in removing information barriers and levelling the playing field for MSMEs and large enterprises alike.',
  },
  {
    title: 'Innovation',
    icon: Lightbulb,
    description:
      'We use AI, machine learning, and advanced data engineering to solve problems that manual effort cannot. From automated eligibility checking to intelligent alerts, technology drives everything we do.',
  },
  {
    title: 'Accessibility',
    icon: Users,
    description:
      'Our platform is designed for businesses of all sizes and technical abilities. Whether you are a first-time bidder or a seasoned contractor, TenderBazaar makes tendering simple and approachable.',
  },
];

const MILESTONES = [
  { year: '2023', event: 'TenderBazaar founded in Ahmedabad, Gujarat' },
  { year: '2023', event: 'Launched beta with coverage of 10 state portals' },
  { year: '2024', event: 'AI eligibility engine launched, covering 28 states' },
  { year: '2024', event: 'Crossed 5,000 registered businesses' },
  { year: '2025', event: 'Expanded to 50+ portals including GeM and CPPP' },
  { year: '2025', event: 'Mobile app launched on iOS and Android' },
  { year: '2026', event: '15,000+ businesses and counting' },
];

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function AboutPage() {
  const statsView = useInView(0.2);

  return (
    <div className="bg-background min-h-screen">
      {/* Hero */}
      <section className="pt-32 pb-20 md:pb-28 relative overflow-hidden">
        {/* Background accents */}
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-accent-500/[0.03] rounded-full blur-[100px]" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-muted border border-border rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-primary-500" />
            <span className="text-overline text-foreground/80 uppercase tracking-widest">
              About Us
            </span>
          </div>

          <h1 className="text-display-lg md:text-display-xl lg:text-display-2xl font-display text-foreground mb-6 tracking-tight">
            Building India&apos;s{' '}
            <span className="text-primary-500">Tender Intelligence</span>
          </h1>

          <p className="text-body-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            We are on a mission to democratise access to government tenders in India.
            Every business, regardless of size, deserves a fair shot at government contracts
            worth over{' '}
            <span className="text-foreground font-medium">Rs 30 lakh crore</span>{' '}
            annually.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-card border-y border-border">
        <div ref={statsView.ref} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {STATS.map((stat) => (
              <StatCounter
                key={stat.label}
                target={stat.target}
                label={stat.label}
                suffix={stat.suffix}
                prefix={stat.prefix}
                start={statsView.inView}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-24 lg:py-32 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Mission */}
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-500/10 mb-6">
                <Target className="w-6 h-6 text-primary-500" />
              </div>
              <h2 className="text-display-sm md:text-display-md font-display text-foreground mb-6">
                Our Mission
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  India&apos;s government procurement market is worth over Rs 30 lakh crore
                  annually, yet millions of eligible businesses miss out because tender
                  information is scattered across 50+ portals, buried in complex documents,
                  and published with tight deadlines.
                </p>
                <p>
                  TenderBazaar was founded to solve this problem. We aggregate government
                  tenders from every major portal in India — from GeM and CPPP to state
                  e-procurement sites across all 28 states and 8 union territories.
                  Our AI-powered platform instantly matches tenders to your business profile,
                  checks your eligibility, and sends smart alerts so you never miss an opportunity.
                </p>
              </div>
            </div>

            {/* Vision */}
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent-500/10 mb-6">
                <Globe className="w-6 h-6 text-accent-500" />
              </div>
              <h2 className="text-display-sm md:text-display-md font-display text-foreground mb-6">
                Our Vision
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  We envision a future where every business in India, whether an MSME in a
                  tier-2 city or a large enterprise in Mumbai, has equal access to government
                  procurement opportunities.
                </p>
                <p>
                  Our vision is to become the definitive platform for government tender
                  intelligence in India — combining comprehensive data coverage, cutting-edge
                  AI, and intuitive tools to help businesses of all sizes grow through
                  public sector contracts.
                </p>
                <p>
                  We believe technology can level the playing field and bring transparency
                  to a system that has traditionally favoured those with insider knowledge
                  and dedicated procurement teams. That is our promise.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Company Story / Timeline */}
      <section className="py-24 lg:py-32 bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-overline uppercase tracking-widest text-primary-500 mb-3">
              Our Journey
            </p>
            <h2 className="text-display-md md:text-display-lg font-display text-foreground mb-4">
              The TenderBazaar story
            </h2>
            <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
              From a frustration with scattered tender data to India&apos;s leading tender
              intelligence platform.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-0.5" />

              {MILESTONES.map((milestone, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'relative flex items-start gap-6 mb-10 last:mb-0',
                    'md:even:flex-row-reverse',
                  )}
                >
                  {/* Dot */}
                  <div className="absolute left-4 md:left-1/2 w-3 h-3 rounded-full bg-primary-500 border-2 border-background -translate-x-1.5 md:-translate-x-1.5 mt-1.5 z-10 shrink-0" />

                  {/* Content */}
                  <div className={cn(
                    'ml-10 md:ml-0 md:w-[calc(50%-2rem)]',
                    idx % 2 === 0 ? 'md:text-right md:pr-8' : 'md:text-left md:pl-8',
                  )}>
                    <span className="text-xs font-mono font-bold text-primary-500 uppercase tracking-wider">
                      {milestone.year}
                    </span>
                    <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
                      {milestone.event}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-24 lg:py-32 bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-overline uppercase tracking-widest text-primary-500 mb-3">
              Team
            </p>
            <h2 className="text-display-md md:text-display-lg font-display text-foreground mb-4">
              Meet the people behind TenderBazaar
            </h2>
            <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
              A passionate team of procurement experts, engineers, and product builders
              working to transform government tendering in India.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {TEAM_MEMBERS.map((member) => (
              <div
                key={member.name}
                className="group bg-card border border-border rounded-xl p-6 text-center hover:border-border hover:bg-muted transition-all duration-300"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500/20 to-accent-500/20 border border-border flex items-center justify-center text-foreground text-xl font-bold mx-auto mb-4">
                  {member.initials}
                </div>
                <h3 className="text-heading-sm text-foreground font-display mb-1">
                  {member.name}
                </h3>
                <p className="text-sm text-primary-500 font-medium mb-3">
                  {member.title}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {member.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 lg:py-32 bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-overline uppercase tracking-widest text-primary-500 mb-3">
              Values
            </p>
            <h2 className="text-display-md md:text-display-lg font-display text-foreground mb-4">
              What drives us every day
            </h2>
            <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
              The principles that guide every decision we make as a company.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <div
                  key={value.title}
                  className="group bg-card border border-border rounded-xl p-8 hover:border-border hover:bg-muted transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center mb-6 group-hover:bg-primary-500/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary-500" />
                  </div>
                  <h3 className="text-heading-md text-foreground font-display mb-3">
                    {value.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Location & Contact CTA */}
      <section className="py-24 lg:py-32 bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            {/* Location */}
            <div className="inline-flex items-center gap-2 bg-muted border border-border rounded-full px-4 py-1.5 mb-8">
              <MapPin className="w-3.5 h-3.5 text-accent-500" />
              <span className="text-sm text-foreground/80">Ahmedabad, India</span>
            </div>

            <h2 className="text-display-md md:text-display-lg font-display text-foreground mb-4">
              Want to learn more?
            </h2>
            <p className="text-body-lg text-muted-foreground mb-10 leading-relaxed">
              Whether you have questions about our platform, need a demo, or want to explore
              partnership opportunities, we would love to hear from you.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link
                href="/register"
                className="group bg-primary-500 hover:bg-primary-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-glow hover:shadow-[0_0_30px_rgba(255,107,53,0.25)] flex items-center gap-2"
              >
                Get started for free
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/contact"
                className="text-foreground/80 hover:text-foreground px-8 py-3.5 rounded-xl text-base font-medium transition-all border border-border hover:border-border hover:bg-muted flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Contact Us
              </Link>
            </div>

            {/* Contact details */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-muted-foreground text-sm">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>hello@tenderbazaar.com</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>+91 79 XXXX XXXX</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-primary-500" />
                <span>Made in Ahmedabad</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
