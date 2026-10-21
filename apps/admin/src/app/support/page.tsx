'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Headphones,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Star,
  X,
  Send,
  User,
  Tag,
  Calendar,
  ArrowUpRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { ToastAlert } from '@/components/toast-alert';
import {
  getSupportTickets,
  getSupportStats,
  replyToTicket,
  updateTicket,
} from '@/lib/admin-api';
import type {
  SupportTicketRecord,
  SupportTicketStats,
  TicketStatus,
  TicketPriority,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'];
const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const CATEGORIES = ['Billing', 'Technical', 'Scraper Issue', 'Account', 'Feature Request', 'Bug Report'];
const PAGE_SIZE = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function priorityBadge(priority: TicketPriority) {
  const styles: Record<TicketPriority, string> = {
    LOW: 'bg-muted text-muted-foreground',
    MEDIUM: 'bg-blue-500/15 text-blue-400',
    HIGH: 'bg-orange-500/15 text-orange-400',
    URGENT: 'bg-red-500/15 text-red-400 animate-pulse',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[priority] || styles.LOW}`}>
      {priority === 'URGENT' && <AlertTriangle className="w-3 h-3" />}
      {priority}
    </span>
  );
}

function statusBadge(status: TicketStatus) {
  const styles: Record<TicketStatus, { bg: string; icon: React.ReactNode; label: string }> = {
    OPEN: { bg: 'bg-orange-500/15 text-orange-400', icon: <MessageCircle className="w-3 h-3" />, label: 'Open' },
    IN_PROGRESS: { bg: 'bg-blue-500/15 text-blue-400', icon: <Loader2 className="w-3 h-3" />, label: 'In Progress' },
    WAITING: { bg: 'bg-amber-500/15 text-amber-400', icon: <Clock className="w-3 h-3" />, label: 'Waiting' },
    RESOLVED: { bg: 'bg-emerald-500/15 text-emerald-400', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Resolved' },
    CLOSED: { bg: 'bg-muted text-muted-foreground', icon: <X className="w-3 h-3" />, label: 'Closed' },
  };
  const s = styles[status] || styles.OPEN;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

function planBadge(plan?: string) {
  const planName = plan || 'Free';
  const colors: Record<string, string> = {
    Free: 'bg-muted text-foreground/80',
    Starter: 'bg-blue-500/15 text-blue-400',
    Professional: 'bg-orange-500/15 text-orange-400',
    Enterprise: 'bg-purple-500/15 text-purple-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${colors[planName] || 'bg-muted text-foreground/80'}`}>
      {planName}
    </span>
  );
}

