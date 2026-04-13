'use client';

import { useState, useMemo } from 'react';
import {
  Bell,
  Send,
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Megaphone,
  Mail,
  Smartphone,
  MessageSquare,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  Plus,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Channel = 'EMAIL' | 'PUSH' | 'WHATSAPP' | 'SMS' | 'IN_APP';
type NotifStatus = 'DELIVERED' | 'PENDING' | 'FAILED';
type TargetAudience = 'ALL' | 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

interface NotificationRecord {
  id: number;
  title: string;
  message: string;
  channel: Channel;
  target: TargetAudience;
  status: NotifStatus;
  sentAt: string;
  delivered: number;
  failed: number;
  opened: number;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------
const MOCK_NOTIFICATIONS: NotificationRecord[] = [
  { id: 1, title: 'New Feature: AI Bid Assistant', message: 'We\'ve launched a new AI-powered bid assistant to help you prepare winning proposals.', channel: 'EMAIL', target: 'ALL', status: 'DELIVERED', sentAt: '2026-04-10T14:30:00Z', delivered: 12847, failed: 23, opened: 4562 },
  { id: 2, title: 'Plan Upgrade Offer - 20% OFF', message: 'Upgrade to Professional plan today and get 20% off on yearly subscription.', channel: 'PUSH', target: 'FREE', status: 'DELIVERED', sentAt: '2026-04-09T10:00:00Z', delivered: 7840, failed: 156, opened: 2310 },
  { id: 3, title: 'Scheduled Maintenance Notice', message: 'Platform maintenance scheduled for April 15, 2026, 2:00 AM - 4:00 AM IST.', channel: 'IN_APP', target: 'ALL', status: 'DELIVERED', sentAt: '2026-04-08T18:00:00Z', delivered: 12847, failed: 0, opened: 8920 },
  { id: 4, title: 'New State Portal: Kerala', message: 'We now support Kerala eTenders portal. Set up alerts to never miss Kerala tenders.', channel: 'EMAIL', target: 'PROFESSIONAL', status: 'DELIVERED', sentAt: '2026-04-07T09:15:00Z', delivered: 1890, failed: 12, opened: 890 },
  { id: 5, title: 'Weekly Tender Digest', message: 'Your weekly summary of top 50 trending tenders across India.', channel: 'WHATSAPP', target: 'STARTER', status: 'DELIVERED', sentAt: '2026-04-06T08:00:00Z', delivered: 2345, failed: 89, opened: 1678 },
  { id: 6, title: 'Subscription Expiry Reminder', message: 'Your subscription expires in 3 days. Renew now to continue using premium features.', channel: 'SMS', target: 'PROFESSIONAL', status: 'DELIVERED', sentAt: '2026-04-05T11:30:00Z', delivered: 234, failed: 8, opened: 0 },
  { id: 7, title: 'Platform Update v2.5', message: 'New features: tender comparison, calendar export, improved search filters.', channel: 'PUSH', target: 'ALL', status: 'FAILED', sentAt: '2026-04-04T16:00:00Z', delivered: 0, failed: 12847, opened: 0 },
  { id: 8, title: 'GeM Portal Integration Update', message: 'Improved GeM scraping with 2x faster updates and better document extraction.', channel: 'EMAIL', target: 'ENTERPRISE', status: 'DELIVERED', sentAt: '2026-04-03T14:45:00Z', delivered: 661, failed: 3, opened: 412 },
  { id: 9, title: 'Refer & Earn Campaign', message: 'Refer a friend and get 1 month free on your current plan!', channel: 'IN_APP', target: 'ALL', status: 'PENDING', sentAt: '2026-04-11T06:00:00Z', delivered: 0, failed: 0, opened: 0 },
  { id: 10, title: 'Holiday Notice - Republic Day', message: 'Wishing you a Happy Republic Day! Our team will be available for support.', channel: 'WHATSAPP', target: 'ALL', status: 'DELIVERED', sentAt: '2026-01-26T07:00:00Z', delivered: 10234, failed: 45, opened: 7890 },
  { id: 11, title: 'New Category: Defence Tenders', message: 'Defence procurement tenders are now available on TenderBazaar.', channel: 'EMAIL', target: 'ENTERPRISE', status: 'DELIVERED', sentAt: '2026-03-28T12:00:00Z', delivered: 661, failed: 2, opened: 445 },
  { id: 12, title: 'API Key Updates', message: 'New API rate limits and webhook support now available for Enterprise users.', channel: 'EMAIL', target: 'ENTERPRISE', status: 'DELIVERED', sentAt: '2026-03-25T10:30:00Z', delivered: 658, failed: 5, opened: 389 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function channelIcon(ch: Channel) {
  switch (ch) {
    case 'EMAIL': return <Mail className="w-4 h-4" />;
    case 'PUSH': return <Smartphone className="w-4 h-4" />;
    case 'WHATSAPP': return <MessageSquare className="w-4 h-4" />;
    case 'SMS': return <Smartphone className="w-4 h-4" />;
    case 'IN_APP': return <Bell className="w-4 h-4" />;
  }
}

function channelBadge(ch: Channel) {
  const colors: Record<Channel, string> = {
    EMAIL: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    PUSH: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    WHATSAPP: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    SMS: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    IN_APP: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[ch]}`}>
      {channelIcon(ch)}
      {ch.replace('_', ' ')}
    </span>
  );
}

function statusBadge(status: NotifStatus) {
  if (status === 'DELIVERED') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="w-3 h-3" /> Delivered
    </span>
  );
  if (status === 'PENDING') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-600 dark:text-red-400">
      <XCircle className="w-3 h-3" /> Failed
    </span>
  );
}

function targetBadge(target: TargetAudience) {
  const colors: Record<TargetAudience, string> = {
    ALL: 'bg-muted text-foreground/80',
    FREE: 'bg-muted text-foreground/80',
    STARTER: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    PROFESSIONAL: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    ENTERPRISE: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[target]}`}>
      {target === 'ALL' ? 'All Users' : target.charAt(0) + target.slice(1).toLowerCase()}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const CHANNELS: Channel[] = ['EMAIL', 'PUSH', 'WHATSAPP', 'SMS', 'IN_APP'];
const PAGE_SIZE = 8;

export default function NotificationsPage() {
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<Channel | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<NotifStatus | 'All'>('All');
  const [page, setPage] = useState(1);
  const [showCompose, setShowCompose] = useState(false);

  // Compose state
  const [composeTitle, setComposeTitle] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeChannel, setComposeChannel] = useState<Channel>('EMAIL');
  const [composeTarget, setComposeTarget] = useState<TargetAudience>('ALL');

  const filtered = useMemo(() => {
    return MOCK_NOTIFICATIONS.filter((n) => {
      const q = search.toLowerCase();
      if (q && !n.title.toLowerCase().includes(q) && !n.message.toLowerCase().includes(q)) return false;
      if (channelFilter !== 'All' && n.channel !== channelFilter) return false;
      if (statusFilter !== 'All' && n.status !== statusFilter) return false;
      return true;
    });
  }, [search, channelFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const totalSent = MOCK_NOTIFICATIONS.reduce((s, n) => s + n.delivered, 0);
  const totalFailed = MOCK_NOTIFICATIONS.reduce((s, n) => s + n.failed, 0);
  const totalOpened = MOCK_NOTIFICATIONS.reduce((s, n) => s + n.opened, 0);
  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0';

  return (
    <div className="">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Broadcast Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Send announcements, updates, and promotional notifications to users.
          </p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-foreground rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Compose Notification
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Broadcasts</p>
          <p className="text-2xl font-bold text-foreground mt-1">{MOCK_NOTIFICATIONS.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Delivered</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatNumber(totalSent)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Failed</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatNumber(totalFailed)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Open Rate</p>
          <p className="text-2xl font-bold text-foreground mt-1">{openRate}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary-500"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <select
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value as Channel | 'All'); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="All">All Channels</option>
            {CHANNELS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as NotifStatus | 'All'); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="All">All Statuses</option>
            <option value="DELIVERED">Delivered</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-card/80">
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Notification</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Channel</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Target</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Delivered</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Opened</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sent At</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((notif) => (
                <tr key={notif.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                  <td className="p-4 max-w-[300px]">
                    <p className="text-sm text-foreground font-medium truncate">{notif.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{notif.message}</p>
                  </td>
                  <td className="p-4">{channelBadge(notif.channel)}</td>
                  <td className="p-4">{targetBadge(notif.target)}</td>
                  <td className="p-4">{statusBadge(notif.status)}</td>
                  <td className="p-4 text-sm text-right">
                    <span className="text-foreground font-medium">{formatNumber(notif.delivered)}</span>
                    {notif.failed > 0 && (
                      <span className="text-red-600 dark:text-red-400 text-xs ml-1">({notif.failed} failed)</span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-right">
                    {notif.opened > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {formatNumber(notif.opened)}
                        <span className="text-muted-foreground text-xs ml-1">
                          ({notif.delivered > 0 ? ((notif.opened / notif.delivered) * 100).toFixed(0) : 0}%)
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">{formatDate(notif.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  p === page ? 'bg-primary-500 text-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Compose Broadcast</h2>
              <button
                onClick={() => setShowCompose(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">Title</label>
                <input
                  type="text"
                  value={composeTitle}
                  onChange={(e) => setComposeTitle(e.target.value)}
                  placeholder="Notification title..."
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">Message</label>
                <textarea
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  placeholder="Write your notification message..."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">Channel</label>
                  <select
                    value={composeChannel}
                    onChange={(e) => setComposeChannel(e.target.value as Channel)}
                    className="w-full bg-muted border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
                  >
                    {CHANNELS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-1.5">Target Audience</label>
                  <select
                    value={composeTarget}
                    onChange={(e) => setComposeTarget(e.target.value as TargetAudience)}
                    className="w-full bg-muted border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
                  >
                    <option value="ALL">All Users</option>
                    <option value="FREE">Free Plan Only</option>
                    <option value="STARTER">Starter Plan Only</option>
                    <option value="PROFESSIONAL">Professional Plan Only</option>
                    <option value="ENTERPRISE">Enterprise Plan Only</option>
                  </select>
                </div>
              </div>

              {/* Preview audience count */}
              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  Estimated reach: <span className="text-foreground font-medium">
                    {composeTarget === 'ALL' ? '12,847' :
                     composeTarget === 'FREE' ? '7,840' :
                     composeTarget === 'STARTER' ? '2,456' :
                     composeTarget === 'PROFESSIONAL' ? '1,890' : '661'} users
                  </span>
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button
                onClick={() => setShowCompose(false)}
                className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!composeTitle.trim() || !composeMessage.trim()}
                onClick={() => {
                  alert(`Notification "${composeTitle}" would be sent to ${composeTarget} users via ${composeChannel}`);
                  setShowCompose(false);
                  setComposeTitle('');
                  setComposeMessage('');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-foreground rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Send Notification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
