'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowRight, Twitter, Linkedin, Youtube, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   NAVBAR — Sticky transparent → solid on scroll
   ═══════════════════════════════════════════════════════════════════════════ */

const NAV_LINKS = [
  { label: 'Browse Tenders', href: '/login' },
  { label: 'Services', href: '/services' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        scrolled
          ? 'py-2 bg-background/90 backdrop-blur-xl border-b border-border shadow-lg'
          : 'py-4 bg-transparent',
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group relative">
          <div className="w-9 h-9 rounded-lg bg-primary-500 flex items-center justify-center text-foreground font-extrabold text-sm tracking-tight transition-all duration-300 group-hover:shadow-glow group-hover:scale-105">
            TB
          </div>
          <span className="text-foreground font-bold text-xl tracking-tight hidden sm:block">
            Tender<span className="text-primary-500">Bazaar</span>
          </span>
        </Link>

        {/* Center links — desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => {
            const isActive = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
            return (
              <Link
                key={l.label}
                href={l.href}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'text-foreground bg-foreground/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Right CTA — desktop */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="group bg-primary-500 hover:bg-primary-600 text-foreground px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-glow hover:shadow-glow flex items-center gap-2"
          >
            Start Free
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Hamburger — mobile */}
        <button
          aria-label="Toggle menu"
          className="md:hidden text-foreground p-2 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu — full screen overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[60px] bg-background/98 backdrop-blur-2xl z-40">
          <nav className="flex flex-col px-6 py-8 gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="text-muted-foreground hover:text-foreground text-lg font-medium py-3 px-4 rounded-lg hover:bg-muted transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <hr className="border-border my-4" />
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="text-muted-foreground hover:text-foreground text-lg font-medium py-3 px-4 rounded-lg hover:bg-muted transition-colors"
            >
              Login
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="bg-primary-500 hover:bg-primary-600 text-foreground text-center px-5 py-3 rounded-lg text-lg font-semibold transition-colors mt-2"
            >
              Start Free
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FOOTER — 4-column with newsletter + social
   ═══════════════════════════════════════════════════════════════════════════ */

const FOOTER_COLS = [
  {
    title: 'Product',
    links: [
      { label: 'Dashboard', href: '/login' },
      { label: 'Search Tenders', href: '/login' },
      { label: 'AI Eligibility', href: '/login' },
      { label: 'Smart Alerts', href: '/login' },
      { label: 'Mobile App', href: '/login' },
      { label: 'API', href: '/login' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Careers', href: '#' },
      { label: 'Press', href: '#' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: '/blog' },
      { label: 'Help Center', href: '/help' },
      { label: 'API Documentation', href: '/login' },
      { label: 'Status Page', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Refund Policy', href: '/refund' },
      { label: 'Cookie Policy', href: '#' },
    ],
  },
];

const SOCIALS = [
  { label: 'Twitter', icon: Twitter, href: '#' },
  { label: 'LinkedIn', icon: Linkedin, href: '#' },
  { label: 'YouTube', icon: Youtube, href: '#' },
  { label: 'WhatsApp', icon: MessageCircle, href: '#' },
];

function Footer() {
  const [email, setEmail] = useState('');

  return (
    <footer className="bg-card text-muted-foreground border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand column */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-foreground font-extrabold text-xs">
                TB
              </div>
              <span className="text-foreground font-bold text-lg">
                Tender<span className="text-primary-500">Bazaar</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed mb-6 max-w-xs">
              India&apos;s smartest tender aggregation platform. AI-powered eligibility
              checking across 50+ government portals.
            </p>
            {/* Newsletter */}
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="flex-1 bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2.5 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all max-w-[200px]"
              />
              <Link
                href="/login"
                className="bg-primary-500 hover:bg-primary-600 text-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                Subscribe
              </Link>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-foreground font-semibold text-sm mb-4 uppercase tracking-wider text-overline">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm hover:text-foreground transition-colors duration-200"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} TenderBazaar. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {/* Social icons */}
            <div className="flex items-center gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
                >
                  <s.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
            <span className="text-sm text-muted-foreground hidden sm:block">
              Made with <span className="text-primary-500">&hearts;</span> in Ahmedabad, India
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYOUT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
