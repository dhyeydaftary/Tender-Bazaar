'use client';

import { useTenderCounts } from '@/lib/hooks/use-tenders';
import { formatIndianNumber } from '@/lib/utils';

export function StateStatsRow({ stateName }: { stateName: string }) {
  const counts = useTenderCounts(stateName);

  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm text-muted-foreground mb-1">Total Tenders</p>
        <p className="text-2xl font-bold text-foreground">
          {counts.isLoading ? '...' : formatIndianNumber(counts.total)}
        </p>
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm text-muted-foreground mb-1">Active Tenders</p>
        <p className="text-2xl font-bold text-accent-500">
          {counts.isLoading ? '...' : formatIndianNumber(counts.active)}
        </p>
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm text-muted-foreground mb-1">New Today</p>
        <p className="text-2xl font-bold text-primary-500">
          {counts.isLoading ? '...' : formatIndianNumber(counts.newToday)}
        </p>
      </div>
    </section>
  );
}
