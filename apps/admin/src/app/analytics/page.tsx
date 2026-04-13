'use client';

import { useState } from 'react';
import {
  Search,
  Eye,
  Bookmark,
  MapPin,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const CHART_COLORS = ['#FF6B35', '#00D4AA', '#1B2845', '#FFB800', '#FF4560', '#775DD0'];

// Top searched keywords
const topKeywords = [
  { keyword: 'construction tender', searches: 4520 },
  { keyword: 'IT services', searches: 3890 },
  { keyword: 'road development', searches: 3245 },
  { keyword: 'medical equipment', searches: 2980 },
  { keyword: 'solar energy', searches: 2670 },
  { keyword: 'water supply', searches: 2340 },
  { keyword: 'building renovation', searches: 2100 },
  { keyword: 'security services', searches: 1890 },
  { keyword: 'electrical work', searches: 1650 },
  { keyword: 'software development', searches: 1420 },
];

// Search volume trend (last 30 days)
const searchVolumeTrend = Array.from({ length: 30 }, (_, i) => ({
  name: `Mar ${i + 1}`,
  volume: Math.floor(Math.random() * 3000 + 5000),
}));

// Most viewed tenders
const mostViewedTenders = [
  { id: 1, title: 'Construction of 4-Lane Highway NH-48 Junction', views: 12450, saves: 890 },
  { id: 2, title: 'Supply of Desktop Computers for Schools', views: 9870, saves: 1230 },
  { id: 3, title: 'Cloud Infrastructure Services for NIC', views: 8540, saves: 670 },
  { id: 4, title: 'Solar Panels for Rural Electrification', views: 7890, saves: 980 },
  { id: 5, title: 'Smart City Portal Development Jaipur', views: 6720, saves: 540 },
  { id: 6, title: 'Road Resurfacing BBMP Bengaluru', views: 5980, saves: 420 },
  { id: 7, title: 'Medical Equipment for Primary Health Centres', views: 5430, saves: 760 },
  { id: 8, title: 'Water Treatment Plant Upgrade Chennai', views: 4890, saves: 380 },
];

// Most saved tenders
const mostSavedTenders = [
  { id: 1, title: 'Supply of Desktop Computers for Schools', saves: 1230 },
  { id: 2, title: 'Solar Panels for Rural Electrification', saves: 980 },
  { id: 3, title: 'Construction of 4-Lane Highway NH-48', saves: 890 },
  { id: 4, title: 'Medical Equipment for Primary Health Centres', saves: 760 },
  { id: 5, title: 'Cloud Infrastructure Services for NIC', saves: 670 },
  { id: 6, title: 'Smart City Portal Development Jaipur', saves: 540 },
  { id: 7, title: 'Road Resurfacing BBMP Bengaluru', saves: 420 },
  { id: 8, title: 'Water Treatment Plant Upgrade Chennai', saves: 380 },
];

// Geographic distribution by state
const stateDistribution = [
  { state: 'Maharashtra', users: 2850 },
  { state: 'Gujarat', users: 2340 },
  { state: 'Delhi', users: 1980 },
  { state: 'Karnataka', users: 1670 },
  { state: 'Tamil Nadu', users: 1420 },
  { state: 'Uttar Pradesh', users: 1280 },
  { state: 'Rajasthan', users: 1100 },
  { state: 'Madhya Pradesh', users: 890 },
  { state: 'West Bengal', users: 750 },
  { state: 'Telangana', users: 620 },
];

// Activity heatmap data (7 days x 24 hours)
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const heatmapData: number[][] = days.map(() =>
  Array.from({ length: 24 }, (_, hour) => {
    // Simulate realistic activity patterns
    if (hour >= 0 && hour < 6) return Math.floor(Math.random() * 20);
    if (hour >= 6 && hour < 9) return Math.floor(Math.random() * 60 + 20);
    if (hour >= 9 && hour < 18) return Math.floor(Math.random() * 80 + 60);
    if (hour >= 18 && hour < 22) return Math.floor(Math.random() * 50 + 30);
    return Math.floor(Math.random() * 30 + 10);
  })
);

// Tender volume by category
const tenderByCategory = [
  { category: 'Construction', count: 3450 },
  { category: 'IT Services', count: 2890 },
  { category: 'Healthcare', count: 2340 },
  { category: 'Energy', count: 1980 },
  { category: 'Agriculture', count: 1670 },
  { category: 'Security', count: 1230 },
  { category: 'Water Supply', count: 1100 },
  { category: 'Education', count: 890 },
];

// Tender volume by state
const tenderByState = [
  { state: 'Maharashtra', count: 4520 },
  { state: 'Gujarat', count: 3890 },
  { state: 'Karnataka', count: 3245 },
  { state: 'Tamil Nadu', count: 2980 },
  { state: 'Delhi', count: 2670 },
  { state: 'Uttar Pradesh', count: 2340 },
  { state: 'Rajasthan', count: 2100 },
  { state: 'Madhya Pradesh', count: 1890 },
];

// New tenders per day (last 30 days)
const newTendersPerDay = Array.from({ length: 30 }, (_, i) => ({
  name: `Mar ${i + 1}`,
  tenders: Math.floor(Math.random() * 300 + 200),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

function getHeatColor(value: number): string {
  if (value < 15) return 'bg-muted';
  if (value < 30) return 'bg-emerald-900/40';
  if (value < 50) return 'bg-emerald-800/50';
  if (value < 80) return 'bg-emerald-600/50';
  if (value < 100) return 'bg-emerald-500/60';
  return 'bg-emerald-400/70';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AnalyticsPage() {
  return (
    <div className="">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Comprehensive analytics across search, content, users, and tenders.
        </p>
      </div>

      {/* ========== SEARCH ANALYTICS ========== */}
      <SectionTitle title="Search Analytics" icon={<Search className="w-5 h-5" />} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top searched keywords */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Top Searched Keywords</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={topKeywords} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" stroke="#6B7280" fontSize={12} tickLine={false} />
              <YAxis dataKey="keyword" type="category" stroke="#6B7280" fontSize={11} tickLine={false} width={140} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }}
                labelStyle={{ color: '#6B7280' }}
                formatter={(value: number) => [formatNumber(value), 'Searches']}
              />
              <Bar dataKey="searches" fill="#FF6B35" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Search volume trend */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Search Volume Trend (30 Days)</h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={searchVolumeTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} interval={4} />
              <YAxis stroke="#6B7280" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }}
                labelStyle={{ color: '#6B7280' }}
                formatter={(value: number) => [formatNumber(value), 'Searches']}
              />
              <Line type="monotone" dataKey="volume" stroke="#00D4AA" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========== CONTENT ANALYTICS ========== */}
      <SectionTitle title="Content Analytics" icon={<Eye className="w-5 h-5" />} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Most viewed tenders */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Most Viewed Tenders</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Views</th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Saves</th>
                </tr>
              </thead>
              <tbody>
                {mostViewedTenders.map((t, idx) => (
                  <tr key={t.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium w-5">{idx + 1}.</span>
                        <span className="text-sm text-foreground/80 truncate max-w-[240px]">{t.title}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-sm text-foreground font-medium text-right">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3 h-3 text-muted-foreground" />
                        {formatNumber(t.views)}
                      </span>
                    </td>
                    <td className="py-2.5 text-sm text-muted-foreground text-right">
                      <span className="inline-flex items-center gap-1">
                        <Bookmark className="w-3 h-3 text-muted-foreground" />
                        {formatNumber(t.saves)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Most saved tenders */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Most Saved Tenders</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                  <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Saves</th>
                </tr>
              </thead>
              <tbody>
                {mostSavedTenders.map((t, idx) => (
                  <tr key={t.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium w-5">{idx + 1}.</span>
                        <span className="text-sm text-foreground/80 truncate max-w-[280px]">{t.title}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-sm text-foreground font-medium text-right">
                      <span className="inline-flex items-center gap-1">
                        <Bookmark className="w-3 h-3 text-primary-500" />
                        {formatNumber(t.saves)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== USER ANALYTICS ========== */}
      <SectionTitle title="User Analytics" icon={<MapPin className="w-5 h-5" />} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Geographic distribution */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Geographic Distribution</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={stateDistribution} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" stroke="#6B7280" fontSize={12} tickLine={false} />
              <YAxis dataKey="state" type="category" stroke="#6B7280" fontSize={11} tickLine={false} width={120} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }}
                labelStyle={{ color: '#6B7280' }}
                formatter={(value: number) => [formatNumber(value), 'Users']}
              />
              <Bar dataKey="users" fill="#00D4AA" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity heatmap */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Activity Heatmap (Hour of Day)</h3>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex mb-1 ml-10">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
                    {h % 3 === 0 ? `${h}` : ''}
                  </div>
                ))}
              </div>
              {/* Rows */}
              {days.map((day, dayIdx) => (
                <div key={day} className="flex items-center gap-1 mb-1">
                  <span className="w-9 text-xs text-muted-foreground text-right shrink-0">{day}</span>
                  <div className="flex flex-1 gap-[2px]">
                    {heatmapData[dayIdx].map((val, hourIdx) => (
                      <div
                        key={hourIdx}
                        className={`flex-1 h-5 rounded-sm ${getHeatColor(val)}`}
                        title={`${day} ${hourIdx}:00 - ${val} activities`}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 ml-10">
                <span className="text-xs text-muted-foreground">Less</span>
                <div className="w-4 h-3 rounded-sm bg-muted" />
                <div className="w-4 h-3 rounded-sm bg-emerald-900/40" />
                <div className="w-4 h-3 rounded-sm bg-emerald-800/50" />
                <div className="w-4 h-3 rounded-sm bg-emerald-600/50" />
                <div className="w-4 h-3 rounded-sm bg-emerald-500/60" />
                <div className="w-4 h-3 rounded-sm bg-emerald-400/70" />
                <span className="text-xs text-muted-foreground">More</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== TENDER ANALYTICS ========== */}
      <SectionTitle title="Tender Analytics" icon={<BarChart3 className="w-5 h-5" />} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Tender volume by category */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Tender Volume by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tenderByCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="category" stroke="#6B7280" fontSize={10} tickLine={false} angle={-20} textAnchor="end" height={50} />
              <YAxis stroke="#6B7280" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }}
                labelStyle={{ color: '#6B7280' }}
                formatter={(value: number) => [formatNumber(value), 'Tenders']}
              />
              <Bar dataKey="count" fill="#FF6B35" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tender volume by state */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Tender Volume by State</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tenderByState} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" stroke="#6B7280" fontSize={12} tickLine={false} />
              <YAxis dataKey="state" type="category" stroke="#6B7280" fontSize={11} tickLine={false} width={120} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }}
                labelStyle={{ color: '#6B7280' }}
                formatter={(value: number) => [formatNumber(value), 'Tenders']}
              />
              <Bar dataKey="count" fill="#775DD0" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* New tenders per day */}
      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">New Tenders Per Day (Last 30 Days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={newTendersPerDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} interval={4} />
            <YAxis stroke="#6B7280" fontSize={12} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151' }}
              labelStyle={{ color: '#6B7280' }}
              formatter={(value: number) => [formatNumber(value), 'New Tenders']}
            />
            <Line type="monotone" dataKey="tenders" stroke="#FFB800" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Title
// ---------------------------------------------------------------------------
function SectionTitle({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-2">
      <div className="text-primary-500">{icon}</div>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
    </div>
  );
}
