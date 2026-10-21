'use client';

import { useTenderSearch } from '@/lib/hooks/use-tenders';
import { formatIndianNumber } from '@/lib/utils';

interface OrgStatsRowProps {
  orgName: string;
  fallbackTotal: number;
  fallbackActive: number;
  fallbackAvgValue: number;
}

export function OrgStatsRow({
  orgName,
  fallbackTotal,
  fallbackActive,
  fallbackAvgValue,
}: OrgStatsRowProps) {
  const { result, isLoading } = useTenderSearch({
    query: orgName,
    limit: 1,
  });

  const realTotal = result?.total;
  const displayTotal = realTotal !== undefined && realTotal > 0 ? realTotal : fallbackTotal;
  const displayActive = realTotal !== undefined && realTotal > 0 ? realTotal : fallbackActive;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm text-muted-foreground mb-1">Total Tenders</p>
        <p className="text-2xl font-bold text-foreground">
          {isLoading ? '...' : formatIndianNumber(displayTotal)}
        </p>
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm text-muted-foreground mb-1">Active Tenders</p>
        <p className="text-2xl font-bold text-accent-500">
          {isLoading ? '...' : formatIndianNumber(displayActive)}
        </p>
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm text-muted-foreground mb-1">Avg. Tender Value</p>
        <p className="text-2xl font-bold text-primary-500">
          &#8377;{formatIndianNumber(fallbackAvgValue)}
        </p>
      </div>
    </section>
  );
}
