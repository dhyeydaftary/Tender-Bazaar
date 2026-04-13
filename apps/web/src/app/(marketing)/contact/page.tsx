'use client';

import { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Types & Data                                                       */
/* ------------------------------------------------------------------ */

const SUBJECT_OPTIONS = [
  'General Inquiry',
  'Technical Support',
  'Billing & Payments',
  'Partnership',
  'Bug Report',
] as const;

type SubjectOption = (typeof SUBJECT_OPTIONS)[number];

interface ContactCard {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle?: string;
}

const CONTACT_CARDS: ContactCard[] = [
  {
    icon: Mail,
    title: 'Email',
    value: 'support@tenderbazaar.com',
    subtitle: 'We reply within 2 hours',
  },
  {
    icon: Phone,
    title: 'Phone',
    value: '+91 79 1234 5678',
    subtitle: 'Mon-Sat, 9 AM - 7 PM IST',
  },
  {
    icon: MapPin,
    title: 'Address',
    value: 'TenderBazaar Technologies Pvt. Ltd.',
    subtitle: '501 Titanium City Centre, Prahlad Nagar, Ahmedabad, Gujarat 380015',
  },
  {
    icon: Clock,
    title: 'Office Hours',
    value: 'Monday - Saturday',
    subtitle: '9:00 AM - 7:00 PM IST',
  },
];

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<SubjectOption | ''>('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = name.trim() && email.trim() && subject && message.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1500));
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen pt-28 pb-20">
      {/* Hero */}
      <section className="text-center px-4 mb-16">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
          Contact Us
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Have a question, suggestion, or need help? We&apos;d love to hear from you.
          Fill out the form below or reach out directly.
        </p>
      </section>

      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Contact Form */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Message Sent!</h3>
                <p className="text-muted-foreground mb-6">
                  Thank you for reaching out. Our team will get back to you within 2
                  business hours.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setName('');
                    setEmail('');
                    setSubject('');
                    setMessage('');
                  }}
                  className="text-primary-400 hover:text-primary-300 font-medium text-sm transition-colors"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="text-xl font-bold text-foreground mb-1">Send us a message</h2>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Rajesh Kumar"
                    className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all text-sm"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rajesh@company.com"
                    className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all text-sm"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                    Subject
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as SubjectOption)}
                    className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all text-sm appearance-none"
                  >
                    <option value="" className="bg-card">
                      Select a subject...
                    </option>
                    {SUBJECT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-card">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your query in detail..."
                    rows={5}
                    className="w-full px-4 py-2.5 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all text-sm resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors',
                    canSubmit && !submitting
                      ? 'bg-primary-500 hover:bg-primary-600 text-white'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Contact Info Cards */}
        <div className="lg:col-span-2 space-y-4">
          {CONTACT_CARDS.map((card) => {
            const CardIcon = card.icon;
            return (
              <div
                key={card.title}
                className="rounded-xl border border-border bg-card p-5 flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0">
                  <CardIcon className="h-5 w-5 text-primary-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-0.5">{card.title}</h3>
                  <p className="text-sm text-foreground/80">{card.value}</p>
                  {card.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Map Placeholder */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="h-48 bg-gradient-to-br from-muted to-card flex items-center justify-center relative">
              <div className="absolute inset-0 opacity-10">
                <div className="w-full h-full" style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                  backgroundSize: '30px 30px',
                }} />
              </div>
              <div className="text-center z-10">
                <MapPin className="h-8 w-8 text-primary-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-medium">Ahmedabad, Gujarat</p>
                <p className="text-xs text-muted-foreground">India</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
