'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  FileText,
  Calendar,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TenderStatus = 'PUBLISHED' | 'ACTIVE' | 'CLOSED';

interface Tender {
  id: number;
  title: string;
  organization: string;
  sourcePortal: string;
  category: string;
  state: string;
  status: TenderStatus;
  estimatedValue: number;
  publishedDate: string;
  deadline: string;
}

// ---------------------------------------------------------------------------
// Mock Data — 15 realistic Indian government tenders
// ---------------------------------------------------------------------------
const MOCK_TENDERS: Tender[] = [
  { id: 1, title: 'Construction of 4-Lane Highway from NH-48 Junction to Vadodara Bypass', organization: 'National Highways Authority of India (NHAI)', sourcePortal: 'CPPP', category: 'Construction', state: 'Gujarat', status: 'ACTIVE', estimatedValue: 245_00_00_000, publishedDate: '2026-04-01', deadline: '2026-04-25' },
  { id: 2, title: 'Supply of Desktop Computers and Peripherals for Government Schools', organization: 'Ministry of Education', sourcePortal: 'GeM', category: 'IT Equipment', state: 'All India', status: 'ACTIVE', estimatedValue: 12_50_00_000, publishedDate: '2026-04-03', deadline: '2026-04-20' },
  { id: 3, title: 'Renovation and Modernization of District Hospital, Pune', organization: 'Maharashtra Public Health Department', sourcePortal: 'Maharashtra', category: 'Healthcare', state: 'Maharashtra', status: 'PUBLISHED', estimatedValue: 8_75_00_000, publishedDate: '2026-04-08', deadline: '2026-05-01' },
  { id: 4, title: 'Annual Maintenance Contract for CCTV Surveillance System', organization: 'Delhi Police', sourcePortal: 'Delhi', category: 'Security', state: 'Delhi', status: 'ACTIVE', estimatedValue: 3_20_00_000, publishedDate: '2026-03-28', deadline: '2026-04-18' },
  { id: 5, title: 'Development of Smart City Portal and Mobile Application', organization: 'Jaipur Smart City Ltd', sourcePortal: 'Rajasthan', category: 'IT Services', state: 'Rajasthan', status: 'ACTIVE', estimatedValue: 15_00_00_000, publishedDate: '2026-04-05', deadline: '2026-04-30' },
  { id: 6, title: 'Supply of Solar Panels for Rural Electrification Program', organization: 'Ministry of New & Renewable Energy', sourcePortal: 'GeM', category: 'Energy', state: 'All India', status: 'PUBLISHED', estimatedValue: 42_00_00_000, publishedDate: '2026-04-09', deadline: '2026-05-10' },
  { id: 7, title: 'Road Resurfacing and Storm Water Drain Construction', organization: 'BBMP Bengaluru', sourcePortal: 'Karnataka', category: 'Construction', state: 'Karnataka', status: 'ACTIVE', estimatedValue: 18_50_00_000, publishedDate: '2026-04-02', deadline: '2026-04-22' },
  { id: 8, title: 'Procurement of Medical Equipment for PHCs', organization: 'Gujarat Health Department', sourcePortal: 'Gujarat', category: 'Healthcare', state: 'Gujarat', status: 'CLOSED', estimatedValue: 5_40_00_000, publishedDate: '2026-03-10', deadline: '2026-04-05' },
  { id: 9, title: 'Cloud Infrastructure Services for e-Governance Projects', organization: 'NIC (National Informatics Centre)', sourcePortal: 'GeM', category: 'IT Services', state: 'All India', status: 'ACTIVE', estimatedValue: 28_00_00_000, publishedDate: '2026-04-06', deadline: '2026-04-28' },
  { id: 10, title: 'Supply of Uniforms and Protective Gear for Police Personnel', organization: 'Tamil Nadu Police Department', sourcePortal: 'Tamil Nadu', category: 'Textiles', state: 'Tamil Nadu', status: 'CLOSED', estimatedValue: 6_80_00_000, publishedDate: '2026-03-01', deadline: '2026-03-25' },
  { id: 11, title: 'Construction of Community Health Centre in Lucknow', organization: 'UP Health & Family Welfare', sourcePortal: 'Uttar Pradesh', category: 'Construction', state: 'Uttar Pradesh', status: 'PUBLISHED', estimatedValue: 12_00_00_000, publishedDate: '2026-04-09', deadline: '2026-05-05' },
  { id: 12, title: 'Digitization of Land Records and Survey Data', organization: 'Madhya Pradesh Revenue Department', sourcePortal: 'Madhya Pradesh', category: 'IT Services', state: 'Madhya Pradesh', status: 'ACTIVE', estimatedValue: 9_25_00_000, publishedDate: '2026-04-04', deadline: '2026-04-26' },
  { id: 13, title: 'Supply of Agricultural Equipment and Tractors', organization: 'Ministry of Agriculture', sourcePortal: 'CPPP', category: 'Agriculture', state: 'All India', status: 'ACTIVE', estimatedValue: 35_00_00_000, publishedDate: '2026-04-07', deadline: '2026-04-30' },
  { id: 14, title: 'Water Treatment Plant Upgrade and Maintenance', organization: 'Chennai Metro Water', sourcePortal: 'Tamil Nadu', category: 'Water Supply', state: 'Tamil Nadu', status: 'PUBLISHED', estimatedValue: 22_50_00_000, publishedDate: '2026-04-10', deadline: '2026-05-08' },
  { id: 15, title: 'Construction of Flyover at MG Road Junction', organization: 'Ahmedabad Municipal Corporation', sourcePortal: 'Gujarat', category: 'Construction', state: 'Gujarat', status: 'ACTIVE', estimatedValue: 56_00_00_000, publishedDate: '2026-03-30', deadline: '2026-04-24' },
];

