'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Shield,
  Sun,
  Moon,
  Lock,
  Mail,
  Crown,
  UserCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { useAppearance } from '@/lib/appearance';

/**
 * Email the role tabs fill in. By default the development fixture accounts from
 * prisma/seed.ts; a demo build (docker-compose.demo-local.yml) sets these
 * build-time emails instead. The password is never filled: the user always
 * types it. NEXT_PUBLIC_* values are inlined at build time, so changing them
 * requires rebuilding the admin image.
 */
const DEMO_SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_DEMO_SUPER_ADMIN_EMAIL || '';
const DEMO_ADMIN_EMAIL = process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL || '';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const { isDark, toggleTheme } = useAppearance();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<'superadmin' | 'admin' | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      router.push('/');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid credentials. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  const selectSuperAdmin = () => {
    setSelectedRole('superadmin');
    setEmail(DEMO_SUPER_ADMIN_EMAIL || 'superadmin@tenderbazaar.com');
    setPassword('');
    setError('');
  };

  const selectAdmin = () => {
    setSelectedRole('admin');
    setEmail(DEMO_ADMIN_EMAIL || 'admin@tenderbazaar.com');
    setPassword('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background text-foreground overflow-hidden transition-colors duration-300">
      {/* Theme Toggle Button */}
      <div className="absolute top-5 right-5 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 shadow-sm"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-primary-500" />
          ) : (
            <Moon className="w-4 h-4 text-foreground" />
          )}
        </button>
      </div>

      {/* TenderBazaar Brand Ambient Glows & Grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute -top-32 -left-32 w-[550px] h-[550px] rounded-full bg-primary-500/10 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[550px] h-[550px] rounded-full bg-accent-500/10 blur-[120px]" />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="relative rounded-2xl bg-card border border-border p-8 shadow-2xl shadow-black/10 dark:shadow-black/50 transition-all">
          {/* Top Primary Color Bar */}
          <div className="absolute inset-x-0 top-0 h-1 bg-primary-500 rounded-t-2xl" />

          {/* Branding Header */}
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="relative mb-3">
              <div className="w-13 h-13 rounded-2xl bg-primary-500 flex items-center justify-center p-3 shadow-lg shadow-primary-500/25">
                <span className="font-extrabold text-2xl tracking-tight text-white">
                  TB
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-xs font-semibold text-primary-600 dark:text-primary-400 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary-500" />
              Administrative Command Center
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
              TenderBazaar Admin
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Secure authorization gateway for platform management
            </p>
          </div>

          {/* Role Quick Selector Tabs */}
          <div className="mb-6 grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl border border-border">
            <button
              type="button"
              onClick={selectSuperAdmin}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                selectedRole === 'superadmin'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>Super Admin</span>
            </button>

            <button
              type="button"
              onClick={selectAdmin}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                selectedRole === 'admin'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-primary-500" />
              <span>Admin</span>
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="text-xs leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold text-foreground/80 tracking-wide uppercase">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSelectedRole(null);
                  }}
                  placeholder="name@tenderbazaar.com"
                  autoComplete="email"
                  disabled={isLoading}
                  className="w-full rounded-xl border border-border bg-muted/40 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 hover:border-border disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-foreground/80 tracking-wide uppercase">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setSelectedRole(null);
                  }}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="w-full rounded-xl border border-border bg-muted/40 pl-10 pr-11 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 hover:border-border disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary-500 hover:bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-all duration-200 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <span>Sign In to Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Security Badge */}
          <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-accent-500 shrink-0" />
            <span>256-Bit TLS Encryption • Audit Logged • RBAC Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
