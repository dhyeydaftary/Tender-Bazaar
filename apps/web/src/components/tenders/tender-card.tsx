'use client';

import Link from 'next/link';
import { Calendar, Building2, MapPin, IndianRupee, Eye, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TenderCardProps {
  tender: {
    id: string;
    title: string;
    organization: string;
    category: string;
    status: string;
    state: string;
    estimatedValue?: number;
    publishedDate: string;
    bidSubmissionDeadline: string;
    tenderType: string;
    viewCount: number;
    highlight?: { title?: string[]; description?: string[] };
  };
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
}

const categoryColors: Record<string, string> = {
  WORKS: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  GOODS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  SERVICES: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  CONSULTANCY: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

function formatValue(value?: number): string {
  if (!value) return 'Not specified';
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function getDaysRemaining(deadline: string): { days: number; color: string; text: string } {
  const now = new Date();
  const end = new Date(deadline);
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { days: diff, color: 'text-muted-foreground', text: 'Closed' };
  if (diff <= 3) return { days: diff, color: 'text-red-500', text: `${diff}d left` };
  if (diff <= 7) return { days: diff, color: 'text-amber-500', text: `${diff}d left` };
  return { days: diff, color: 'text-accent-600 dark:text-accent-400', text: `${diff}d left` };
}

export function TenderCard({ tender, isSaved, onToggleSave }: TenderCardProps) {
  const deadline = getDaysRemaining(tender.bidSubmissionDeadline);
  const title = tender.highlight?.title?.[0] || tender.title;

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', categoryColors[tender.category] || 'bg-gray-100 text-gray-700')}>
            {tender.category}
          </span>
          {tender.status === 'ACTIVE' && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400">
              Active
            </span>
          )}
        </div>
        {onToggleSave && (
          <button
            onClick={(e) => { e.preventDefault(); onToggleSave(tender.id); }}
            className="text-muted-foreground hover:text-primary-500 transition-colors"
          >
            <Bookmark className={cn('h-5 w-5', isSaved && 'fill-primary-500 text-primary-500')} />
          </button>
        )}
      </div>

      <Link href={`/tenders/${tender.id}`}>
        <h3
          className="font-semibold text-foreground mb-2 line-clamp-2 hover:text-primary-500 transition-colors"
          dangerouslySetInnerHTML={{ __html: title }}
        />
      </Link>

      <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{tender.organization}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span>{tender.state}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-sm">
          <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">{formatValue(tender.estimatedValue)}</span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(tender.publishedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </span>
          <span className={cn('font-medium', deadline.color)}>
            {deadline.text}
          </span>
        </div>
      </div>
    </div>
  );
}
