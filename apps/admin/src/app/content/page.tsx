'use client';

import { useState } from 'react';
import {
  FileText,
  Plus,
  Megaphone,
  Image,
  Eye,
  Heart,
  Pencil,
  Trash2,
  Calendar,
  User,
  Clock,
  MousePointerClick,
  BarChart3,
  ExternalLink,
  BookOpen,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Wrench,
  Gift,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Tab = 'blog' | 'announcements' | 'banners';
type PostStatus = 'PUBLISHED' | 'DRAFT' | 'SCHEDULED';
type AnnouncementType = 'MAINTENANCE' | 'FEATURE' | 'UPDATE' | 'ALERT';
type TargetAudience = 'ALL' | 'FREE' | 'PAID' | 'ENTERPRISE';
type BannerPosition = 'TOP_BAR' | 'DASHBOARD' | 'SIDEBAR';

interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  author: string;
  authorInitials: string;
  publishedDate: string;
  status: PostStatus;
  views: number;
  likes: number;
  gradient: string;
}

interface Announcement {
  id: number;
  type: AnnouncementType;
  title: string;
  message: string;
  target: TargetAudience;
  startDate: string;
  endDate: string;
  active: boolean;
}

interface Banner {
  id: number;
  title: string;
  ctaText: string;
  linkUrl: string;
  position: BannerPosition;
  active: boolean;
  impressions: number;
  clicks: number;
  gradient: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------
const MOCK_BLOG_POSTS: BlogPost[] = [
  {
    id: 1,
    title: 'Complete Guide to GeM Portal Registration 2026',
    excerpt: 'Step-by-step walkthrough for registering your business on the Government e-Marketplace portal, including document requirements and verification process.',
    author: 'Priya Sharma',
    authorInitials: 'PS',
    publishedDate: '2026-04-08',
    status: 'PUBLISHED',
    views: 12450,
    likes: 342,
    gradient: 'from-orange-500/20 to-amber-500/20',
  },
  {
    id: 2,
    title: 'Top 10 Tips to Win Government Tenders',
    excerpt: 'Expert strategies and insider tips to improve your success rate in government tender bidding, from document preparation to pricing strategy.',
    author: 'Rajesh Kumar',
    authorInitials: 'RK',
    publishedDate: '2026-04-05',
    status: 'PUBLISHED',
    views: 8930,
    likes: 278,
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    id: 3,
    title: 'Understanding EMD and Bid Security Requirements',
    excerpt: 'A comprehensive breakdown of Earnest Money Deposit requirements across different government portals and how to manage your bid security efficiently.',
    author: 'Anita Desai',
    authorInitials: 'AD',
    publishedDate: '2026-04-02',
    status: 'PUBLISHED',
    views: 6720,
    likes: 195,
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
  {
    id: 4,
    title: 'How AI is Transforming Tender Discovery in India',
    excerpt: 'Explore how artificial intelligence and machine learning are revolutionizing the way businesses find and evaluate government tender opportunities.',
    author: 'Vikram Patel',
    authorInitials: 'VP',
    publishedDate: '2026-03-28',
    status: 'PUBLISHED',
    views: 5340,
    likes: 167,
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
  {
    id: 5,
    title: 'State-wise Tender Portal Guide: Maharashtra to Tamil Nadu',
    excerpt: 'Navigate the different state e-procurement portals across India with this detailed guide covering registration, search, and bidding processes.',
    author: 'Meera Iyer',
    authorInitials: 'MI',
    publishedDate: '2026-04-10',
    status: 'SCHEDULED',
    views: 0,
    likes: 0,
    gradient: 'from-rose-500/20 to-orange-500/20',
  },
  {
    id: 6,
    title: 'New CPPP Guidelines: What Contractors Need to Know',
    excerpt: 'The Central Public Procurement Portal has released updated guidelines for 2026. Here is everything contractors and suppliers need to know about the changes.',
    author: 'Arjun Nair',
    authorInitials: 'AN',
    publishedDate: '',
    status: 'DRAFT',
    views: 0,
    likes: 0,
    gradient: 'from-gray-500/20 to-slate-500/20',
  },
];

const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    type: 'MAINTENANCE',
    title: 'Scheduled Maintenance: April 15, 2-4 AM IST',
    message: 'We will be performing scheduled server maintenance. The platform may be unavailable during this window. All scraping jobs will resume automatically.',
    target: 'ALL',
    startDate: '2026-04-13',
    endDate: '2026-04-15',
    active: true,
  },
  {
    id: 2,
    type: 'FEATURE',
    title: 'New Feature: AI Bid Assistant Now Available',
    message: 'Our AI-powered Bid Assistant can now help you draft technical and financial proposals. Available for Professional and Enterprise plan users.',
    target: 'PAID',
    startDate: '2026-04-10',
    endDate: '2026-05-10',
    active: true,
  },
  {
    id: 3,
    type: 'UPDATE',
    title: 'Price Revision Effective May 1, 2026',
    message: 'Starting May 1, subscription prices will be revised. Current subscribers will be grandfathered at existing rates until their renewal date.',
    target: 'ALL',
    startDate: '2026-04-15',
    endDate: '2026-05-01',
    active: false,
  },
  {
    id: 4,
    type: 'UPDATE',
    title: 'GeM Portal Integration Upgraded to v3.0',
    message: 'We have upgraded our GeM scraper to support the latest portal changes. Expect faster updates and improved document extraction capabilities.',
    target: 'ALL',
    startDate: '2026-04-08',
    endDate: '2026-04-22',
    active: true,
  },
  {
    id: 5,
    type: 'ALERT',
    title: 'Referral Program: Earn 20% Commission',
    message: 'Invite your business partners to TenderBazaar and earn 20% recurring commission on their subscription payments for the first 12 months.',
    target: 'ENTERPRISE',
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    active: true,
  },
];

const MOCK_BANNERS: Banner[] = [
  {
    id: 1,
    title: 'Upgrade to Professional - 30% Off Yearly Plans',
    ctaText: 'Upgrade Now',
    linkUrl: '/pricing?promo=PRO30',
    position: 'TOP_BAR',
    active: true,
    impressions: 48520,
    clicks: 2186,
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    id: 2,
    title: 'AI Bid Assistant - Write Winning Proposals in Minutes',
    ctaText: 'Try AI Assistant',
    linkUrl: '/dashboard/ai-assistant',
    position: 'DASHBOARD',
    active: true,
    impressions: 31240,
    clicks: 4870,
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    id: 3,
    title: 'Download Our Mobile App - Never Miss a Tender',
    ctaText: 'Download App',
    linkUrl: '/mobile',
    position: 'SIDEBAR',
    active: false,
    impressions: 15680,
    clicks: 890,
    gradient: 'from-emerald-500 to-teal-500',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function postStatusBadge(status: PostStatus) {
  if (status === 'PUBLISHED')
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Published
      </span>
    );
  if (status === 'DRAFT')
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/15 text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Draft
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      Scheduled
    </span>
  );
}

function announcementTypeBadge(type: AnnouncementType) {
  const config: Record<AnnouncementType, { color: string; icon: React.ReactNode; label: string }> = {
    MAINTENANCE: { color: 'bg-amber-500/15 text-amber-400', icon: <Wrench className="w-3 h-3" />, label: 'Maintenance' },
    FEATURE: { color: 'bg-purple-500/15 text-purple-400', icon: <Sparkles className="w-3 h-3" />, label: 'Feature' },
    UPDATE: { color: 'bg-blue-500/15 text-blue-400', icon: <TrendingUp className="w-3 h-3" />, label: 'Update' },
    ALERT: { color: 'bg-red-500/15 text-red-400', icon: <AlertTriangle className="w-3 h-3" />, label: 'Alert' },
  };
  const c = config[type];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function targetBadge(target: TargetAudience) {
  const colors: Record<TargetAudience, string> = {
    ALL: 'bg-muted text-foreground/80',
    FREE: 'bg-gray-600/50 text-foreground/80',
    PAID: 'bg-orange-500/15 text-orange-400',
    ENTERPRISE: 'bg-purple-500/15 text-purple-400',
  };
  const labels: Record<TargetAudience, string> = {
    ALL: 'All Users',
    FREE: 'Free Users',
    PAID: 'Paid Users',
    ENTERPRISE: 'Enterprise',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[target]}`}>
      {labels[target]}
    </span>
  );
}

function positionBadge(position: BannerPosition) {
  const colors: Record<BannerPosition, string> = {
    TOP_BAR: 'bg-cyan-500/15 text-cyan-400',
    DASHBOARD: 'bg-blue-500/15 text-blue-400',
    SIDEBAR: 'bg-purple-500/15 text-purple-400',
  };
  const labels: Record<BannerPosition, string> = {
    TOP_BAR: 'Top Bar',
    DASHBOARD: 'Dashboard',
    SIDEBAR: 'Sidebar',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[position]}`}>
      {labels[position]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ContentManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>('blog');
  const [announcements, setAnnouncements] = useState(MOCK_ANNOUNCEMENTS);
  const [banners, setBanners] = useState(MOCK_BANNERS);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'blog', label: 'Blog Posts', icon: <FileText className="w-4 h-4" />, count: MOCK_BLOG_POSTS.length },
    { key: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" />, count: MOCK_ANNOUNCEMENTS.length },
    { key: 'banners', label: 'Banners', icon: <Image className="w-4 h-4" />, count: MOCK_BANNERS.length },
  ];

  // Stats
  const totalViews = MOCK_BLOG_POSTS.reduce((s, p) => s + p.views, 0);
  const totalLikes = MOCK_BLOG_POSTS.reduce((s, p) => s + p.likes, 0);
  const publishedCount = MOCK_BLOG_POSTS.filter((p) => p.status === 'PUBLISHED').length;
  const draftCount = MOCK_BLOG_POSTS.filter((p) => p.status === 'DRAFT').length;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Content Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage blog posts, announcements, and platform content
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-foreground rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors">
          <Plus className="w-4 h-4" />
          New Post
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Posts</p>
          <p className="text-2xl font-bold text-foreground mt-1">{MOCK_BLOG_POSTS.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{publishedCount} published, {draftCount} draft</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Views</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatNumber(totalViews)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center">
              <Heart className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Likes</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatNumber(totalLikes)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Active Announcements</p>
          <p className="text-2xl font-bold text-foreground mt-1">{announcements.filter((a) => a.active).length}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-card border border-border rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary-500 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span
              className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                activeTab === tab.key
                  ? 'bg-white/20 text-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Blog Posts Tab                                                     */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'blog' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {MOCK_BLOG_POSTS.map((post) => (
            <div
              key={post.id}
              className="bg-card border border-border rounded-xl overflow-hidden hover:border-border transition-colors"
            >
              {/* Featured Image Placeholder */}
              <div className={`h-40 bg-gradient-to-br ${post.gradient} flex items-center justify-center`}>
                <BookOpen className="w-12 h-12 text-muted-foreground/40" />
              </div>

              {/* Content */}
              <div className="p-5">
                {/* Status + Date */}
                <div className="flex items-center justify-between mb-3">
                  {postStatusBadge(post.status)}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {post.publishedDate ? formatDate(post.publishedDate) : 'Not published'}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-foreground font-semibold text-base mb-2 line-clamp-1">
                  {post.title}
                </h3>

                {/* Excerpt */}
                <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-4">
                  {post.excerpt}
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold">
                    {post.authorInitials}
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">{post.author}</p>
                  </div>
                </div>

                {/* Stats + Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Eye className="w-3.5 h-3.5" />
                      {formatNumber(post.views)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Heart className="w-3.5 h-3.5" />
                      {formatNumber(post.likes)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Announcements Tab                                                  */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          {announcements.map((ann, idx) => (
            <div
              key={ann.id}
              className="bg-card border border-border rounded-xl p-5 hover:border-border transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Left: Type Badge + Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {announcementTypeBadge(ann.type)}
                    {targetBadge(ann.target)}
                  </div>
                  <h3 className="text-foreground font-semibold text-base mb-1 truncate">
                    {ann.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
                    {ann.message}
                  </p>
                </div>

                {/* Right: Dates + Toggle */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 lg:min-w-[180px]">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(ann.startDate)} - {formatDate(ann.endDate)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const updated = [...announcements];
                      updated[idx] = { ...updated[idx], active: !updated[idx].active };
                      setAnnouncements(updated);
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      ann.active
                        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {ann.active ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                    {ann.active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Banners Tab                                                        */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'banners' && (
        <div className="space-y-4">
          {banners.map((banner, idx) => (
            <div
              key={banner.id}
              className="bg-card border border-border rounded-xl overflow-hidden hover:border-border transition-colors"
            >
              <div className="flex flex-col lg:flex-row">
                {/* Banner Preview */}
                <div
                  className={`lg:w-72 h-32 lg:h-auto bg-gradient-to-r ${banner.gradient} flex items-center justify-center p-4 shrink-0`}
                >
                  <div className="text-center">
                    <Image className="w-8 h-8 text-foreground/60 mx-auto mb-2" />
                    <p className="text-foreground/80 text-xs font-medium">{banner.position.replace('_', ' ')}</p>
                  </div>
                </div>

                {/* Banner Details */}
                <div className="flex-1 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {positionBadge(banner.position)}
                      </div>
                      <h3 className="text-foreground font-semibold text-base mb-1">
                        {banner.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MousePointerClick className="w-3.5 h-3.5" />
                          CTA: <span className="text-foreground/80">{banner.ctaText}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="text-foreground/80 truncate max-w-[200px]">{banner.linkUrl}</span>
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const updated = [...banners];
                        updated[idx] = { ...updated[idx], active: !updated[idx].active };
                        setBanners(updated);
                      }}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                        banner.active
                          ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {banner.active ? (
                        <ToggleRight className="w-4 h-4" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                      {banner.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  {/* Analytics */}
                  <div className="flex items-center gap-6 pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Impressions</p>
                        <p className="text-sm text-foreground font-medium">{formatNumber(banner.impressions)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Clicks</p>
                        <p className="text-sm text-foreground font-medium">{formatNumber(banner.clicks)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">CTR</p>
                        <p className="text-sm text-emerald-400 font-medium">
                          {banner.impressions > 0
                            ? ((banner.clicks / banner.impressions) * 100).toFixed(1)
                            : '0.0'}
                          %
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
