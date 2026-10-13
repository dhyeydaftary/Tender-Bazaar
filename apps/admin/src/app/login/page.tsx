'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle, Shield, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { useAppearance } from '@/lib/appearance';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const { isDark, toggleTheme } = useAppearance();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background overflow-hidden transition-colors duration-300">
      {/* Theme Toggle Button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 shadow-sm"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-500" />
          )}
        </button>
      </div>

      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Gradient orbs */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary-500/15 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-accent-500/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary-500/5 blur-[100px]" />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/10 dark:shadow-black/50 transition-colors duration-200">
          {/* Branding */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center text-white font-extrabold text-lg mb-3 shadow-lg shadow-primary-500/25 ring-4 ring-primary-500/10">
              TB
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">TenderBazaar</h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">Admin Panel</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@tenderbazaar.in"
                autoComplete="email"
                disabled={isLoading}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 pr-11 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 hover:border-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100 shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo Credentials Hint */}
          <div className="mt-6 rounded-xl bg-muted/40 border border-border p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-foreground">Demo Credentials</span>
              <span className="text-[10px] text-muted-foreground">Click to auto-fill</span>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('superadmin@tenderbazaar.com');
                  setPassword('SuperAdmin@123');
                }}
                className="w-full text-left p-2.5 rounded-lg bg-background/70 hover:bg-background border border-border/70 hover:border-primary-500/50 transition-all duration-150 group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Super Admin</span>
                  <span className="text-[10px] text-muted-foreground group-hover:text-primary-500 font-medium">Auto-fill &rarr;</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span className="truncate">superadmin@tenderbazaar.com</span>
                  <span className="text-[11px] text-foreground/80 font-semibold ml-2">SuperAdmin@123</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('admin@tenderbazaar.com');
                  setPassword('Admin@123');
                }}
                className="w-full text-left p-2.5 rounded-lg bg-background/70 hover:bg-background border border-border/70 hover:border-primary-500/50 transition-all duration-150 group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Admin</span>
                  <span className="text-[10px] text-muted-foreground group-hover:text-primary-500 font-medium">Auto-fill &rarr;</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span className="truncate">admin@tenderbazaar.com</span>
                  <span className="text-[11px] text-foreground/80 font-semibold ml-2">Admin@123</span>
                </div>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-primary-500 shrink-0" />
            <span>Authorized personnel only. All actions are logged.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
