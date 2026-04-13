'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronDown,
  Rocket,
  Filter,
  Brain,
  CreditCard,
  ShieldCheck,
  Mail,
  Phone,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Types & Data                                                       */
/* ------------------------------------------------------------------ */

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSection {
  title: string;
  icon: React.ElementType;
  items: FaqItem[];
}

const FAQ_SECTIONS: FaqSection[] = [
  {
    title: 'Getting Started',
    icon: Rocket,
    items: [
      {
        question: 'How do I create an account?',
        answer:
          'Click the "Start Free" button on the homepage or visit the registration page. You can sign up with your email address and a password, or use Google Sign-In for a faster onboarding experience. After registration, verify your email to unlock all free-tier features.',
      },
      {
        question: 'How do I set up my company profile?',
        answer:
          'Navigate to Settings > Company Profile after logging in. Fill in your company name, GSTIN, PAN, registered address, and upload relevant documents such as your incorporation certificate and MSME registration. A complete profile improves AI eligibility accuracy.',
      },
      {
        question: 'How do I search for tenders?',
        answer:
          'Use the Tenders page from the dashboard navigation. You can search by keyword, filter by state, category, tender value range, organisation, and deadline. Our search supports both English and Hindi keywords and covers 50+ government procurement portals across India.',
      },
      {
        question: 'How do I set up alerts?',
        answer:
          'Go to the Alerts page and click "Create Alert". Define your keywords, preferred states, categories, and value range. Choose your notification frequency (Instant, Daily, or Weekly) and the channels you want to receive alerts on — Email, Push, WhatsApp, or SMS.',
      },
      {
        question: 'What plans are available?',
        answer:
          'TenderBazaar offers four plans: Free (5 tender views/day, 1 alert), Starter at Rs 1,499/month (50 views/day, 5 alerts, 5 AI checks), Professional at Rs 4,999/month (unlimited views, 20 alerts, 50 AI checks), and Enterprise at Rs 14,999/month (unlimited everything plus API access and priority support).',
      },
    ],
  },
  {
    title: 'Tender Search & Filters',
    icon: Filter,
    items: [
      {
        question: 'How do I filter tenders by state?',
        answer:
          'On the Tenders page, use the "State" filter dropdown. You can select one or multiple states and union territories. The filter works in combination with other filters such as category, value range, and organisation for precise results.',
      },
      {
        question: 'Can I search tenders in Hindi?',
        answer:
          'Yes, TenderBazaar supports Hindi keyword search. Many government tenders are published in Hindi or bilingual format. Simply type your Hindi keywords in the search bar and the system will match against tender titles and descriptions in both Hindi and English.',
      },
      {
        question: 'How do I save a tender?',
        answer:
          'Click the bookmark icon on any tender card to save it to your Saved Tenders list. You can organise saved tenders into custom folders, add notes, and set personal reminders for important deadlines. Access your saved tenders from the "Saved" section in the dashboard.',
      },
      {
        question: 'What do the tender status badges mean?',
        answer:
          'Active (green) means the tender is open for bidding. Upcoming (blue) indicates the tender will open soon. Closed (gray) means the submission deadline has passed. Cancelled (red) means the issuing authority has withdrawn the tender. Corrigendum (amber) indicates an amendment has been issued.',
      },
    ],
  },
  {
    title: 'Eligibility & AI Features',
    icon: Brain,
    items: [
      {
        question: 'How does AI eligibility checking work?',
        answer:
          'Our AI analyses the tender document requirements (turnover, experience, certifications, EMD, etc.) against your company profile and uploaded documents. It provides a detailed eligibility score along with a breakdown of which criteria you meet, partially meet, or do not meet.',
      },
      {
        question: 'What is the eligibility score?',
        answer:
          'The eligibility score is a percentage from 0 to 100 indicating how well your company profile matches a tender\'s requirements. A score above 80% means you are likely eligible. Between 50-80% suggests partial eligibility with some criteria needing attention. Below 50% indicates significant gaps.',
      },
      {
        question: 'How accurate is the AI analysis?',
        answer:
          'Our AI achieves over 90% accuracy on structured tender requirements. However, it is meant as a decision-support tool, not a legal opinion. We recommend verifying critical eligibility criteria manually, especially for high-value tenders. The accuracy improves as you keep your company profile up to date.',
      },
      {
        question: 'Can I check eligibility for multiple tenders?',
        answer:
          'Yes, you can run batch eligibility checks from the Tenders page by selecting multiple tenders and clicking "Check Eligibility". The number of AI checks available depends on your plan — Free gets 1 total, Starter gets 5/month, Professional gets 50/month, and Enterprise gets unlimited.',
      },
    ],
  },
  {
    title: 'Subscription & Billing',
    icon: CreditCard,
    items: [
      {
        question: 'How do I upgrade my plan?',
        answer:
          'Go to Settings > Subscription or the Subscription page in the dashboard. Select the plan you want and complete the payment via Razorpay. Upgrades take effect immediately and you get prorated credit for the remainder of your current billing cycle.',
      },
      {
        question: 'What payment methods are accepted?',
        answer:
          'We accept all major payment methods via Razorpay including UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards (Visa, Mastercard, RuPay), Net Banking (all major banks), and Wallets. For Enterprise plans, we also support direct bank transfers and purchase orders.',
      },
      {
        question: 'How do I cancel my subscription?',
        answer:
          'You can cancel your subscription anytime from Settings > Subscription by clicking "Cancel Plan". Your access continues until the end of the current billing period. After cancellation, your account reverts to the Free plan. You will not lose your saved tenders or company profile data.',
      },
      {
        question: 'Is there a refund policy?',
        answer:
          'Yes, we offer a 7-day money-back guarantee for first-time subscribers. If you are not satisfied, contact support@tenderbazaar.com within 7 days of your first payment for a full refund. Refunds for subsequent billing cycles are handled on a case-by-case basis.',
      },
    ],
  },
  {
    title: 'Account & Security',
    icon: ShieldCheck,
    items: [
      {
        question: 'How do I reset my password?',
        answer:
          'Click "Forgot Password" on the login page and enter your registered email address. You will receive a password reset link valid for 1 hour. If you are already logged in, go to Settings > Personal Info to change your password directly.',
      },
      {
        question: 'How do I change my email?',
        answer:
          'Navigate to Settings > Personal Info and update your email address. You will need to verify the new email address by clicking the verification link sent to it. Your old email will receive a notification about the change for security purposes.',
      },
      {
        question: 'Is my data secure?',
        answer:
          'Absolutely. TenderBazaar uses industry-standard security measures including encrypted data storage, HTTPS/TLS for all communications, secure authentication with JWT tokens, and regular security audits. Your company documents are stored in encrypted cloud storage and are never shared with third parties. We comply with Indian data protection regulations.',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_SECTIONS;

    const query = searchQuery.toLowerCase();
    return FAQ_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.question.toLowerCase().includes(query) ||
          item.answer.toLowerCase().includes(query)
      ),
    })).filter((section) => section.items.length > 0);
  }, [searchQuery]);

  return (
    <div className="min-h-screen pt-28 pb-20">
      {/* Hero */}
      <section className="text-center px-4 mb-16">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
          Help Center
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
          Find answers to common questions about TenderBazaar. Browse by category or search
          for a specific topic.
        </p>

        {/* Search */}
        <div className="max-w-xl mx-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
          />
        </div>
      </section>

      {/* FAQ Sections */}
      <section className="max-w-3xl mx-auto px-4 space-y-10">
        {filteredSections.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              No results found for &quot;{searchQuery}&quot;. Try a different search term or{' '}
              <Link href="/contact" className="text-primary-500 hover:underline">
                contact us
              </Link>{' '}
              for help.
            </p>
          </div>
        )}

        {filteredSections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <div key={section.title}>
              {/* Section heading */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-primary-500/15 flex items-center justify-center">
                  <SectionIcon className="h-5 w-5 text-primary-400" />
                </div>
                <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
              </div>

              {/* Accordion items */}
              <div className="space-y-2">
                {section.items.map((item) => {
                  const key = `${section.title}::${item.question}`;
                  const isOpen = openItems.has(key);

                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-border bg-card overflow-hidden"
                    >
                      <button
                        onClick={() => toggleItem(key)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left text-foreground hover:bg-muted transition-colors"
                      >
                        <span className="font-medium pr-4">{item.question}</span>
                        <ChevronDown
                          className={cn(
                            'h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200',
                            isOpen && 'rotate-180'
                          )}
                        />
                      </button>
                      <div
                        className={cn(
                          'grid transition-all duration-200 ease-in-out',
                          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                        )}
                      >
                        <div className="overflow-hidden">
                          <p className="px-5 pb-4 text-muted-foreground leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* Contact CTA */}
      <section className="max-w-3xl mx-auto px-4 mt-20">
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-10 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Can&apos;t find what you&apos;re looking for?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Our support team is available Monday to Saturday, 9 AM to 7 PM IST. We
            typically respond within 2 hours during business hours.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary-500/15 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary-400" />
              </div>
              <span className="text-foreground font-medium text-sm">support@tenderbazaar.com</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary-500/15 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary-400" />
              </div>
              <span className="text-foreground font-medium text-sm">+91 79 1234 5678</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary-500/15 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary-400" />
              </div>
              <span className="text-foreground font-medium text-sm">Mon-Sat, 9 AM - 7 PM IST</span>
            </div>
          </div>

          <Link
            href="/contact"
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}
