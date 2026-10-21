'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoogleSignInButtonProps {
  email?: string;
  name?: string;
  className?: string;
  onSuccess?: () => void;
}

declare global {
  interface Window {
    google?: any;
  }
}

export function GoogleSignInButton({
  className,
  onSuccess,
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const { googleAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || scriptLoaded.current) return;
    const existing = document.getElementById('google-gsi-client');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
      scriptLoaded.current = true;
    }
  }, []);

  const handleClick = () => {
    const clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      '';

    if (!clientId || clientId === 'your-google-client-id') {
      toast.error(
        'Google OAuth is not configured. Please add your Google Client ID to NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env'
      );
      return;
    }

    if (window.google?.accounts?.id) {
      setLoading(true);
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            if (!response?.credential) {
              setLoading(false);
              return;
            }
            try {
              await googleAuth(response.credential);
              toast.success('Successfully signed in with Google!');
              if (onSuccess) {
                onSuccess();
              } else {
                router.push('/dashboard');
              }
            } catch (err: any) {
              const msg =
                err.response?.data?.error?.message ||
                err.message ||
                'Google sign-in failed';
              toast.error(msg);
            } finally {
              setLoading(false);
            }
          },
        });

        // Trigger Google account chooser
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setLoading(false);
          }
        });
      } catch (err: any) {
        setLoading(false);
        toast.error('Failed to initialize Google Sign-In prompt');
      }
    } else {
      // Standard Google OAuth redirect fallback
      const redirectUri = window.location.origin + '/login';
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        clientId
      )}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=token%20id_token&scope=${encodeURIComponent(
        'openid email profile'
      )}&nonce=${Date.now()}`;
      window.location.href = oauthUrl;
    }
  };

  return (
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
  );
}

export default GoogleSignInButton;
