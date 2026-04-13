'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const DISMISS_KEY = 'profile_banner_dismissed';

export function ProfileCompletionBanner() {
  const [percentage, setPercentage] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check session-level dismiss state
    if (typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === 'true') {
      setDismissed(true);
      return;
    }

    const fetchCompletion = async () => {
      try {
        const res = await api.get('/profile/completion');
        setPercentage(res.data.data?.percentage ?? null);
      } catch {
        // If endpoint doesn't exist yet, don't show the banner
        setPercentage(null);
      }
    };

    fetchCompletion();
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    }
  };

  // Don't render if dismissed, loading, or profile >= 60%
  if (dismissed || percentage === null || percentage >= 60) {
    return null;
  }

  return (
    <div
      className={cn(
        'relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border',
        'bg-accent-50 dark:bg-accent-500/5 border-accent-200 dark:border-accent-500/20'
      )}
    >
      {/* Progress bar */}
      <div className="w-full sm:w-32 shrink-0">
        <div className="h-2.5 w-full bg-accent-100 dark:bg-accent-500/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-500 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-xs text-accent-700 dark:text-accent-400 font-medium mt-1">{percentage}%</p>
      </div>

      {/* Message */}
      <p className="flex-1 text-sm text-foreground">
        Your profile is <strong>{percentage}% complete</strong>. Complete it to get accurate AI
        eligibility scores.
      </p>

      {/* Action */}
      <Link
        href="/settings"
        className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-accent-500 hover:bg-accent-600 text-white transition-colors"
      >
        Complete Profile
      </Link>

      {/* Dismiss */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
