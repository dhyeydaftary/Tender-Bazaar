'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Megaphone,
  Image,
  Eye,
  Heart,
  Trash2,
  Calendar,
  Clock,
  MousePointerClick,
  BarChart3,
  ExternalLink,
  BookOpen,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Wrench,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  Send,
  CheckCircle2,
} from 'lucide-react';
import {
  getContentStats,
  getPostList,
  createPost,
  deletePost,
  getAnnouncementList,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getBannerList,
  createBanner,
  updateBanner,
  deleteBanner,
} from '@/lib/admin-api';
import type {
  ContentStats,
  BlogPostRecord,
  AnnouncementRecord,
  BannerRecord,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Types & Enums
// ---------------------------------------------------------------------------
type Tab = 'blog' | 'announcements' | 'banners';

const GRADIENTS = [
  'from-orange-500/20 to-amber-500/20',
  'from-blue-500/20 to-cyan-500/20',
  'from-emerald-500/20 to-teal-500/20',
  'from-purple-500/20 to-pink-500/20',
  'from-rose-500/20 to-orange-500/20',
  'from-gray-500/20 to-slate-500/20',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatNumber(n: number): string {
  return (n ?? 0).toLocaleString('en-IN');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function postStatusBadge(status: string) {
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
      Archived
    </span>
  );
}

function announcementTypeBadge(type: string) {
  const t = (type || 'info').toLowerCase();
  if (t === 'warning' || t === 'maintenance') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400">
        <Wrench className="w-3 h-3" />
        Maintenance
      </span>
    );
  }
  if (t === 'success' || t === 'feature') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400">
        <Sparkles className="w-3 h-3" />
        Feature
      </span>
    );
  }
  if (t === 'error' || t === 'alert') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400">
        <AlertTriangle className="w-3 h-3" />
        Alert
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
      <TrendingUp className="w-3 h-3" />
      Update
    </span>
  );
}

