'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Mail, Lock, Phone, Loader2 } from 'lucide-react';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import {
  type OtpState,
  apiErrorOf,
  applyApiError,
  applySendSuccess,
  clearOtpState,
  deriveOtpControls,
  emptyOtpState,
  formatCountdown,
  hasActiveRestriction,
  loadOtpState,
  saveOtpState,
} from '@/lib/otp-state';

const EMPTY_OTP = ['', '', '', '', '', ''];

function browserStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { login, sendOtp, verifyOtp, isLoading } = useAuthStore();
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // Email login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Phone login form
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(EMPTY_OTP);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Restrictions the API reported for this number (code validity, resend
  // cooldown, wrong-code lockout, hourly send limit), plus a once-a-second
  // clock so the countdowns move. The API re-checks every limit on each
  // request; this only tells the user how long to wait and keeps the buttons
  // honest in the meantime. Saved to localStorage so a refresh cannot make the
  // page forget a lockout the server still remembers.
  const [otpState, setOtpState] = useState<OtpState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const restored = loadOtpState(browserStorage(), Date.now());
    if (restored) {
      setOtpState(restored);
      setPhone(restored.phone);
      setMode('phone');
      const controls = deriveOtpControls(restored, Date.now());
      setOtpSent(restored.otpExpiresAt !== null || controls.lockRemainingSeconds > 0);
    }
  }, []);

  useEffect(() => {
    if (!otpState || !hasActiveRestriction(otpState, Date.now())) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [otpState]);

  const updateOtpState = (next: OtpState | null) => {
    setOtpState(next);
    if (next && hasActiveRestriction(next, Date.now())) saveOtpState(browserStorage(), next);
    else clearOtpState(browserStorage());
  };

  const controls = otpState ? deriveOtpControls(otpState, now) : null;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      toast.error('Please enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error('Invalid email address');
      return;
    }
    if (!password) {
      toast.error('Please enter your password');
      return;
    }
    try {
      await login(cleanEmail, password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (error: any) {
      const err = error.response?.data?.error;
      const message =
        err?.details?.[0]?.message ||
        err?.message ||
        (typeof err === 'string' ? err : null) ||
        error.response?.data?.message ||
        (error.message?.includes('Network Error') ? 'Cannot connect to server. Please check your connection.' : null) ||
        error.message ||
        'Login failed';
      toast.error(message);
    }
  };

  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone) {
      toast.error('Please enter your phone number');
      return;
    }
    if (cleanPhone.length !== 10) {
      toast.error('Invalid phone number. Please enter a 10-digit mobile number.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      toast.error('Invalid phone number. Mobile number must start with 6, 7, 8, or 9.');
      return;
    }
    const current = otpState && otpState.phone === cleanPhone ? otpState : emptyOtpState(cleanPhone);
    const before = deriveOtpControls(current, Date.now());
    if (!before.canResend) {
      // The server would refuse anyway; say why without a round trip.
      toast.error(resendBlockedMessage(before));
      return;
    }
    try {
      const response = await sendOtp(cleanPhone);
      updateOtpState(applySendSuccess(current, response ?? {}, Date.now()));
      setOtp(EMPTY_OTP);
      setOtpSent(true);
      toast.success('Verification code sent to your phone number');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      const err = apiErrorOf(error);
      if (err?.code) updateOtpState(applyApiError(current, err, Date.now()));
      const message =
        (Array.isArray(err?.details) ? err?.details?.[0]?.message : null) ||
        err?.message ||
        error.response?.data?.message ||
        (error.message?.includes('Network Error') ? 'Cannot connect to server. Please check your connection.' : null) ||
        error.message ||
        'Failed to send OTP';
      toast.error(message);
    }
  };

  const resendBlockedMessage = (c: NonNullable<typeof controls>): string => {
    if (c.resendBlockedBy === 'locked') {
      return `Too many incorrect codes. Try again in ${formatCountdown(c.lockRemainingSeconds)}.`;
    }
    if (c.resendBlockedBy === 'hourly-limit') {
      return c.sendLimitRemainingSeconds > 0
        ? `You have requested too many codes. Try again in ${formatCountdown(c.sendLimitRemainingSeconds)}.`
        : 'You have requested too many codes for this number. Please try again later.';
    }
    return `Please wait ${formatCountdown(c.resendRemainingSeconds)} before requesting another code.`;
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pasted[i] || '';
      }
      setOtp(newOtp);
      const focusIndex = Math.min(pasted.length, 5);
      otpRefs.current[focusIndex]?.focus();
    }
  };

  const otpValue = otp.join('');

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      toast.error('Invalid phone number');
      return;
    }
    if (otpValue.length !== 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }
    if (controls && !controls.canVerify) {
      toast.error(
        controls.lockRemainingSeconds > 0
          ? `Too many incorrect codes. Try again in ${formatCountdown(controls.lockRemainingSeconds)}.`
          : 'This code has expired. Please request a new one.',
      );
      return;
    }
    try {
      await verifyOtp(cleanPhone, otpValue);
      updateOtpState(null);
      toast.success('Welcome!');
      router.push('/dashboard');
    } catch (error: any) {
      const err = apiErrorOf(error);
      if (err?.code && otpState) updateOtpState(applyApiError(otpState, err, Date.now()));
      if (err?.code === 'INVALID_OTP') setOtp(EMPTY_OTP);
      const message =
        (Array.isArray(err?.details) ? err?.details?.[0]?.message : null) ||
        err?.message ||
        error.response?.data?.message ||
        (error.message?.includes('Network Error') ? 'Cannot connect to server. Please check your connection.' : null) ||
        error.message ||
        'Invalid OTP';
      toast.error(message);
    }
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent) {
      handleSendOtp();
    } else {
      handleVerifyOtp(e);
    }
  };

  return (
    <div className="bg-background min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-8 shadow-xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-xl mb-3">
              <span className="text-xl font-bold text-white">TB</span>
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">
              TenderBazaar
            </span>
          </div>

          {/* Heading */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Sign in to your account
            </p>
          </div>

          {/* Tab Toggle */}
          <div className="flex bg-muted rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('email');
                setOtpSent(false);
              }}
              className={cn(
                'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200',
                mode === 'email'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setMode('phone')}
              className={cn(
                'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200',
                mode === 'phone'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Phone
            </button>
          </div>

          {/* Email Tab */}
          {mode === 'email' ? (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary-500 hover:text-primary-400 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign In
              </button>
            </form>
          ) : (
            /* Phone Tab */
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <span className="absolute left-9 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                    placeholder="9876543210"
                    maxLength={10}
                    disabled={otpSent}
                    className="w-full pl-[4.25rem] pr-4 py-2.5 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              {!otpSent ? (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send OTP
                </button>
              ) : (
                <>
                  {/* OTP Input Boxes */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Enter OTP
                    </label>
                    <div className="flex gap-2 justify-between">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => {
                            otpRefs.current[index] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          onPaste={index === 0 ? handleOtpPaste : undefined}
                          className="w-full aspect-square max-w-[3rem] text-center text-lg font-semibold border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Status: validity countdown, attempts left, lockout */}
                  {controls && (
                    <p
                      role="status"
                      aria-live="polite"
                      data-testid="otp-status"
                      className={cn(
                        'text-sm text-center',
                        controls.lockRemainingSeconds > 0 || controls.otpExpired
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      {controls.lockRemainingSeconds > 0 ? (
                        <>
                          Too many incorrect codes. Try again in{' '}
                          <span className="font-semibold tabular-nums">{formatCountdown(controls.lockRemainingSeconds)}</span>.
                        </>
                      ) : controls.otpExpired ? (
                        'This code has expired. Request a new one below.'
                      ) : controls.otpRemainingSeconds > 0 ? (
                        <>
                          Code expires in{' '}
                          <span className="font-semibold tabular-nums">{formatCountdown(controls.otpRemainingSeconds)}</span>
                          {otpState?.attemptsRemaining !== null &&
                            otpState?.maxAttempts !== null &&
                            otpState!.attemptsRemaining < otpState!.maxAttempts && (
                              <>
                                {' · '}
                                {otpState!.attemptsRemaining} attempt{otpState!.attemptsRemaining === 1 ? '' : 's'} remaining
                              </>
                            )}
                        </>
                      ) : null}
                    </p>
                  )}

                  {/* Verify OTP Button */}
                  <button
                    type="submit"
                    disabled={otpValue.length !== 6 || isLoading || (controls !== null && !controls.canVerify)}
                    className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Verify OTP
                  </button>

                  {/* Resend, disabled through cooldown, lockout and the hourly limit */}
                  <button
                    type="button"
                    data-testid="otp-resend"
                    onClick={handleSendOtp}
                    disabled={isLoading || (controls !== null && !controls.canResend)}
                    className="w-full py-2.5 border border-border text-foreground font-medium rounded-lg transition-colors hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {controls?.resendBlockedBy === 'locked'
                      ? `Locked · ${formatCountdown(controls.lockRemainingSeconds)}`
                      : controls?.resendBlockedBy === 'hourly-limit'
                        ? controls.sendLimitRemainingSeconds > 0
                          ? `Limit reached · try again in ${formatCountdown(controls.sendLimitRemainingSeconds)}`
                          : 'Limit reached · try again later'
                        : controls?.resendBlockedBy === 'cooldown'
                          ? `Resend code in ${formatCountdown(controls.resendRemainingSeconds)}`
                          : 'Resend code'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp(EMPTY_OTP);
                    }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Change phone number
                  </button>
                </>
              )}
            </form>
          )}

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">
                or continue with
              </span>
            </div>
          </div>

          {/* Google Sign In */}
          <GoogleSignInButton email={email} />

          {/* Sign Up Link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-primary-500 hover:text-primary-400 font-medium transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
