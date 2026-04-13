'use client';

import { useState, useMemo } from 'react';
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
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type Category = 'Billing' | 'Technical' | 'Scraper Issue' | 'Account' | 'Feature Request' | 'Bug Report';
type Plan = 'Free' | 'Starter' | 'Professional' | 'Enterprise';

interface Ticket {
  id: string;
  subject: string;
  userName: string;
  userEmail: string;
  userPlan: Plan;
  category: Category;
  priority: Priority;
  status: TicketStatus;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage: string;
}

// ---------------------------------------------------------------------------
// Mock Data — 12 realistic Indian user support tickets
// ---------------------------------------------------------------------------
const MOCK_TICKETS: Ticket[] = [
  {
    id: 'TKT-1247',
    subject: 'Payment failed but amount deducted',
    userName: 'Rajesh Kumar',
    userEmail: 'rajesh.kumar@infosys.com',
    userPlan: 'Professional',
    category: 'Billing',
    priority: 'URGENT',
    status: 'OPEN',
    assignedTo: 'Arun Mehta',
    createdAt: '2026-04-11T08:15:00Z',
    updatedAt: '2026-04-11T09:30:00Z',
    lastMessage: 'I tried upgrading to Enterprise plan and Rs. 14,999 was debited from my HDFC account but the plan did not change. Transaction ID: RZP_8847291. Please refund or activate the plan immediately.',
  },
  {
    id: 'TKT-1246',
    subject: 'GeM tender data not updating since 3 days',
    userName: 'Suresh Menon',
    userEmail: 'suresh.menon@larsentoubro.com',
    userPlan: 'Enterprise',
    category: 'Scraper Issue',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assignedTo: 'Priya Nair',
    createdAt: '2026-04-09T14:22:00Z',
    updatedAt: '2026-04-11T07:45:00Z',
    lastMessage: 'We rely on GeM tenders for our daily bidding. The last scraped data shows April 6. This is affecting our Enterprise team of 12 people. We are missing critical defence procurement tenders.',
  },
  {
    id: 'TKT-1245',
    subject: 'Cannot download tender document PDF',
    userName: 'Ananya Deshmukh',
    userEmail: 'ananya.d@mahindra.com',
    userPlan: 'Starter',
    category: 'Technical',
    priority: 'MEDIUM',
    status: 'WAITING',
    assignedTo: 'Karthik Iyer',
    createdAt: '2026-04-09T11:05:00Z',
    updatedAt: '2026-04-10T16:30:00Z',
    lastMessage: 'When I click on "Download Documents" for tender CPPP/2026/04/1892, I get a 404 error. I have tried on Chrome and Firefox both. Attached screenshot of the error.',
  },
  {
    id: 'TKT-1244',
    subject: 'Upgrade plan but still showing old limits',
    userName: 'Vikram Singh',
    userEmail: 'vikram.singh@reliance.com',
    userPlan: 'Professional',
    category: 'Billing',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assignedTo: 'Arun Mehta',
    createdAt: '2026-04-08T17:40:00Z',
    updatedAt: '2026-04-10T14:20:00Z',
    lastMessage: 'I upgraded from Starter to Professional plan 2 days ago. Payment confirmation received via email. But my dashboard still shows 50 views/day limit instead of unlimited. Please fix this urgently.',
  },
  {
    id: 'TKT-1243',
    subject: 'AI eligibility check giving wrong results',
    userName: 'Kavita Bhatt',
    userEmail: 'kavita.bhatt@godrej.com',
    userPlan: 'Professional',
    category: 'Technical',
    priority: 'MEDIUM',
    status: 'OPEN',
    assignedTo: null,
    createdAt: '2026-04-08T10:30:00Z',
    updatedAt: '2026-04-08T10:30:00Z',
    lastMessage: 'The AI eligibility checker says we are not eligible for tender MH/PWD/2026/445 but we meet all the criteria - turnover, experience, and registration. We have been bidding on similar tenders for 5 years.',
  },
  {
    id: 'TKT-1242',
    subject: 'Request for API access documentation',
    userName: 'Deepa Nair',
    userEmail: 'deepa.nair@techm.com',
    userPlan: 'Enterprise',
    category: 'Feature Request',
    priority: 'LOW',
    status: 'WAITING',
    assignedTo: 'Priya Nair',
    createdAt: '2026-04-07T09:15:00Z',
    updatedAt: '2026-04-09T11:00:00Z',
    lastMessage: 'Our development team wants to integrate TenderBazaar data into our internal ERP system. Could you share the API documentation and Postman collection? We are on Enterprise plan.',
  },
  {
    id: 'TKT-1241',
    subject: 'WhatsApp alerts not being delivered',
    userName: 'Manoj Tiwari',
    userEmail: 'manoj.tiwari@bhel.com',
    userPlan: 'Professional',
    category: 'Technical',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assignedTo: 'Karthik Iyer',
    createdAt: '2026-04-06T16:50:00Z',
    updatedAt: '2026-04-10T09:15:00Z',
    lastMessage: 'I have configured 8 tender alerts with WhatsApp delivery but haven\'t received any messages since April 4. Email alerts are working fine. My WhatsApp number is +91 95678 90123.',
  },
  {
    id: 'TKT-1240',
    subject: 'Need to change registered email',
    userName: 'Pooja Saxena',
    userEmail: 'pooja.saxena@ntpc.com',
    userPlan: 'Free',
    category: 'Account',
    priority: 'LOW',
    status: 'RESOLVED',
    assignedTo: 'Arun Mehta',
    createdAt: '2026-04-05T13:20:00Z',
    updatedAt: '2026-04-06T10:45:00Z',
    lastMessage: 'Thank you for updating my email. The new email pooja.s@ntpc.co.in is now working correctly. I can receive OTPs and alerts on it.',
  },
  {
    id: 'TKT-1239',
    subject: 'Bulk export not working for Enterprise plan',
    userName: 'Rohit Joshi',
    userEmail: 'rohit.joshi@adani.com',
    userPlan: 'Enterprise',
    category: 'Bug Report',
    priority: 'MEDIUM',
    status: 'OPEN',
    assignedTo: null,
    createdAt: '2026-04-05T08:00:00Z',
    updatedAt: '2026-04-05T08:00:00Z',
    lastMessage: 'When I try to export more than 500 tenders to CSV, the export button shows a spinner and then nothing happens. Browser console shows a timeout error after 30 seconds. Tested on latest Chrome.',
  },
  {
    id: 'TKT-1238',
    subject: 'Request for Maharashtra portal integration',
    userName: 'Amit Patel',
    userEmail: 'amit.patel@tatasteel.com',
    userPlan: 'Enterprise',
    category: 'Feature Request',
    priority: 'LOW',
    status: 'CLOSED',
    assignedTo: 'Priya Nair',
    createdAt: '2026-04-03T11:30:00Z',
    updatedAt: '2026-04-08T15:00:00Z',
    lastMessage: 'Great to hear Maharashtra e-procurement portal is on the Q2 roadmap! Looking forward to it. Our Maharashtra operations team handles 40+ tenders monthly from that portal.',
  },
  {
    id: 'TKT-1237',
    subject: 'Unable to login after password reset',
    userName: 'Lakshmi Krishnan',
    userEmail: 'lakshmi.k@biocon.com',
    userPlan: 'Starter',
    category: 'Account',
    priority: 'URGENT',
    status: 'OPEN',
    assignedTo: 'Arun Mehta',
    createdAt: '2026-04-11T06:45:00Z',
    updatedAt: '2026-04-11T08:10:00Z',
    lastMessage: 'I reset my password via the forgot password link but the new password is not working. I have tried 5 times and now my account seems locked. I have a tender submission deadline today at 3 PM IST.',
  },
  {
    id: 'TKT-1236',
    subject: 'Invoice GST number incorrect',
    userName: 'Harish Bansal',
    userEmail: 'harish.bansal@gail.com',
    userPlan: 'Professional',
    category: 'Billing',
    priority: 'MEDIUM',
    status: 'WAITING',
    assignedTo: 'Arun Mehta',
    createdAt: '2026-04-04T14:10:00Z',
    updatedAt: '2026-04-07T12:30:00Z',
    lastMessage: 'The invoice #INV-2026-1847 shows GST number 07AAACG1234A1Z5 but our correct GSTIN is 09AAACG5678B2Z3. Please issue a credit note and revised invoice. Our accounts team needs it for quarterly filing.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function priorityBadge(priority: Priority) {
  const styles: Record<Priority, string> = {
    LOW: 'bg-muted text-muted-foreground',
    MEDIUM: 'bg-blue-500/15 text-blue-400',
    HIGH: 'bg-orange-500/15 text-orange-400',
    URGENT: 'bg-red-500/15 text-red-400 animate-pulse',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[priority]}`}>
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
  const s = styles[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

function planBadge(plan: Plan) {
  const colors: Record<Plan, string> = {
    Free: 'bg-muted text-foreground/80',
    Starter: 'bg-blue-500/15 text-blue-400',
    Professional: 'bg-orange-500/15 text-orange-400',
    Enterprise: 'bg-purple-500/15 text-purple-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${colors[plan]}`}>
      {plan}
    </span>
  );
}

