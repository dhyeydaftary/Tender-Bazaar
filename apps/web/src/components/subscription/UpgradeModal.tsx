'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  ArrowRight,
  Check,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import api from '@/lib/api';

interface ProrationPreview {
  changeType: 'new' | 'upgrade' | 'downgrade' | 'cycle_change' | 'same';
  currentPlan: string;
  currentPlanSlug: string;
  currentBillingCycle: string | null;
  targetPlan: string;
  targetPlanSlug: string;
  targetBillingCycle: string;
  pricing: {
    baseAmount: number;
    gstAmount: number;
    gstRate: number;
    totalBeforeProration: number;
    prorationCredit: number;
    finalAmount: number;
  };
  proration: {
    currentPlan: string;
    daysRemaining: number;
    totalPaid: number;
    credit: number;
  } | null;
  currentSubscriptionEnd: string | null;
}

interface UpgradeModalProps {
  targetPlanSlug: string;
  targetPlanName: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  onClose: () => void;
  onCheckout: (planSlug: string, billingCycle: 'MONTHLY' | 'YEARLY') => void;
}

export function UpgradeModal({
  targetPlanSlug,
  targetPlanName,
  billingCycle,
  onClose,
  onCheckout,
}: UpgradeModalProps) {
  const [preview, setPreview] = useState<ProrationPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.post('/subscription/preview', {
          planSlug: targetPlanSlug,
          billingCycle,
        });
        setPreview(res.data.data);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load pricing preview');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreview();
  }, [targetPlanSlug, billingCycle]);

  const changeTypeConfig = {
    upgrade: { icon: TrendingUp, label: 'Upgrade', color: 'text-accent-500', bgColor: 'bg-accent-500/10' },
    downgrade: { icon: TrendingDown, label: 'Downgrade', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
    cycle_change: { icon: RefreshCw, label: 'Billing Change', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    new: { icon: Sparkles, label: 'New Subscription', color: 'text-primary-500', bgColor: 'bg-primary-500/10' },
    same: { icon: Check, label: 'Current Plan', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-heading-sm font-display text-foreground">
            Switch to {targetPlanName}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-body-sm text-red-500 mb-2">{error}</p>
              <button
                onClick={onClose}
                className="text-body-sm text-primary-500 hover:text-primary-600 font-medium"
              >
                Close
              </button>
            </div>
          ) : preview ? (
            <div className="space-y-5">
              {/* Change type badge */}
              {preview.changeType !== 'same' && (
                <div className="flex items-center gap-2">
                  {(() => {
                    const config = changeTypeConfig[preview.changeType];
                    const Icon = config.icon;
                    return (
                      <>
                        <div className={cn('p-1.5 rounded-lg', config.bgColor)}>
                          <Icon className={cn('h-4 w-4', config.color)} />
                        </div>
                        <span className={cn('text-body-sm font-medium', config.color)}>
                          {config.label}
                        </span>
                        <span className="text-caption text-muted-foreground">
                          {preview.currentPlan} &rarr; {preview.targetPlan} ({billingCycle.toLowerCase()})
                        </span>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Pricing breakdown */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-body-sm">
                  <span className="text-muted-foreground">{targetPlanName} ({billingCycle.toLowerCase()})</span>
                  <span className="text-foreground font-mono">{formatCurrency(preview.pricing.baseAmount)}</span>
                </div>
                <div className="flex justify-between text-body-sm">
                  <span className="text-muted-foreground">GST ({preview.pricing.gstRate * 100}%)</span>
                  <span className="text-foreground font-mono">{formatCurrency(preview.pricing.gstAmount)}</span>
                </div>

                {preview.pricing.prorationCredit > 0 && (
                  <>
                    <div className="border-t border-border pt-2 flex justify-between text-body-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground font-mono">{formatCurrency(preview.pricing.totalBeforeProration)}</span>
                    </div>
                    <div className="flex justify-between text-body-sm">
                      <span className="text-accent-500">
                        Proration credit ({preview.proration?.daysRemaining} days remaining)
                      </span>
                      <span className="text-accent-500 font-mono">
                        -{formatCurrency(preview.pricing.prorationCredit)}
                      </span>
                    </div>
                  </>
                )}

                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="text-body-sm font-semibold text-foreground">Amount to pay</span>
                  <span className="text-heading-sm font-mono font-bold text-foreground">
                    {formatCurrency(preview.pricing.finalAmount)}
                  </span>
                </div>
              </div>

              {/* Info note */}
              {preview.changeType === 'downgrade' && (
                <p className="text-caption text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2">
                  Downgrading will take effect at the end of your current billing period
                  {preview.currentSubscriptionEnd && ` (${new Date(preview.currentSubscriptionEnd).toLocaleDateString('en-IN')})`}.
                  Some features may become unavailable.
                </p>
              )}

              {preview.changeType === 'same' && (
                <p className="text-caption text-muted-foreground text-center py-2">
                  You are already on this plan with the same billing cycle.
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {preview && preview.changeType !== 'same' && (
          <div className="flex items-center gap-3 px-6 py-4 border-t border-border bg-muted/30">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-body-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onCheckout(targetPlanSlug, billingCycle)}
              className="flex-1 rounded-lg bg-primary-500 px-4 py-2.5 text-body-sm font-semibold text-white hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2"
            >
              Proceed to Payment
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
