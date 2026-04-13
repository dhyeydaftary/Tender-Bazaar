'use client';

import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScoreGauge } from './score-gauge';

type CriterionStatus = 'MET' | 'NOT_MET' | 'PARTIALLY_MET' | 'UNCLEAR';
type CriterionImportance = 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';

interface Criterion {
  criterion: string;
  status: CriterionStatus;
  detail: string;
  importance: CriterionImportance;
}

interface EligibilityResultData {
  score: number;
  is_eligible: boolean;
  criteria: Criterion[];
  suggestions: string[];
}

interface EligibilityResultProps {
  result: EligibilityResultData;
  onClose?: () => void;
}

const statusConfig: Record<CriterionStatus, { icon: typeof CheckCircle2; colorClass: string; bgClass: string; label: string }> = {
  MET: {
    icon: CheckCircle2,
    colorClass: 'text-green-600 dark:text-green-400',
    bgClass: 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900/40',
    label: 'Met',
  },
  NOT_MET: {
    icon: XCircle,
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40',
    label: 'Not Met',
  },
  PARTIALLY_MET: {
    icon: AlertTriangle,
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40',
    label: 'Partially Met',
  },
  UNCLEAR: {
    icon: HelpCircle,
    colorClass: 'text-gray-500 dark:text-gray-400',
    bgClass: 'bg-gray-50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-800',
    label: 'Unclear',
  },
};

const importanceConfig: Record<CriterionImportance, { bgClass: string; textClass: string }> = {
  CRITICAL: {
    bgClass: 'bg-red-100 dark:bg-red-900/40',
    textClass: 'text-red-700 dark:text-red-300',
  },
  IMPORTANT: {
    bgClass: 'bg-amber-100 dark:bg-amber-900/40',
    textClass: 'text-amber-700 dark:text-amber-300',
  },
  OPTIONAL: {
    bgClass: 'bg-gray-100 dark:bg-gray-800',
    textClass: 'text-gray-600 dark:text-gray-400',
  },
};

const importanceOrder: Record<CriterionImportance, number> = {
  CRITICAL: 0,
  IMPORTANT: 1,
  OPTIONAL: 2,
};

function getEligibilityBadge(score: number, isEligible: boolean) {
  if (isEligible && score >= 70) {
    return {
      label: 'Eligible',
      className: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
    };
  }
  if (score >= 40) {
    return {
      label: 'Partially Eligible',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    };
  }
  return {
    label: 'Not Eligible',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
}

export function EligibilityResult({ result, onClose }: EligibilityResultProps) {
  const badge = getEligibilityBadge(result.score, result.is_eligible);
  const sortedCriteria = [...result.criteria].sort(
    (a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]
  );

  const metCount = result.criteria.filter((c) => c.status === 'MET').length;
  const totalCount = result.criteria.length;

  return (
    <div className="space-y-6">
      {/* Top section: Score + Badge + Summary */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreGauge score={result.score} size={160} />
          <div className="flex-1 text-center sm:text-left">
            <div className="mb-3">
              <span className={cn('text-sm font-semibold px-3 py-1.5 rounded-full', badge.className)}>
                {badge.label}
              </span>
            </div>
            <p className="text-lg font-semibold text-foreground mb-1">
              {result.score >= 70
                ? 'Your company meets the tender requirements'
                : result.score >= 40
                  ? 'Your company partially meets the requirements'
                  : 'Your company does not meet the key requirements'}
            </p>
            <p className="text-sm text-muted-foreground">
              {metCount} of {totalCount} criteria met
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Check again
            </button>
          )}
        </div>
      </div>

      {/* Criteria Breakdown */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Eligibility Criteria Analysis</h3>
        <div className="space-y-3">
          {sortedCriteria.map((criterion, index) => {
            const config = statusConfig[criterion.status];
            const impConfig = importanceConfig[criterion.importance];
            const StatusIcon = config.icon;

            return (
              <div
                key={index}
                className={cn(
                  'border rounded-lg p-4 transition-colors',
                  config.bgClass
                )}
              >
                <div className="flex items-start gap-3">
                  <StatusIcon className={cn('h-5 w-5 mt-0.5 shrink-0', config.colorClass)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-foreground">{criterion.criterion}</span>
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          impConfig.bgClass,
                          impConfig.textClass
                        )}
                      >
                        {criterion.importance}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{criterion.detail}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggestions */}
      {result.suggestions && result.suggestions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">How to Improve Your Eligibility</h3>
          <div className="space-y-3">
            {result.suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-lg p-4"
              >
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/50 shrink-0">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-200 mr-2">
                    {index + 1}.
                  </span>
                  <span className="text-sm text-foreground">{suggestion}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