function categoryTag(category: Category) {
  const colors: Record<Category, string> = {
    Billing: 'bg-emerald-500/15 text-emerald-400',
    Technical: 'bg-cyan-500/15 text-cyan-400',
    'Scraper Issue': 'bg-amber-500/15 text-amber-400',
    Account: 'bg-violet-500/15 text-violet-400',
    'Feature Request': 'bg-pink-500/15 text-pink-400',
    'Bug Report': 'bg-red-500/15 text-red-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[category]}`}>
      <Tag className="w-3 h-3" />
      {category}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr: string): string {
  const now = new Date('2026-04-11T10:00:00Z');
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'];
const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const CATEGORIES: Category[] = ['Billing', 'Technical', 'Scraper Issue', 'Account', 'Feature Request', 'Bug Report'];
const PAGE_SIZE = 6;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SupportPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'All'>('All');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const [page, setPage] = useState(1);
  const [replyTicket, setReplyTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');

  // Filtered tickets
  const filtered = useMemo(() => {
    return MOCK_TICKETS.filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.id.toLowerCase().includes(q) && !t.userName.toLowerCase().includes(q) && !t.subject.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
      return true;
    });
  }, [search, statusFilter, priorityFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const openCount = MOCK_TICKETS.filter((t) => t.status === 'OPEN').length;
  const inProgressCount = MOCK_TICKETS.filter((t) => t.status === 'IN_PROGRESS').length;
  const resolvedTodayCount = MOCK_TICKETS.filter((t) => t.status === 'RESOLVED' && t.updatedAt.startsWith('2026-04')).length;

  return (
    <div className="">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Managing {MOCK_TICKETS.length} total tickets across all categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Headphones className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Support Queue</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Open Tickets */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Open Tickets</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">23</p>
        </div>

        {/* In Progress */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Loader2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">In Progress</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">15</p>
        </div>

        {/* Resolved Today */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Resolved Today</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">8</p>
        </div>

        {/* Avg Response Time */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Avg Response Time</p>
          <p className="text-2xl font-bold text-foreground mt-1">2.4h</p>
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
            <p className="text-2xl font-bold text-foreground">4.6</p>
            <span className="text-sm text-muted-foreground">/5</span>
            <div className="flex items-center gap-0.5 ml-1">
              {[1, 2, 3, 4].map((i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
              <Star className="w-3.5 h-3.5 fill-amber-400/50 text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
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
            onChange={(e) => { setPriorityFilter(e.target.value as Priority | 'All'); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="All">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value as Category | 'All'); setPage(1); }}
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
        {paginated.map((ticket) => (
          <div
            key={ticket.id}
            className="bg-card border border-border rounded-xl p-5 hover:border-border transition-colors"
          >
            {/* Top row: ID + badges */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-mono text-muted-foreground">#{ticket.id}</span>
                {statusBadge(ticket.status)}
                {priorityBadge(ticket.priority)}
                {categoryTag(ticket.category)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setReplyTicket(ticket); setReplyText(''); }}
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
                  {ticket.userName.split(' ').map((n) => n[0]).join('')}
                </div>
                <span className="text-sm text-foreground/80">{ticket.userName}</span>
                <span className="text-xs text-muted-foreground">{ticket.userEmail}</span>
                {planBadge(ticket.userPlan)}
              </div>
            </div>

            {/* Last message preview */}
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
              {ticket.lastMessage}
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
        ))}

        {paginated.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Headphones className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No tickets match your filters.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between mt-6 bg-card border border-border rounded-xl px-4 py-3">
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
      )}

      {/* Reply Modal */}
      {replyTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Reply to Ticket</h2>
                <p className="text-xs text-muted-foreground mt-0.5">#{replyTicket.id} - {replyTicket.subject}</p>
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
                    {replyTicket.userName.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <span className="text-xs text-foreground/80 font-medium">{replyTicket.userName}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(replyTicket.updatedAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {replyTicket.lastMessage}
                </p>
              </div>
            </div>

            {/* Reply form */}
            <div className="px-6 pb-4">
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">Your Reply</label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply to the user..."
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
                disabled={!replyText.trim()}
                onClick={() => {
                  alert(`Reply sent to ticket ${replyTicket.id}: "${replyText.slice(0, 60)}..."`);
                  setReplyTicket(null);
                  setReplyText('');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-foreground rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Send Reply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
