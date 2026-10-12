'use client';

import './globals.css';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  Users,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  Bell,
  Headphones,
  Newspaper,
  ScrollText,
  FileBarChart,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  ShieldCheck,
  Search,
  Loader2,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { useState, useEffect, createContext, useContext } from 'react';
import { useAuthStore } from '@/lib/auth';

import { AppearanceProvider, useAppearance } from '@/lib/appearance';

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR CONTEXT — shared collapsed state between Sidebar & Main
   ═══════════════════════════════════════════════════════════════════════════ */

const SidebarContext = createContext({ collapsed: false, toggle: () => {} });

/* ═══════════════════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════════════════ */

const NAV_GROUPS = [
  {
    title: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Management',
    items: [
      { href: '/scrapers', label: 'Scrapers', icon: Bot },
      { href: '/tenders', label: 'Tenders', icon: FileText },
      { href: '/users', label: 'Users', icon: Users },
      { href: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
    ],
  },
  {
    title: 'Insights',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/reports', label: 'Reports', icon: FileBarChart },
      { href: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
    ],
  },
  {
    title: 'Communication',
    items: [
      { href: '/notifications', label: 'Notifications', icon: Bell },
      { href: '/content', label: 'Content', icon: Newspaper },
      { href: '/support', label: 'Support', icon: Headphones },
    ],
  },
  {
    title: 'System',
    items: [
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
  const { user, logout } = useAuthStore();
  const { collapsed, toggle } = useContext(SidebarContext);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!mounted) return null;

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-card border-r border-border flex-col transition-all duration-300 z-50 hidden md:flex ${
        collapsed ? 'w-[68px]' : 'w-[260px]'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center text-white font-extrabold text-sm shrink-0 group-hover:shadow-glow transition-shadow">
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
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3 mb-1.5 font-semibold">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group/item flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                      isActive
                        ? 'bg-primary-500/10 text-primary-500'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-500 rounded-r-full" />
                    )}
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Collapse */}
      <div className="border-t border-border p-2 space-y-1">
        {/* Admin profile */}
        {user && !collapsed && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary-500">
                {(user.name || '').split(' ').filter(Boolean).map(n => n[0]).join('') || 'A'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className={`text-[10px] font-medium ${user.role === 'SUPER_ADMIN' ? 'text-amber-600' : 'text-blue-600'}`}>
                {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
              </p>
            </div>
          </div>
        )}
        {user && collapsed && (
          <div className="flex justify-center py-2" title={`${user.name} (${user.role})`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 flex items-center justify-center">
              <span className="text-xs font-bold text-primary-500">
                {(user.name || '').split(' ').filter(Boolean).map(n => n[0]).join('') || 'A'}
              </span>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors w-full"
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>

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
   TOP BAR
   ═══════════════════════════════════════════════════════════════════════════ */

function TopBar() {
  const { user } = useAuthStore();
  const { isDark, toggleTheme } = useAppearance();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const getPageTitle = () => {
    if (pathname === '/') return 'Dashboard';
    const segment = pathname.split('/')[1];
    return segment
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
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

        {/* Page title — desktop */}
        <h2 className="hidden md:block text-lg font-semibold text-foreground">{getPageTitle()}</h2>

        {/* Logo for mobile */}
        <Link href="/" className="md:hidden font-bold text-lg text-primary-500">
          TB
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Search bar hint */}
          <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-muted-foreground text-sm hover:bg-muted transition-colors">
            <Search className="w-4 h-4" />
            <span>Search...</span>
            <kbd className="text-[10px] font-mono bg-background/50 border border-border rounded px-1.5 py-0.5 text-muted-foreground ml-2">Ctrl+K</kbd>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
          </button>

          {/* Role badge */}
          {user && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              user.role === 'SUPER_ADMIN'
                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                : 'bg-blue-500/10 text-blue-600 border border-blue-500/30'
            }`}>
              {user.role === 'SUPER_ADMIN' ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <Shield className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</span>
            </div>
          )}
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-card border-r border-border overflow-y-auto">
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border">
              <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center text-white font-extrabold text-sm">
                TB
              </div>
              <span className="text-foreground font-bold text-lg">
                Tender<span className="text-primary-500">Bazaar</span>
              </span>
            </div>
            <nav className="py-3 px-2">
              {NAV_GROUPS.map((group) => (
                <div key={group.title} className="mb-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3 mb-1.5 font-semibold">
                    {group.title}
                  </p>
                  {group.items.map((item) => {
                    const isActive =
                      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                          isActive
                            ? 'bg-primary-500/10 text-primary-500'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-500 rounded-r-full" />
                        )}
                        <Icon className="w-[18px] h-[18px]" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
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
   LOADING SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-[200]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-primary-500/20">
          TB
        </div>
        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading admin panel...</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AUTH GUARD
   ═══════════════════════════════════════════════════════════════════════════ */

function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const isLoginPage = pathname === '/login';
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      router.push('/login');
    }
    if (!isLoading && isAuthenticated && isLoginPage) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, isLoginPage, router]);

  // The login page is checked BEFORE isLoading on purpose.
  //
  // The auth store reuses one global `isLoading` for both app-boot rehydration
  // and each login request, flipping it true while the request is in flight.
  // With the old order the login page was swapped out for <LoadingScreen/> on
  // submit, which unmounted it and destroyed its local email/password/error
  // state; the failed-login catch then called setError() on a dead component
  // and a fresh, empty one mounted in its place � so invalid credentials
  // produced no visible feedback at all.
  //
  // The login page has its own local isLoading for the button spinner and
  // disabled inputs, so it never needed the global screen. Every other route
  // still gets the boot LoadingScreen below.
  if (isLoginPage) return <>{children}</>;
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <LoadingScreen />;

  return (
    <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed((c) => !c) }}>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div
          className={`transition-all duration-300 md:ml-[260px] ${
            collapsed ? 'md:!ml-[68px]' : ''
          }`}
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

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT LAYOUT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>TenderBazaar Admin</title>
        <meta name="description" content="TenderBazaar Administration Dashboard" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('tb_admin_theme');
                  if (theme === 'light') {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                  var font = localStorage.getItem('tb_admin_font');
                  var fontMap = {
                    'plus-jakarta-sans': "'Plus Jakarta Sans', system-ui, sans-serif",
                    'inter': "'Inter', system-ui, sans-serif",
                    'poppins': "'Poppins', system-ui, sans-serif",
                    'dm-sans': "'DM Sans', system-ui, sans-serif"
                  };
                  if (font && fontMap[font]) {
                    document.documentElement.style.setProperty('--font-family', fontMap[font]);
                  }
                  var colors = localStorage.getItem('tb_admin_colors');
                  if (colors) {
                    var parsed = JSON.parse(colors);
                    if (parsed.primary) {
                      document.documentElement.style.setProperty('--color-primary-500', parsed.primary);
                    }
                    if (parsed.secondary) {
                      document.documentElement.style.setProperty('--color-secondary-900', parsed.secondary);
                    }
                    if (parsed.accent) {
                      document.documentElement.style.setProperty('--color-accent-500', parsed.accent);
                    }
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground font-sans">
        <AppearanceProvider>
          <AuthGuard>{children}</AuthGuard>
        </AppearanceProvider>
      </body>
    </html>
  );
}
