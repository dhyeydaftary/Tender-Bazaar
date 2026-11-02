'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  Bell,
  Shield,
  Bookmark,
  Trophy,
  CalendarDays,
  BarChart3,
  CreditCard,
  Settings,
  Sparkles,
  FileCheck,
  Columns3,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Menu,
  X,
  Sun,
  Moon,
  FileText,
  Command,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/stores/auth-store';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { useDashboardStore } from '@/stores/dashboard-store';
import { NavPlanBadge, type NavGate } from '@/components/subscription';

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR CONTEXT
   ═══════════════════════════════════════════════════════════════════════════ */

const SidebarContext = createContext({ collapsed: false, toggle: () => {} });

/**
 * Compact count for the sidebar badge (1247 -> "1.2K"), which previously
 * displayed a hard-coded "12.4K" regardless of how many tenders existed.
 * Returns null while the count is still loading so no badge is rendered.
 */
function formatBadgeCount(count: number | undefined | null): string | null {
  if (count === undefined || count === null) return null;
  if (count < 1000) return String(count);
  if (count < 100_000) return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}K`;
  return `${(count / 100_000).toFixed(1)}L`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════════════════ */

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
  /** Resolved at render time from live data instead of a hard-coded string. */
  badgeKey?: 'activeTenders';
  /**
   * Entitlement this item depends on. When the user's plan does not grant it,
   * an upgrade badge naming the minimum plan is shown beside the label.
   * Only set on items that are genuinely gated — Discover's items are not.
   */
  gate?: NavGate;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Discover',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/tenders', label: 'All Tenders', icon: FileText, badgeKey: 'activeTenders' },
      { href: '/search', label: 'Search', icon: Search },
    ],
  },
  {
    title: 'My Workspace',
    items: [
      // Gates reflect the real plan data: Free grants maxSavedTenders 0 and
      // maxAlerts 0, so both need Starter. Eligibility Checks is NOT gated —
      // Free includes 1 lifetime AI check — so it carries no badge.
      { href: '/saved', label: 'Saved Tenders', icon: Bookmark, gate: { kind: 'limit', name: 'maxSavedTenders' } },
      { href: '/alerts', label: 'My Alerts', icon: Bell, gate: { kind: 'limit', name: 'maxAlerts' } },
      { href: '/eligibility', label: 'Eligibility Checks', icon: Shield },
      { href: '/calendar', label: 'Tender Calendar', icon: CalendarDays, gate: { kind: 'feature', name: 'tenderCalendar' } },
    ],
  },
  {
    title: 'AI Tools',
    items: [
      { href: '/ai-eligibility', label: 'AI Eligibility', icon: Sparkles, badge: 'NEW', badgeColor: 'bg-accent-500/10 text-accent-500' },
      { href: '/bid-assistant', label: 'Bid Assistant', icon: FileCheck, badge: 'PRO', badgeColor: 'bg-primary-500/10 text-primary-500' },
      { href: '/compare', label: 'Tender Comparison', icon: Columns3, gate: { kind: 'feature', name: 'tenderComparison' } },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { href: '/analytics', label: 'My Analytics', icon: BarChart3 },
      { href: '/results', label: 'Tender Results', icon: Trophy },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/subscription', label: 'Subscription', icon: CreditCard },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════════════════ */

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle } = useContext(SidebarContext);
  const { user, logout, fetchUser } = useAuthStore();
  const { currentPlan, fetchSubscription } = useSubscriptionStore();
  const { data: dashboard, fetchDashboard } = useDashboardStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchUser();
    // Supplies the live tender count for the "All Tenders" badge. The store is
    // TTL-guarded and de-duplicates concurrent callers, so this shares one
    // request with the dashboard page rather than adding another.
    fetchDashboard();
    fetchSubscription();
  }, [fetchUser, fetchDashboard, fetchSubscription]);

  if (!mounted) return null;

  const displayName = user?.name || 'User';

  // Resolve active plan dynamically (from subscription store or user object)
  const activePlanName =
    currentPlan?.name ||
    (user?.subscription?.status === 'ACTIVE' ? user?.subscription?.plan?.name : null);

  const activePlanSlug = (
    currentPlan?.slug ||
    (user?.subscription?.status === 'ACTIVE' ? user?.subscription?.plan?.slug : null) ||
    (activePlanName ? activePlanName.toLowerCase() : 'free')
  ).toLowerCase();

  const isPaidPlan =
    activePlanSlug !== 'free' &&
    activePlanName &&
    activePlanName.toLowerCase() !== 'free';

  const planLabel = (() => {
    if (user?.role === 'SUPER_ADMIN') return 'Super Admin';
    if (user?.role === 'ADMIN' && !isPaidPlan) return 'Admin';
    if (activePlanName) {
      return activePlanName.toLowerCase().endsWith('plan')
        ? activePlanName
        : `${activePlanName} Plan`;
    }
    return 'Free Plan';
  })();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  };

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-screen bg-card border-r border-border flex flex-col transition-all duration-300 z-50 hidden md:flex',
        collapsed ? 'w-[68px]' : 'w-[260px]',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white font-bold text-sm shrink-0 group-hover:shadow-glow transition-shadow">
            TB
          </div>
          {!collapsed && (
            <span className="text-foreground font-bold text-lg whitespace-nowrap">
              Tender<span className="text-primary-500">Bazaar</span>
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto no-scrollbar">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-4">
            {!collapsed && (
              <p className="text-overline text-muted-foreground uppercase tracking-widest px-3 mb-1.5 text-[10px]">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                const badge = item.badgeKey
                  ? formatBadgeCount(dashboard?.stats.activeTenders)
                  : item.badge;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group/item flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative',
                      isActive
                        ? 'bg-primary-500/10 text-primary-500'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-500 rounded-r-full" />
                    )}
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge && (
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                              item.badgeColor ?? 'bg-muted text-muted-foreground',
                            )}
                          >
                            {badge}
                          </span>
                        )}
                        {item.gate && <NavPlanBadge gate={item.gate} />}
                      </>
                    )}
                  </Link>
                );
              })}
              {group.title === 'Account' && (
                <button
                  type="button"
                  onClick={handleLogout}
                  title={collapsed ? 'Log Out' : undefined}
                  className="group/item flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative w-full text-left text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                >
                  <LogOut className="w-[18px] h-[18px] shrink-0 text-muted-foreground group-hover/item:text-destructive transition-colors" />
                  {!collapsed && <span className="flex-1 truncate">Log Out</span>}
                </button>
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Collapse */}
      <div className="border-t border-border p-2 space-y-1">
        {/* User */}
        {!collapsed ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center shrink-0 overflow-hidden border border-border">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-primary-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded border inline-flex items-center leading-none',
                    activePlanSlug === 'enterprise' &&
                      'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
                    activePlanSlug === 'professional' &&
                      'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/30',
                    activePlanSlug === 'starter' &&
                      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
                    (!activePlanSlug || activePlanSlug === 'free') &&
                      'bg-muted text-muted-foreground border-border',
                    user?.role === 'SUPER_ADMIN' &&
                      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                    user?.role === 'ADMIN' &&
                      !isPaidPlan &&
                      'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                  )}
                >
                  {planLabel}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Log Out"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            title="Log Out"
            className="flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full cursor-pointer"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        )}
        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
        >
          {collapsed ? (
            <ChevronRight className="w-[18px] h-[18px] shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-[18px] h-[18px] shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOP HEADER BAR
   ═══════════════════════════════════════════════════════════════════════════ */

function TopBar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const { currentPlan } = useSubscriptionStore();
  const { data: dashboard } = useDashboardStore();

  const mobileActivePlanName =
    currentPlan?.name ||
    (user?.subscription?.status === 'ACTIVE' ? user?.subscription?.plan?.name : null);

  const mobileActivePlanSlug = (
    currentPlan?.slug ||
    (user?.subscription?.status === 'ACTIVE' ? user?.subscription?.plan?.slug : null) ||
    (mobileActivePlanName ? mobileActivePlanName.toLowerCase() : 'free')
  ).toLowerCase();

  const mobileIsPaidPlan =
    mobileActivePlanSlug !== 'free' &&
    mobileActivePlanName &&
    mobileActivePlanName.toLowerCase() !== 'free';

  const mobilePlanLabel = (() => {
    if (user?.role === 'SUPER_ADMIN') return 'Super Admin';
    if (user?.role === 'ADMIN' && !mobileIsPaidPlan) return 'Admin';
    if (mobileActivePlanName) {
      return mobileActivePlanName.toLowerCase().endsWith('plan')
        ? mobileActivePlanName
        : `${mobileActivePlanName} Plan`;
    }
    return 'Free Plan';
  })();

  // next-themes resolves the theme only on the client, so rendering an icon on
  // the server produced a hydration mismatch. A fixed-size placeholder holds
  // the layout until mount.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 lg:px-6">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Toggle menu"
          suppressHydrationWarning
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Logo for mobile */}
        <Link href="/dashboard" className="md:hidden font-bold text-lg text-primary-500">
          TB
        </Link>

        {/* Search bar hint - desktop */}
        <Link
          href="/tenders"
          className="hidden md:flex items-center gap-2.5 bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors max-w-xs"
        >
          <Search className="w-4 h-4" />
          <span>Search tenders...</span>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 bg-background/50 border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground ml-auto">
            <Command className="w-3 h-3" />K
          </kbd>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Toggle theme"
            suppressHydrationWarning
          >
            {mounted ? (
              theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />
            ) : (
              <span className="w-4 h-4 block" />
            )}
          </button>

          {/* Notifications */}
          <NotificationBell />
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-card border-r border-border overflow-y-auto">
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white font-bold text-sm">
                TB
              </div>
              <span className="text-foreground font-bold text-lg">
                Tender<span className="text-primary-500">Bazaar</span>
              </span>
            </div>
            <nav className="py-3 px-2">
              {NAV_GROUPS.map((group) => (
                <div key={group.title} className="mb-4">
                  <p className="text-overline text-muted-foreground uppercase tracking-widest px-3 mb-1.5 text-[10px]">
                    {group.title}
                  </p>
                  {group.items.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    const Icon = item.icon;
                    const badge = item.badgeKey
                      ? formatBadgeCount(dashboard?.stats.activeTenders)
                      : item.badge;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary-500/10 text-primary-500'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <Icon className="w-[18px] h-[18px]" />
                        <span className="flex-1">{item.label}</span>
                        {badge && (
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', item.badgeColor ?? 'bg-muted text-muted-foreground')}>
                            {badge}
                          </span>
                        )}
                        {item.gate && <NavPlanBadge gate={item.gate} />}
                      </Link>
                    );
                  })}
                  {group.title === 'Account' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full text-left cursor-pointer"
                    >
                      <LogOut className="w-[18px] h-[18px] shrink-0" />
                      <span className="flex-1">Log Out</span>
                    </button>
                  )}
                </div>
              ))}
            </nav>
            {/* Mobile user profile info */}
            <div className="border-t border-border p-3 mt-auto">
              <div className="flex items-center gap-3 px-2 py-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center shrink-0 overflow-hidden border border-border">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user?.name || 'User'} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-primary-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user?.name || 'User'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded border inline-flex items-center leading-none',
                        mobileActivePlanSlug === 'enterprise' &&
                          'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
                        mobileActivePlanSlug === 'professional' &&
                          'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/30',
                        mobileActivePlanSlug === 'starter' &&
                          'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
                        (!mobileActivePlanSlug || mobileActivePlanSlug === 'free') &&
                          'bg-muted text-muted-foreground border-border',
                        user?.role === 'SUPER_ADMIN' &&
                          'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                        user?.role === 'ADMIN' &&
                          !mobileIsPaidPlan &&
                          'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                      )}
                    >
                      {mobilePlanLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYOUT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const fetchSubscriptionData = useSubscriptionStore((s) => s.fetchAll);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const initAuth = useAuthStore((s) => s.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Enforce authentication on protected dashboard routes (allow public tender viewing)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      const isPublicTenderRoute = pathname.startsWith('/tenders');
      if (!token && !isPublicTenderRoute) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    }
  }, [pathname, router]);

  // Hydrate auth and subscription store once for the whole dashboard if authenticated.
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('accessToken')) {
      fetchUser();
      fetchSubscriptionData();
    }
  }, [fetchUser, fetchSubscriptionData]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tb_data_density');
      if (saved) {
        document.documentElement.setAttribute('data-density', saved);
      }
    } catch {}

    const handleDensityChange = (e: any) => {
      const d = e.detail || localStorage.getItem('tb_data_density');
      if (d) {
        document.documentElement.setAttribute('data-density', d);
      }
    };
    window.addEventListener('tb_density_changed', handleDensityChange);
    return () => window.removeEventListener('tb_density_changed', handleDensityChange);
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed((c) => !c) }}>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div
          className={cn(
            'transition-all duration-300',
            'md:ml-[260px]',
            collapsed && 'md:ml-[68px]',
          )}
        >
          <TopBar />
          <main className="p-4 lg:p-6 xl:p-8 max-w-[1440px] mx-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
