'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Mail, Lock, Phone, Loader2 } from 'lucide-react';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';

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
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Login failed';
      toast.error(message);
    }
  };

  const handleSendOtp = async () => {
    try {
      await sendOtp(phone);
      setOtpSent(true);
      toast.success('OTP sent to your phone');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to send OTP';
      toast.error(message);
    }
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyOtp(phone, otpValue);
      toast.success('Welcome!');
      router.push('/dashboard');
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Invalid OTP';
      toast.error(message);
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
            <form onSubmit={handleVerifyOtp} className="space-y-4">
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
                    required
                    disabled={otpSent}
                    className="w-full pl-[4.25rem] pr-4 py-2.5 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={phone.length !== 10 || isLoading}
                  className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

                  {/* Verify OTP Button */}
                  <button
                    type="submit"
                    disabled={otpValue.length !== 6 || isLoading}
                    className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Verify OTP
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp(['', '', '', '', '', '']);
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
