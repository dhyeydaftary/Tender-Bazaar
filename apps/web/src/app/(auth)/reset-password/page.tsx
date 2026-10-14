'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import { Lock, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { resetPassword } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-xl p-8 shadow-xl text-center">
            {/* Logo */}
            <div className="flex flex-col items-center mb-6">
              <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-xl mb-3">
                <span className="text-xl font-bold text-white">TB</span>
              </div>
              <span className="text-xl font-bold text-foreground tracking-tight">
                TenderBazaar
              </span>
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">Invalid link</h2>
            <p className="text-muted-foreground text-sm mb-6">This password reset link is invalid or has expired.</p>
            <Link href="/forgot-password" className="text-primary-500 hover:text-primary-400 font-medium">
              Request a new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-xl p-8 shadow-xl text-center">
            {/* Logo */}
            <div className="flex flex-col items-center mb-6">
              <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-xl mb-3">
                <span className="text-xl font-bold text-white">TB</span>
              </div>
              <span className="text-xl font-bold text-foreground tracking-tight">
                TenderBazaar
              </span>
            </div>

            <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-4">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Password reset!</h2>
            <p className="text-muted-foreground text-sm mb-6">Your password has been successfully reset.</p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-2.5 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              Sign in with new password
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to reset password';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-xl p-8 shadow-xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-xl mb-3">
              <span className="text-xl font-bold text-white">TB</span>
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">
              TenderBazaar
            </span>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">Reset password</h2>
            <p className="text-muted-foreground text-sm mt-1">Enter your new password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={8}
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reset Password
            </button>
          </form>

          <p className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-primary-500 hover:text-primary-400 font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center text-muted-foreground">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