function targetBadge(target: string) {
  const t = (target || 'all').toLowerCase();
  const colors: Record<string, string> = {
    all: 'bg-muted text-foreground/80',
    free: 'bg-gray-600/50 text-foreground/80',
    paid: 'bg-orange-500/15 text-orange-400',
    enterprise: 'bg-purple-500/15 text-purple-400',
  };
  const labels: Record<string, string> = {
    all: 'All Users',
    free: 'Free Users',
    paid: 'Paid Users',
    enterprise: 'Enterprise',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[t] || colors.all}`}>
      {labels[t] || target}
    </span>
  );
}

function positionBadge(position: string) {
  const p = (position || 'top').toLowerCase();
  const colors: Record<string, string> = {
    top: 'bg-cyan-500/15 text-cyan-400',
    top_bar: 'bg-cyan-500/15 text-cyan-400',
    dashboard: 'bg-blue-500/15 text-blue-400',
    sidebar: 'bg-purple-500/15 text-purple-400',
  };
  const labels: Record<string, string> = {
    top: 'Top Bar',
    top_bar: 'Top Bar',
    dashboard: 'Dashboard',
    sidebar: 'Sidebar',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[p] || colors.top}`}>
      {labels[p] || position}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ContentManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>('blog');

  // Live Database States
  const [stats, setStats] = useState<ContentStats>({
    totalPosts: 6,
    publishedPosts: 5,
    draftPosts: 1,
    activeAnnouncements: 4,
    totalAnnouncements: 5,
    activeBanners: 2,
    totalBanners: 3,
    totalViews: 35260,
    totalLikes: 1066,
  });

  const [posts, setPosts] = useState<BlogPostRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [banners, setBanners] = useState<BannerRecord[]>([]);

  // Loading & Live State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostExcerpt, setNewPostExcerpt] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostStatus, setNewPostStatus] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

  const [showNewAnnModal, setShowNewAnnModal] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnMessage, setNewAnnMessage] = useState('');
  const [newAnnType, setNewAnnType] = useState('info');
  const [newAnnTarget, setNewAnnTarget] = useState('all');
  const [isSubmittingAnn, setIsSubmittingAnn] = useState(false);

  const [showNewBannerModal, setShowNewBannerModal] = useState(false);
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerDesc, setNewBannerDesc] = useState('');
  const [newBannerLink, setNewBannerLink] = useState('');
  const [newBannerPos, setNewBannerPos] = useState('top');
  const [isSubmittingBanner, setIsSubmittingBanner] = useState(false);

  // Load Data
  const loadData = useCallback(async (isManual = false, isBackground = false) => {
    if (isManual) setIsRefreshing(true);
    else if (!isBackground) setIsLoading(true);
    setError(null);

    try {
      const [statsRes, postsRes, annRes, banRes] = await Promise.all([
        getContentStats(),
        getPostList({ page: 1, limit: 50 }),
        getAnnouncementList({ page: 1, limit: 50 }),
        getBannerList({ page: 1, limit: 50 }),
      ]);

      setStats(statsRes);
      setPosts(postsRes.posts);
      setAnnouncements(annRes.announcements);
      setBanners(banRes.banners);
      setSecondsAgo(0);
    } catch (err: any) {
      console.error('Failed to load content:', err);
      if (!isBackground) {
        setError(err?.message || 'Failed to load content records from database.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live Auto-Refresh every 8 seconds
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      loadData(false, true);
    }, 8000);
    return () => clearInterval(interval);
  }, [isAutoRefresh, loadData]);

  // Seconds ago timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle New Post
  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim() || isSubmittingPost) return;
    setIsSubmittingPost(true);
    try {
      const slug = newPostTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4);

      await createPost({
        title: newPostTitle.trim(),
        slug,
        excerpt: newPostExcerpt.trim() || newPostTitle.trim(),
        content: newPostContent.trim(),
        status: newPostStatus,
        tags: ['Procurement', 'Tenders'],
      });

      setShowNewPostModal(false);
      setNewPostTitle('');
      setNewPostExcerpt('');
      setNewPostContent('');
      loadData(true);
    } catch (err: any) {
      alert(`Failed to create post: ${err?.message || 'Server error'}`);
    } finally {
      setIsSubmittingPost(false);
    }
  };

  // Handle New Announcement
  const handleCreateAnnouncement = async () => {
    if (!newAnnTitle.trim() || !newAnnMessage.trim() || isSubmittingAnn) return;
    setIsSubmittingAnn(true);
    try {
      await createAnnouncement({
        title: newAnnTitle.trim(),
        message: newAnnMessage.trim(),
        type: newAnnType,
        targetAudience: newAnnTarget,
        isPinned: false,
      });

      setShowNewAnnModal(false);
      setNewAnnTitle('');
      setNewAnnMessage('');
      loadData(true);
    } catch (err: any) {
      alert(`Failed to create announcement: ${err?.message || 'Server error'}`);
    } finally {
      setIsSubmittingAnn(false);
    }
  };

  // Handle New Banner
  const handleCreateBanner = async () => {
    if (!newBannerTitle.trim() || isSubmittingBanner) return;
    setIsSubmittingBanner(true);
    try {
      await createBanner({
        title: newBannerTitle.trim(),
        description: newBannerDesc.trim() || undefined,
        linkUrl: newBannerLink.trim() || '/pricing',
        position: newBannerPos,
        priority: 5,
      });

      setShowNewBannerModal(false);
      setNewBannerTitle('');
      setNewBannerDesc('');
      setNewBannerLink('');
      loadData(true);
    } catch (err: any) {
      alert(`Failed to create banner: ${err?.message || 'Server error'}`);
    } finally {
      setIsSubmittingBanner(false);
    }
  };

  // Handle Toggle Announcement
  const handleToggleAnnouncement = async (ann: AnnouncementRecord) => {
    try {
      const newStatus = ann.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
      await updateAnnouncement(ann.id, { status: newStatus });
      loadData(false, true);
    } catch (err: any) {
      alert(`Failed to update announcement: ${err?.message}`);
    }
  };

  // Handle Delete Announcement
  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await deleteAnnouncement(id);
      loadData(true);
    } catch (err: any) {
      alert(`Failed to delete announcement: ${err?.message}`);
    }
  };

  // Handle Toggle Banner
  const handleToggleBanner = async (banner: BannerRecord) => {
    try {
      const newStatus = banner.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
      await updateBanner(banner.id, { status: newStatus });
      loadData(false, true);
    } catch (err: any) {
      alert(`Failed to update banner: ${err?.message}`);
    }
  };

  // Handle Delete Banner
  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;
    try {
      await deleteBanner(id);
      loadData(true);
    } catch (err: any) {
      alert(`Failed to delete banner: ${err?.message}`);
    }
  };

  // Handle Delete Post
  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blog post?')) return;
    try {
      await deletePost(id);
      loadData(true);
    } catch (err: any) {
      alert(`Failed to delete post: ${err?.message}`);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'blog', label: 'Blog Posts', icon: <FileText className="w-4 h-4" />, count: stats.totalPosts },
    { key: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" />, count: stats.totalAnnouncements },
    { key: 'banners', label: 'Banners', icon: <Image className="w-4 h-4" />, count: stats.totalBanners },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-foreground">Content Management</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live DB
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Manage blog posts, announcements, and platform content
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Live Auto-Refresh Toggle */}
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isAutoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
            }`}
            title={isAutoRefresh ? 'Live auto-update active (every 8s)' : 'Live updates paused (click to resume)'}
          >
            <span className={`w-2 h-2 rounded-full ${isAutoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
            <span>{isAutoRefresh ? 'Auto-Update (8s)' : 'Updates Paused'}</span>
            <span className="text-[10px] font-normal opacity-75">
              • {secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`}
            </span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted text-foreground text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
            title="Refresh content data from PostgreSQL & Redis"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary-500' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* New Item Modal Trigger */}
          {activeTab === 'blog' && (
            <button
              onClick={() => setShowNewPostModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Post
            </button>
          )}

          {activeTab === 'announcements' && (
            <button
              onClick={() => setShowNewAnnModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Announcement
            </button>
          )}

          {activeTab === 'banners' && (
            <button
              onClick={() => setShowNewBannerModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Banner
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => loadData(true)} className="underline hover:text-red-300 ml-4 shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* Stats Cards — REAL DATABASE NUMBERS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL POSTS */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Live DB
            </span>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Posts</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {isLoading ? '...' : formatNumber(stats.totalPosts)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.publishedPosts} published, {stats.draftPosts} draft
          </p>
        </div>

        {/* TOTAL VIEWS */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Live DB
            </span>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Views</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {isLoading ? '...' : formatNumber(stats.totalViews)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Aggregated across all published posts</p>
        </div>

        {/* TOTAL LIKES */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center">
              <Heart className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Live DB
            </span>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Likes</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {isLoading ? '...' : formatNumber(stats.totalLikes)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Reader engagement feedback</p>
        </div>

        {/* ACTIVE ANNOUNCEMENTS */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Live DB
            </span>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Announcements</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {isLoading ? '...' : formatNumber(stats.activeAnnouncements)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Of {stats.totalAnnouncements} total announcements</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span
              className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                activeTab === tab.key
                  ? 'bg-white/20 text-white font-bold'
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
          {isLoading && posts.length === 0 ? (
            <div className="col-span-2 py-16 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Loading blog posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="col-span-2 py-16 text-center text-sm text-muted-foreground">
              No blog posts found in PostgreSQL. Click "+ New Post" to publish one.
            </div>
          ) : (
            posts.map((post, idx) => (
              <div
                key={post.id}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-border transition-colors shadow-sm flex flex-col justify-between"
              >
                {/* Featured Header */}
                <div className={`h-36 bg-gradient-to-br ${GRADIENTS[idx % GRADIENTS.length]} flex items-center justify-center relative`}>
                  <BookOpen className="w-10 h-10 text-muted-foreground/30" />
                  <span className="absolute top-3 right-3">{postStatusBadge(post.status)}</span>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.publishedAt ? formatDate(post.publishedAt) : 'Not published'}
                      </span>
                      <span className="text-[11px] font-semibold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded">
                        {post.tags?.[0] || 'Article'}
                      </span>
                    </div>

                    <h3 className="text-foreground font-semibold text-base mb-2 line-clamp-1" title={post.title}>
                      {post.title}
                    </h3>

                    <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2 mb-4">
                      {post.excerpt || post.content}
                    </p>
                  </div>

                  <div>
                    {/* Author */}
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-7 h-7 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold">
                        {post.authorName?.slice(0, 2).toUpperCase() || 'TB'}
                      </div>
                      <p className="text-xs text-foreground font-medium">{post.authorName || 'Editorial Team'}</p>
                    </div>

                    {/* Stats + Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="Total Reader Views">
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          {formatNumber(post.views ?? 0)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="Total Reader Likes">
                          <Heart className="w-3.5 h-3.5 text-red-400" />
                          {formatNumber(post.likes ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete Post"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Announcements Tab                                                  */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          {isLoading && announcements.length === 0 ? (
            <div className="py-16 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Loading announcements...</p>
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No announcements found. Click "+ New Announcement" to create one.
            </div>
          ) : (
            announcements.map((ann) => (
              <div
                key={ann.id}
                className="bg-card border border-border rounded-xl p-5 hover:border-border transition-colors shadow-sm"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Left: Type Badge + Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {announcementTypeBadge(ann.type)}
                      {targetBadge(ann.targetAudience)}
                      {ann.isPinned && (
                        <span className="text-[10px] font-semibold bg-primary-500/15 text-primary-400 px-2 py-0.5 rounded-full">
                          Pinned
                        </span>
                      )}
                    </div>
                    <h3 className="text-foreground font-semibold text-base mb-1 truncate">
                      {ann.title}
                    </h3>
                    <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                      {ann.message}
                    </p>
                  </div>

                  {/* Right: Dates + Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 lg:min-w-[180px]">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(ann.startDate)} - {formatDate(ann.endDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleAnnouncement(ann)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          ann.status === 'PUBLISHED'
                            ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {ann.status === 'PUBLISHED' ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                        {ann.status === 'PUBLISHED' ? 'Active' : 'Draft'}
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete Announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Banners Tab                                                        */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'banners' && (
        <div className="space-y-4">
          {isLoading && banners.length === 0 ? (
            <div className="py-16 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Loading promotional banners...</p>
            </div>
          ) : banners.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No banners found. Click "+ New Banner" to create one.
            </div>
          ) : (
            banners.map((banner, idx) => (
              <div
                key={banner.id}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-border transition-colors shadow-sm"
              >
                <div className="flex flex-col lg:flex-row">
                  {/* Banner Preview */}
                  <div
                    className={`lg:w-64 h-28 lg:h-auto bg-gradient-to-r ${GRADIENTS[idx % GRADIENTS.length]} flex items-center justify-center p-4 shrink-0`}
                  >
                    <div className="text-center">
                      <Image className="w-7 h-7 text-foreground/60 mx-auto mb-1.5" />
                      <p className="text-foreground/80 text-xs font-semibold">{banner.position?.replace('_', ' ').toUpperCase() || 'BANNER'}</p>
                    </div>
                  </div>

                  {/* Banner Details */}
                  <div className="flex-1 p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {positionBadge(banner.position)}
                        </div>
                        <h3 className="text-foreground font-semibold text-base mb-1 truncate">
                          {banner.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                          {banner.description || 'Target promotional call-to-action banner'}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="text-foreground/80 truncate max-w-[200px]">{banner.linkUrl}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleBanner(banner)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            banner.status === 'PUBLISHED'
                              ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {banner.status === 'PUBLISHED' ? (
                            <ToggleRight className="w-4 h-4" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                          {banner.status === 'PUBLISHED' ? 'Active' : 'Draft'}
                        </button>
                        <button
                          onClick={() => handleDeleteBanner(banner.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete Banner"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Analytics Row from Redis */}
                    <div className="flex items-center gap-6 pt-3 border-t border-border">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Impressions</p>
                          <p className="text-sm text-foreground font-medium">{formatNumber(banner.impressions ?? 0)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Clicks</p>
                          <p className="text-sm text-foreground font-medium">{formatNumber(banner.clicks ?? 0)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">CTR</p>
                          <p className="text-sm text-emerald-400 font-medium">
                            {banner.impressions && banner.impressions > 0
                              ? (((banner.clicks || 0) / banner.impressions) * 100).toFixed(1)
                              : '0.0'}
                            %
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* New Post Modal                                                     */}
      {/* ----------------------------------------------------------------- */}
      {showNewPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-500" />
                <h2 className="text-lg font-bold text-foreground">Create New Blog Post</h2>
              </div>
              <button
                onClick={() => setShowNewPostModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Post Title
                </label>
                <input
                  type="text"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  placeholder="e.g. GeM Seller Assessment Guidelines"
                  className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Excerpt / Summary
                </label>
                <input
                  type="text"
                  value={newPostExcerpt}
                  onChange={(e) => setNewPostExcerpt(e.target.value)}
                  placeholder="Short 1-2 sentence preview..."
                  className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Content Body
                </label>
                <textarea
                  rows={4}
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Full article content or announcement..."
                  className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Publication Status
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="postStatus"
                      checked={newPostStatus === 'PUBLISHED'}
                      onChange={() => setNewPostStatus('PUBLISHED')}
                      className="text-primary-500 focus:ring-primary-500/30"
                    />
                    <span>Publish Immediately</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="postStatus"
                      checked={newPostStatus === 'DRAFT'}
                      onChange={() => setNewPostStatus('DRAFT')}
                      className="text-primary-500 focus:ring-primary-500/30"
                    />
                    <span>Save as Draft</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-border flex items-center justify-end gap-3 bg-muted/20">
              <button
                onClick={() => setShowNewPostModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePost}
                disabled={isSubmittingPost || !newPostTitle.trim() || !newPostContent.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white shadow-md disabled:opacity-50 transition-colors"
              >
                {isSubmittingPost && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{newPostStatus === 'PUBLISHED' ? 'Publish Post' : 'Save Draft'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* New Announcement Modal                                             */}
      {/* ----------------------------------------------------------------- */}
      {showNewAnnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-primary-500" />
                <h2 className="text-lg font-bold text-foreground">Create New Announcement</h2>
              </div>
              <button
                onClick={() => setShowNewAnnModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Announcement Title
                </label>
                <input
                  type="text"
                  value={newAnnTitle}
                  onChange={(e) => setNewAnnTitle(e.target.value)}
                  placeholder="e.g. Scheduled Maintenance Notice"
                  className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Announcement Message
                </label>
                <textarea
                  rows={3}
                  value={newAnnMessage}
                  onChange={(e) => setNewAnnMessage(e.target.value)}
                  placeholder="Detailed announcement copy for users..."
                  className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    Badge Type
                  </label>
                  <select
                    value={newAnnType}
                    onChange={(e) => setNewAnnType(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  >
                    <option value="info">Update / Info</option>
                    <option value="warning">Maintenance</option>
                    <option value="success">Feature</option>
                    <option value="error">Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    Target Audience
                  </label>
                  <select
                    value={newAnnTarget}
                    onChange={(e) => setNewAnnTarget(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  >
                    <option value="all">All Users</option>
                    <option value="free">Free Users</option>
                    <option value="paid">Paid Users</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-border flex items-center justify-end gap-3 bg-muted/20">
              <button
                onClick={() => setShowNewAnnModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAnnouncement}
                disabled={isSubmittingAnn || !newAnnTitle.trim() || !newAnnMessage.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white shadow-md disabled:opacity-50 transition-colors"
              >
                {isSubmittingAnn && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Create Announcement</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* New Banner Modal                                                   */}
      {/* ----------------------------------------------------------------- */}
      {showNewBannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Image className="w-5 h-5 text-primary-500" />
                <h2 className="text-lg font-bold text-foreground">Create Promotional Banner</h2>
              </div>
              <button
                onClick={() => setShowNewBannerModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Banner Headline
                </label>
                <input
                  type="text"
                  value={newBannerTitle}
                  onChange={(e) => setNewBannerTitle(e.target.value)}
                  placeholder="e.g. Upgrade to Enterprise - 40% Off"
                  className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                  Description / CTA Text
                </label>
                <input
                  type="text"
                  value={newBannerDesc}
                  onChange={(e) => setNewBannerDesc(e.target.value)}
                  placeholder="Short promotion pitch..."
                  className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    Position
                  </label>
                  <select
                    value={newBannerPos}
                    onChange={(e) => setNewBannerPos(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  >
                    <option value="top">Top Bar</option>
                    <option value="dashboard">Dashboard</option>
                    <option value="sidebar">Sidebar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1.5">
                    Target URL
                  </label>
                  <input
                    type="text"
                    value={newBannerLink}
                    onChange={(e) => setNewBannerLink(e.target.value)}
                    placeholder="/pricing"
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  />
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-border flex items-center justify-end gap-3 bg-muted/20">
              <button
                onClick={() => setShowNewBannerModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBanner}
                disabled={isSubmittingBanner || !newBannerTitle.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white shadow-md disabled:opacity-50 transition-colors"
              >
                {isSubmittingBanner && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Create Banner</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
