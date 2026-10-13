import { Request, Response, NextFunction } from 'express';
import { planConfigService } from '../../modules/subscriptions/plan-config.service';
import { AppError } from './error-handler';

/** Boolean features that can be checked with hasFeature() */
type BooleanFeature =
  | 'paginationAllowed'
  | 'advancedFilters'
  | 'emailAlerts'
  | 'pushAlerts'
  | 'whatsappAlerts'
  | 'corrigendumAlerts'
  | 'aiChecksResetMonthly'
  | 'aiTenderSummary'
  | 'tenderComparison'
  | 'competitorAnalysis'
  | 'documentDownload'
  | 'bulkDownload'
  | 'exportEnabled'
  | 'tenderCalendar'
  | 'multiLanguage'
  | 'eTenderingSupport'
  | 'dedicatedManager';

/** Numeric limits that can be checked with checkLimit() */
type NumericLimit =
  | 'maxAlerts'
  | 'maxAiChecks'
  | 'maxSavedTenders'
  | 'maxComparisonTenders'
  | 'maxTeamMembers'
  | 'tenderViewsPerPage';

/**
 * Middleware: require a boolean feature to be enabled on the user's plan.
 * Usage: router.get('/export', requireFeature('exportEnabled'), handler)
 */
export function requireFeature(feature: BooleanFeature) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.id) return next(new AppError('Authentication required', 401, 'NOT_AUTHENTICATED'));
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        return next();
      }

      const plan = await planConfigService.getUserPlan(user.id);
      const hasIt = planConfigService.hasFeature(plan, feature);

      if (!hasIt) {
        return next(new AppError(
          `Your ${plan.name} plan does not include this feature. Please upgrade to access it.`,
          403,
          'FEATURE_NOT_AVAILABLE',
        ));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware: check a numeric limit and block if exceeded.
 * Automatically increments usage after passing.
 * Usage: router.post('/saved', requireLimit('maxSavedTenders'), handler)
 */
export function requireLimit(limitName: NumericLimit) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.id) return next(new AppError('Authentication required', 401, 'NOT_AUTHENTICATED'));
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        (req as any).planLimit = { limitName, used: 0, limit: -1 };
        return next();
      }

      const { allowed, limit, used } = await planConfigService.checkLimit(user.id, limitName);

      if (!allowed) {
        const limitLabel = limit === -1 ? 'unlimited' : String(limit);
        return next(new AppError(
          `You have reached your limit for ${limitName} (${used}/${limitLabel}). Please upgrade your plan.`,
          403,
          'PLAN_LIMIT_EXCEEDED',
        ));
      }

      // Attach limit info for downstream handlers
      (req as any).planLimit = { limitName, used, limit };
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware: enforce tender pagination rules based on plan.
 * Free users: first page only (no pagination), limited to tenderViewsPerPage results.
 * Paid users: full pagination allowed.
 */
export function tenderPagination() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      // Admin / Super Admin get unlimited pagination
      if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
        return next();
      }

      // Unauthenticated users get free-tier limits
      if (!user?.id) {
        req.query.page = '1';
        req.query.limit = '20';
        (req as any).paginationLocked = true;
        return next();
      }

      const plan = await planConfigService.getUserPlan(user.id);

      if (!plan.paginationAllowed) {
        // Free plan: force page 1 with plan's tenderViewsPerPage
        req.query.page = '1';
        req.query.limit = String(plan.tenderViewsPerPage);
        (req as any).paginationLocked = true;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware: check AI eligibility limits (handles free lifetime vs paid monthly).
 * Does NOT auto-increment — the handler should call incrementUsage after success.
 */
export function requireAiCheck() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.id) return next(new AppError('Authentication required', 401, 'NOT_AUTHENTICATED'));
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        (req as any).planLimit = { limitName: 'maxAiChecks', used: 0, limit: -1 };
        return next();
      }

      const { allowed, used, limit } = await planConfigService.checkLimit(user.id, 'maxAiChecks');

      if (!allowed) {
        const plan = await planConfigService.getUserPlan(user.id);
        const msg = plan.aiChecksResetMonthly
          ? `You have used all ${limit} AI checks this month. They reset next month, or upgrade your plan.`
          : `You have used your lifetime AI check. Upgrade to a paid plan for more.`;

        return next(new AppError(msg, 403, 'AI_CHECK_LIMIT_EXCEEDED'));
      }

      (req as any).planLimit = { limitName: 'maxAiChecks', used, limit };
      next();
    } catch (error) {
      next(error);
    }
  };
}