const SOURCE_PORTALS = ['GeM', 'CPPP', 'Maharashtra', 'Gujarat', 'Rajasthan', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'Madhya Pradesh', 'Delhi'];
const CATEGORIES = ['Construction', 'IT Equipment', 'IT Services', 'Healthcare', 'Security', 'Energy', 'Textiles', 'Agriculture', 'Water Supply'];
const STATES = ['All India', 'Maharashtra', 'Gujarat', 'Rajasthan', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'Madhya Pradesh', 'Delhi'];
const TENDER_STATUSES: TenderStatus[] = ['PUBLISHED', 'ACTIVE', 'CLOSED'];
const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatINR(num: number): string {
  if (num >= 1_00_00_000) {
    const crore = num / 1_00_00_000;
    return `\u20B9${crore.toFixed(crore % 1 === 0 ? 0 : 2)} Cr`;
  }
  if (num >= 1_00_000) {
    const lakh = num / 1_00_000;
    return `\u20B9${lakh.toFixed(lakh % 1 === 0 ? 0 : 2)} L`;
  }
  return `\u20B9${num.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusBadge(status: TenderStatus) {
  const styles: Record<TenderStatus, string> = {
    PUBLISHED: 'bg-yellow-500/15 text-yellow-400',
    ACTIVE: 'bg-emerald-500/15 text-emerald-400',
    CLOSED: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'ACTIVE' ? 'bg-emerald-400' : status === 'PUBLISHED' ? 'bg-yellow-400' : 'bg-gray-500'
      }`} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function portalBadge(portal: string) {
  const colors: Record<string, string> = {
    GeM: 'bg-blue-500/15 text-blue-400',
    CPPP: 'bg-purple-500/15 text-purple-400',
    Maharashtra: 'bg-orange-500/15 text-orange-400',
    Gujarat: 'bg-teal-500/15 text-teal-400',
    Rajasthan: 'bg-pink-500/15 text-pink-400',
    Karnataka: 'bg-red-500/15 text-red-400',
    'Tamil Nadu': 'bg-green-500/15 text-green-400',
    'Uttar Pradesh': 'bg-amber-500/15 text-amber-400',
    'Madhya Pradesh': 'bg-cyan-500/15 text-cyan-400',
    Delhi: 'bg-indigo-500/15 text-indigo-400',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[portal] || 'bg-muted text-foreground/80'}`}>
      {portal}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TendersPage() {
  const [search, setSearch] = useState('');
  const [portalFilter, setPortalFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [openAction, setOpenAction] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return MOCK_TENDERS.filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.title.toLowerCase().includes(q) && !t.organization.toLowerCase().includes(q)) return false;
      if (portalFilter !== 'All' && t.sourcePortal !== portalFilter) return false;
      if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (stateFilter !== 'All' && t.state !== stateFilter) return false;
      return true;
    });
  }, [search, portalFilter, categoryFilter, statusFilter, stateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tender Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {filtered.length} tender{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Total: {MOCK_TENDERS.length}</span>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col xl:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tenders..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary-500"
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <select
            value={portalFilter}
            onChange={(e) => { setPortalFilter(e.target.value); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="All">All Portals</option>
            {SOURCE_PORTALS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="All">All Statuses</option>
            {TENDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={stateFilter}
            onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
            className="bg-card border border-border rounded-lg text-sm text-foreground/80 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="All">All States</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-card/80">
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[280px]">Title</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Organization</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Portal</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">State</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Est. Value</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Published</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Deadline</th>
                <th className="p-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((tender) => {
                const isOverdue = new Date(tender.deadline) < new Date();
                return (
                  <tr key={tender.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <p className="text-sm text-foreground font-medium line-clamp-2 max-w-xs">{tender.title}</p>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground max-w-[200px] truncate">{tender.organization}</td>
                    <td className="p-4">{portalBadge(tender.sourcePortal)}</td>
                    <td className="p-4 text-sm text-muted-foreground">{tender.category}</td>
                    <td className="p-4 text-sm text-muted-foreground">{tender.state}</td>
                    <td className="p-4">{statusBadge(tender.status)}</td>
                    <td className="p-4 text-sm text-foreground font-medium text-right whitespace-nowrap">{formatINR(tender.estimatedValue)}</td>
                    <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">{formatDate(tender.publishedDate)}</td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`text-sm ${isOverdue && tender.status !== 'CLOSED' ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {formatDate(tender.deadline)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="relative">
                        <button
                          onClick={() => setOpenAction(openAction === tender.id ? null : tender.id)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {openAction === tender.id && (
                          <div className="absolute right-0 top-8 z-10 w-36 bg-muted border border-border rounded-lg shadow-xl py-1">
                            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground/80 hover:bg-muted transition-colors">
                              <Eye className="w-4 h-4" /> View
                            </button>
                            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground/80 hover:bg-muted transition-colors">
                              <Pencil className="w-4 h-4" /> Edit
                            </button>
                            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-muted transition-colors">
                              <Trash2 className="w-4 h-4" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
    </div>
  );
}
