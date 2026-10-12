'use client';

import { useState, useEffect, createContext, useContext, useMemo } from 'react';
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
import { cn, formatCompact } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/stores/auth-store';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { useTenderCount } from '@/lib/hooks/use-tenders';

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR CONTEXT
   ═══════════════════════════════════════════════════════════════════════════ */

interface SidebarContextType {
  collapsed: boolean;
  toggle: () => void;
  tenderCount: number | null;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  toggle: () => {},
  tenderCount: null,
});

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════════════════ */

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function getNavGroups(tenderCount: number | null): NavGroup[] {
  return [
    {
      title: 'Discover',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        {
          href: '/tenders',
          label: 'All Tenders',
          icon: FileText,
          badge: tenderCount != null ? formatCompact(tenderCount) : undefined,
        },
        { href: '/search', label: 'Search', icon: Search },
      ],
    },
    {
      title: 'My Workspace',
      items: [
        { href: '/saved', label: 'Saved Tenders', icon: Bookmark },
        { href: '/alerts', label: 'My Alerts', icon: Bell },
        { href: '/eligibility', label: 'Eligibility Checks', icon: Shield },
        { href: '/calendar', label: 'Tender Calendar', icon: CalendarDays },
      ],
    },
    {
      title: 'AI Tools',
      items: [
        { href: '/ai-eligibility', label: 'AI Eligibility', icon: Sparkles, badge: 'NEW', badgeColor: 'bg-accent-500/10 text-accent-500' },
        { href: '/bid-assistant', label: 'Bid Assistant', icon: FileCheck, badge: 'PRO', badgeColor: 'bg-primary-500/10 text-primary-500' },
        { href: '/compare', label: 'Tender Comparison', icon: Columns3 },
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
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════════════════ */

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle, tenderCount } = useContext(SidebarContext);
  const { user, logout, fetchUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const navGroups = useMemo(() => getNavGroups(tenderCount), [tenderCount]);

  useEffect(() => {
    setMounted(true);
    fetchUser();
  }, [fetchUser]);

  if (!mounted) return null;

  const displayName = user?.name || 'User';

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
        {navGroups.map((group) => (
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
                        {item.badge && (
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                              item.badgeColor ?? 'bg-muted text-muted-foreground',
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
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
              <p className="text-[10px] text-muted-foreground">{user?.role || 'Free Plan'}</p>
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
  const { logout } = useAuthStore();
  const { tenderCount } = useContext(SidebarContext);
  const navGroups = useMemo(() => getNavGroups(tenderCount), [tenderCount]);

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
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Logo for mobile */}
        <Link href="/dashboard" className="md:hidden font-bold text-lg text-primary-500">
          TB
        </Link>

        {/* Search bar hint - desktop */}
        <button className="hidden md:flex items-center gap-2.5 bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors max-w-xs">
          <Search className="w-4 h-4" />
          <span>Search tenders...</span>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 bg-background/50 border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground ml-auto">
            <Command className="w-3 h-3" />K
          </kbd>
        </button>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Toggle theme"
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
              {navGroups.map((group) => (
                <div key={group.title} className="mb-4">
                  <p className="text-overline text-muted-foreground uppercase tracking-widest px-3 mb-1.5 text-[10px]">
                    {group.title}
                  </p>
                  {group.items.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    const Icon = item.icon;
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
                        {item.badge && (
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', item.badgeColor ?? 'bg-muted text-muted-foreground')}>
                            {item.badge}
                          </span>
                        )}
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
  const tenderCount = useTenderCount();
  const fetchSubscriptionData = useSubscriptionStore((s) => s.fetchAll);

  // Hydrate the subscription store once for the whole dashboard.
  //
  // useFeatureGate/useLimitGate derive access from `currentPlan` in this store.
  // It used to be populated only by the Subscription page, and the store is not
  // persisted — so on any other route (and after every refresh) `currentPlan`
  // was null, every limit read as 0, and paid users were shown the same
  // "upgrade to Starter" gates as free users on Alerts, Saved Tenders and
  // Eligibility.
  //
  // This is display-only: the API still enforces entitlements server-side via
  // requireLimit/requireFeature, which remain the authority.
  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

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
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle: () => setCollapsed((c) => !c),
        tenderCount,
      }}
    >
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