function categoryTag(category?: string | null) {
  const cat = category || 'General';
  const colors: Record<string, string> = {
    Billing: 'bg-emerald-500/15 text-emerald-400',
    Technical: 'bg-cyan-500/15 text-cyan-400',
    'Scraper Issue': 'bg-amber-500/15 text-amber-400',
    Account: 'bg-violet-500/15 text-violet-400',
    'Feature Request': 'bg-pink-500/15 text-pink-400',
    'Bug Report': 'bg-red-500/15 text-red-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[cat] || 'bg-muted text-muted-foreground'}`}>
      <Tag className="w-3 h-3" />
      {cat}
    </span>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<SupportTicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'All'>('All');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [page, setPage] = useState(1);

  const [replyTicket, setReplyTicket] = useState<SupportTicketRecord | null>(null);
  const [replyText, setReplyText] = useState('');
  const [targetStatus, setTargetStatus] = useState<TicketStatus | ''>('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const [, startTransition] = useTransition();

  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'info'; message: string }>({
    show: false,
    type: 'success',
    message: '',
  });

  // Fetch Stats from Database
  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await getSupportStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load support stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Tickets from Database
  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getSupportTickets({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        priority: priorityFilter !== 'All' ? priorityFilter : undefined,
        category: categoryFilter !== 'All' ? categoryFilter : undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      setTickets(res.tickets);
      setTotal(res.total);
    } catch (err: any) {
      console.error('Failed to load support tickets:', err);
      setToast({
        show: true,
        type: 'error',
        message: err.message || 'Failed to load tickets from server',
      });
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter, categoryFilter]);

  // Initial stats load
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Load tickets on filter or page change
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        loadTickets();
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [loadTickets]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Handle Reply Submission
  const handleSendReply = async () => {
    if (!replyTicket || !replyText.trim() || submittingReply) return;

    try {
      setSubmittingReply(true);

      // Send the real reply via API
      await replyToTicket(replyTicket.id, replyText.trim());

      // If user selected a new status, update it
      if (targetStatus && targetStatus !== replyTicket.status) {
        await updateTicket(replyTicket.id, { status: targetStatus });
      }

      setToast({
        show: true,
        type: 'success',
        message: `Reply sent successfully to ticket #${replyTicket.id.slice(-6).toUpperCase()}`,
      });

      setReplyTicket(null);
      setReplyText('');
      setTargetStatus('');

      // Refresh real data from database
      await Promise.all([loadTickets(), loadStats()]);
    } catch (err: any) {
      setToast({
        show: true,
        type: 'error',
        message: err.message || 'Failed to send reply',
      });
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Managing {stats?.total ?? total} total tickets across all categories
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadStats();
              loadTickets();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh from Database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loading || statsLoading) ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <div className="flex items-center gap-2">
            <Headphones className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Support Queue</span>
          </div>
        </div>
      </div>

      {/* Real Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Open Tickets */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Open Tickets</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">
            {statsLoading ? '...' : (stats?.byStatus?.open ?? 0)}
          </p>
        </div>

        {/* In Progress */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Loader2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">In Progress</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {statsLoading ? '...' : (stats?.byStatus?.inProgress ?? 0)}
          </p>
        </div>

        {/* Resolved Today */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Resolved Today</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {statsLoading ? '...' : (stats?.resolvedToday ?? stats?.byStatus?.resolved ?? 0)}
          </p>
        </div>

        {/* Avg Response Time */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Avg Response Time</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {statsLoading ? '...' : (stats?.avgResolutionHours ? `${stats.avgResolutionHours}h` : 'N/A')}
          </p>
        </div>

        {/* CSAT Score */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Star className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">CSAT Score</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-bold text-foreground">
              {statsLoading ? '...' : (stats?.csatScore ? stats.csatScore.toFixed(1) : 'N/A')}
            </p>
            {stats?.csatScore ? (
              <>
                <span className="text-sm text-muted-foreground">/5</span>
                <div className="flex items-center gap-0.5 ml-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i <= Math.round(stats.csatScore)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-muted text-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Dynamic Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by ticket ID, subject, or user name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary-500"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as TicketStatus | 'All'); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="All">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value as TicketPriority | 'All'); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="All">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Ticket Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Loading tickets from database...</p>
          </div>
        ) : tickets.length > 0 ? (
          tickets.map((ticket) => {
            const userName = ticket.user?.name || 'User';
            const userEmail = ticket.user?.email || '';
            const userPlan = ticket.userPlan || ticket.user?.subscription?.plan?.name || 'Free';
            const displayId = ticket.id.length > 8 ? `TKT-${ticket.id.slice(-4).toUpperCase()}` : ticket.id;

            return (
              <div
                key={ticket.id}
                className="bg-card border border-border rounded-xl p-5 hover:border-border transition-colors"
              >
                {/* Top row: ID + badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-mono text-muted-foreground">#{displayId}</span>
                    {statusBadge(ticket.status)}
                    {priorityBadge(ticket.priority)}
                    {categoryTag(ticket.category)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setReplyTicket(ticket);
                        setReplyText('');
                        setTargetStatus(ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500/15 text-primary-500 border border-primary-500/30 rounded-lg text-xs font-medium hover:bg-primary-500/25 transition-colors"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Reply
                    </button>
                  </div>
                </div>

                {/* Subject */}
                <h3 className="text-foreground font-semibold text-sm mb-2">{ticket.subject}</h3>

                {/* User info row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-foreground/80 shrink-0">
                      {userName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="text-sm text-foreground/80">{userName}</span>
                    <span className="text-xs text-muted-foreground">{userEmail}</span>
                    {planBadge(userPlan)}
                  </div>
                </div>

                {/* Last message preview */}
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                  {ticket.lastMessage || ticket.description}
                </p>

                {/* Footer row: dates + assigned */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-border">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      Created: {formatDate(ticket.createdAt)}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Updated: {timeAgo(ticket.updatedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <User className="w-3 h-3 text-muted-foreground" />
                    {ticket.assignedTo ? (
                      <span className="text-muted-foreground">{ticket.assignedTo}</span>
                    ) : (
                      <span className="text-red-400 font-medium">Unassigned</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Headphones className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No tickets match your filters.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between mt-6 bg-card border border-border rounded-xl px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
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
      )}

      {/* Reply Modal */}
      {replyTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Reply to Ticket</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  #{replyTicket.id.length > 8 ? `TKT-${replyTicket.id.slice(-4).toUpperCase()}` : replyTicket.id} - {replyTicket.subject}
                </p>
              </div>
              <button
                onClick={() => setReplyTicket(null)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Ticket context */}
            <div className="px-6 pt-4">
              <div className="bg-muted/50 border border-border rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium text-foreground/80">
                    {(replyTicket.user?.name || 'User').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <span className="text-xs text-foreground/80 font-medium">{replyTicket.user?.name || 'User'}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(replyTicket.updatedAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {replyTicket.lastMessage || replyTicket.description}
                </p>
              </div>
            </div>

            {/* Update Status Option */}
            <div className="px-6 pb-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Update Ticket Status</label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as TicketStatus)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            {/* Reply form */}
            <div className="px-6 pb-4">
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">Your Reply</label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your response to the user..."
                rows={5}
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary-500 resize-none"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button
                onClick={() => setReplyTicket(null)}
                className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!replyText.trim() || submittingReply}
                onClick={handleSendReply}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-foreground rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingReply ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submittingReply ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Toast Alert */}
      <ToastAlert
        show={toast.show}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </div>
  );
}
