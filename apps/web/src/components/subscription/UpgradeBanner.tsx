'use client';

import Link from 'next/link';
import { Lock, ArrowUpRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpgradeBannerProps {
  feature: string;
  requiredPlan: string;
  currentPlan?: string;
  variant?: 'inline' | 'card' | 'overlay';
  className?: string;
}

/**
 * A CTA banner shown when a feature is locked by the user's plan.
 *
 * Variants:
 * - `inline` — compact single-line banner for embedding in sections
 * - `card` — standalone card with more description
 * - `overlay` — semi-transparent overlay to cover locked content
 */
export function UpgradeBanner({
  feature,
  requiredPlan,
  currentPlan = 'Free',
  variant = 'inline',
  className,
}: UpgradeBannerProps) {
  if (variant === 'overlay') {
    return (
      <div className={cn('absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl', className)}>
        <div className="text-center p-6 max-w-sm">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-500/10 mb-4">
            <Lock className="h-6 w-6 text-primary-500" />
          </div>
          <h3 className="text-heading-sm font-display text-foreground mb-2">
            {feature}
          </h3>
          <p className="text-body-sm text-muted-foreground mb-4">
            Upgrade to <span className="font-semibold text-primary-500">{requiredPlan}</span> or higher to unlock this feature.
          </p>
          <Link
            href="/subscription#upgrade"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-body-sm font-semibold text-white hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade Now
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn('bg-gradient-to-r from-primary-500/5 via-accent-500/5 to-primary-500/5 border border-primary-500/20 rounded-xl p-6', className)}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2.5 rounded-lg bg-primary-500/10 shrink-0">
              <Lock className="h-5 w-5 text-primary-500" />
            </div>
            <div>
              <h3 className="text-body-sm font-semibold text-foreground">
                {feature} requires {requiredPlan}
              </h3>
              <p className="text-caption text-muted-foreground mt-0.5">
                You are currently on the {currentPlan} plan. Upgrade to access this feature and more.
              </p>
            </div>
          </div>
          <Link
            href="/subscription#upgrade"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-body-sm font-semibold text-white hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25 shrink-0"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade
          </Link>
        </div>
      </div>
    );
  }

  // variant === 'inline'
  return (
    <div className={cn('flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-2.5', className)}>
      <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="text-caption text-amber-700 dark:text-amber-300">
        {feature} &mdash; Available on <span className="font-semibold">{requiredPlan}</span> and above.
      </span>
      <Link
        href="/subscription#upgrade"
        className="ml-auto text-caption font-semibold text-primary-500 hover:text-primary-600 transition-colors flex items-center gap-1 shrink-0"
      >
        Upgrade
        <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
