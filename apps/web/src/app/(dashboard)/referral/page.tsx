'use client';

import { useState, useEffect } from 'react';
import {
  Gift,
  Copy,
  Check,
  Users,
  TrendingUp,
  IndianRupee,
  Share2,
  MessageCircle,
  Mail,
  Twitter,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface ReferralStats {
  totalReferred: number;
  activePremium: number;
  totalRewards: number;
  pendingRewards: number;
}

interface ReferralData {
  referralCode: string;
  referralLink: string;
  stats: ReferralStats;
}

interface ReferralHistoryItem {
  email: string;
  date: string;
  status: string;
  reward: number;
}

function formatINR(value: number): string {
  return value.toLocaleString('en-IN');
}

export default function ReferralPage() {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [history, setHistory] = useState<ReferralHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [referralRes, historyRes] = await Promise.all([
          api.get('/referral'),
          api.get('/referral/history'),
        ]);

        setReferralData(referralRes.data.data);
        setHistory(historyRes.data.data);
      } catch (err: any) {
        setError(err?.response?.data?.error?.message || 'Failed to load referral data. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const referralCode = referralData?.referralCode ?? '';
  const referralLink = referralData?.referralLink ?? '';

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(
      `Join TenderBazaar - India's smartest tender platform! Use my referral code ${referralCode} and get 1 month free Starter plan. Sign up: ${referralLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Join TenderBazaar - Get 1 Month Free!');
    const body = encodeURIComponent(
      `Hi,\n\nI've been using TenderBazaar for finding government tenders and it has been great!\n\nUse my referral code: ${referralCode}\nSign up here: ${referralLink}\n\nWe both get 1 month free Starter plan!\n\nBest regards`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareViaTwitter = () => {
    const text = encodeURIComponent(
      `Discover government tenders easily with @TenderBazaar! Use my referral code ${referralCode} for 1 month free. ${referralLink}`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          <p className="text-sm text-muted-foreground">Loading referral data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = referralData!.stats;

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <Gift className="h-6 w-6 text-primary-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Refer & Earn</h1>
            <p className="text-sm text-muted-foreground">Invite your network and earn free subscription months</p>
          </div>
        </div>
      </div>

      {/* Reward info banner */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Gift className="h-8 w-8" />
          <div>
            <h2 className="text-lg font-bold">You and your friend both get 1 month free Starter plan</h2>
            <p className="text-primary-100 text-sm">Worth INR 1,499 each - no strings attached!</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-primary-100 mt-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Share your referral code
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            Friend signs up & subscribes
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            Both get 1 month free!
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Referral code card */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">Your Referral Code</h3>

          {/* Code display */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 bg-muted/50 border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-xl px-6 py-4 text-center">
              <span className="text-2xl font-bold tracking-widest text-primary-600 dark:text-primary-400">
                {referralCode}
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              className={cn(
                'px-4 py-4 rounded-xl font-medium text-sm transition-all',
                copied
                  ? 'bg-accent-500 text-white'
                  : 'bg-primary-500 hover:bg-primary-600 text-white'
              )}
            >
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>

          {/* Share link */}
          <div className="mb-5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              Share Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 bg-muted/30 border border-input rounded-lg px-3 py-2 text-sm text-foreground"
              />
              <button
                onClick={handleCopyLink}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  copiedLink
                    ? 'bg-accent-500 text-white'
                    : 'border border-input hover:bg-muted text-foreground'
                )}
              >
                {copiedLink ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Share buttons */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
              Share via
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={shareViaWhatsApp}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </button>
              <button
                onClick={shareViaEmail}
                className="flex items-center gap-2 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-sm font-medium transition-colors border border-border"
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
              <button
                onClick={shareViaTwitter}
                className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Twitter className="h-4 w-4" />
                Twitter
              </button>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm text-muted-foreground">Total Referrals</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.totalReferred}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-accent-100 dark:bg-accent-900/30 rounded-lg">
                <TrendingUp className="h-4 w-4 text-accent-600 dark:text-accent-400" />
              </div>
              <span className="text-sm text-muted-foreground">Active Premium</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.activePremium}</p>
            {stats.totalReferred > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {((stats.activePremium / stats.totalReferred) * 100).toFixed(0)}% conversion rate
              </p>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <IndianRupee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-sm text-muted-foreground">Rewards Earned</span>
            </div>
            <p className="text-3xl font-bold text-foreground">INR {formatINR(stats.totalRewards)}</p>
            {stats.pendingRewards > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                INR {formatINR(stats.pendingRewards)} pending
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Referral history table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">Referral History</h3>
          <p className="text-sm text-muted-foreground mt-1">Track the status of your referrals</p>
        </div>

        {history.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No referrals yet. Share your code to get started!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Referred User
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Date
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Status
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Reward
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((item, idx) => (
                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 text-sm text-foreground font-medium">{item.email}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          'text-xs font-medium px-2.5 py-1 rounded-full',
                          item.status === 'CONVERTED'
                            ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        )}
                      >
                        {item.status === 'CONVERTED' ? 'Converted' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-right font-medium text-foreground">
                      {item.reward > 0 ? `INR ${formatINR(item.reward)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
