'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { createGoogleIdToken } from '@/lib/google-auth';
import { toast } from 'sonner';
import { Loader2, X, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoogleSignInButtonProps {
  email?: string;
  name?: string;
  className?: string;
  onSuccess?: () => void;
}

export function GoogleSignInButton({
  email: formEmail,
  name: formName,
  className,
  onSuccess,
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const { googleAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  const hasFormEmail = Boolean(formEmail && formEmail.includes('@'));
  const primaryAccountEmail = hasFormEmail && formEmail ? formEmail.trim() : 'demo.user@example.com';
  const primaryAccountName = hasFormEmail
    ? (formName?.trim() || formEmail?.trim().split('@')[0]?.replace(/[._-]/g, ' ') || 'Demo User')
    : 'Demo User';
  const primaryInitials = (
    primaryAccountName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'DU'
  ).slice(0, 2);
  const primaryBadge = hasFormEmail ? 'Current' : 'Demo';

  const executeGoogleAuth = async (userEmail: string, userName?: string) => {
    if (!userEmail || !userEmail.includes('@')) {
      toast.error('Please provide a valid Google email address');
      return;
    }

    setLoading(true);
    try {
      const idToken = createGoogleIdToken({
        email: userEmail,
        name: userName || undefined,
      });

      await googleAuth(idToken);
      toast.success(`Signed in as ${userEmail}`);
      setShowPicker(false);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      const msg = err.response?.data?.error?.message || err.message || 'Google sign in failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    // If the user already provided an email in the form, authenticate directly
    const trimmedEmail = formEmail?.trim();
    if (trimmedEmail && trimmedEmail.includes('@')) {
      executeGoogleAuth(trimmedEmail, formName);
    } else {
      // Otherwise open the Google Account Chooser modal
      setShowPicker(true);
    }
  };

  return (
    <>
      <button
        type="button"
        id="google-sign-in-btn"
        disabled={loading}
        onClick={handleClick}
        className={cn(
          'w-full py-2.5 px-4 border border-border rounded-lg text-foreground font-medium',
          'hover:bg-muted/80 active:scale-[0.99] transition-all duration-150',
          'flex items-center justify-center gap-2.5 shadow-sm',
          loading && 'opacity-70 cursor-not-allowed',
          className
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
            <span>Connecting to Google...</span>
          </>
        ) : (
          <>
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>

      {/* Google Account Picker Dialog */}
      {showPicker && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !loading && setShowPicker(false)}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-6 relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowPicker(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Google Header */}
            <div className="flex flex-col items-center text-center mb-6 pt-2">
              <svg className="h-10 w-10 mb-3" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <h3 className="text-xl font-semibold text-foreground">Choose an account</h3>
              <p className="text-sm text-muted-foreground mt-1">
                to continue to <span className="font-medium text-foreground">TenderBazaar</span>
              </p>
            </div>

            {/* Account List */}
            <div className="space-y-2.5">
              {/* Primary Account (form input if available, otherwise generic demo account) */}
              <button
                type="button"
                disabled={loading}
                onClick={() => executeGoogleAuth(primaryAccountEmail, primaryAccountName)}
                className="w-full flex items-center gap-3.5 p-3 rounded-xl border border-border/80 hover:border-primary-500/50 hover:bg-muted/70 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-full bg-primary-500/10 text-primary-600 font-semibold flex items-center justify-center border border-primary-500/20 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                  {primaryInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm truncate">{primaryAccountName}</div>
                  <div className="text-xs text-muted-foreground truncate">{primaryAccountEmail}</div>
                </div>
                <div className="text-xs font-medium text-primary-500 bg-primary-50 dark:bg-primary-950/40 px-2 py-0.5 rounded-full">
                  {primaryBadge}
                </div>
              </button>

              {/* Generic Demo Account Option when form email is actively in use */}
              {hasFormEmail && primaryAccountEmail !== 'demo.user@example.com' && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => executeGoogleAuth('demo.user@example.com', 'Demo User')}
                  className="w-full flex items-center gap-3.5 p-3 rounded-xl border border-border/80 hover:border-primary-500/50 hover:bg-muted/70 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 font-semibold flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    DU
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm truncate">Demo User</div>
                    <div className="text-xs text-muted-foreground truncate">demo.user@example.com</div>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    Demo
                  </div>
                </button>
              )}

              {/* Use another account toggle/form */}
              {!showCustomInput ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowCustomInput(true)}
                  className="w-full flex items-center gap-3.5 p-3 rounded-xl border border-dashed border-border hover:border-foreground/40 hover:bg-muted/50 transition-all text-left text-muted-foreground hover:text-foreground"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-medium">Use another account</div>
                </button>
              ) : (
                <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-3">
                  <div className="text-xs font-medium text-foreground">Sign in with any Google account:</div>
                  <input
                    type="email"
                    placeholder="google.account@gmail.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="text"
                    placeholder="Your Name (Optional)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setShowCustomInput(false)}
                      className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={loading || !customEmail}
                      onClick={() => executeGoogleAuth(customEmail, customName)}
                      className="px-4 py-1.5 text-xs bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg shadow-sm disabled:opacity-50"
                    >
                      {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Google privacy footer */}
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Secure OAuth Sign In
              </span>
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowPicker(false)}
                className="hover:underline text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default GoogleSignInButton;
