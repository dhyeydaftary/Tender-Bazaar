import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../subscriptions/service';
import { paymentService } from './service';
import {
  checkoutSchema,
  verifyPaymentSchema,
  demoConfirmSchema,
  cancelSchema,
  upgradeSchema,
  switchBillingCycleSchema,
  retryPaymentSchema,
} from './validation';
import { AppError } from '../../shared/middleware/error-handler';

export const paymentController = {

  // ─── Plans ────────────────────────────────────────────────────

  async getPlans(_req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await subscriptionService.getPlans();
      res.json({ success: true, data: plans });
    } catch (error) {
      next(error);
    }
  },

  // ─── Current Subscription ────────────────────────────────────

  async getCurrentSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const data = await subscriptionService.getCurrentSubscription(userId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  // ─── Usage Stats ──────────────────────────────────────────────

  async getUsageStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const stats = await subscriptionService.getUsageStats(userId);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  // ─── Create Order (new subscription or upgrade) ──────────────

  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { planSlug, billingCycle } = checkoutSchema.parse(req.body);
      const order = await paymentService.createOrder(userId, planSlug, billingCycle);

      res.status(201).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  },

  // ─── Preview Plan Change (pricing preview without order) ─────

  async previewPlanChange(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { planSlug, billingCycle } = upgradeSchema.parse(req.body);
      const preview = await paymentService.previewPlanChange(userId, planSlug, billingCycle);

      res.json({ success: true, data: preview });
    } catch (error) {
      next(error);
    }
  },

  // ─── Verify Payment ──────────────────────────────────────────

  async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
        verifyPaymentSchema.parse(req.body);

      const result = await paymentService.verifyPayment(
        userId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  // ─── Confirm Demo Payment (PAYMENTS_DEMO_MODE only) ──────────

  async confirmDemoPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { orderId } = demoConfirmSchema.parse(req.body);
      const result = await paymentService.confirmDemoPayment(userId, orderId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  // ─── Cancel Subscription ─────────────────────────────────────

  async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { reason, cancelImmediately } = cancelSchema.parse(req.body);
      const result = await paymentService.cancelSubscription(userId, reason, cancelImmediately);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  // ─── Switch Billing Cycle ────────────────────────────────────

  async switchBillingCycle(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { billingCycle } = switchBillingCycleSchema.parse(req.body);
      const order = await paymentService.switchBillingCycle(userId, billingCycle);

      res.status(201).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  },

  // ─── Retry Failed Payment ───────────────────────────────────

  async retryPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { paymentId } = retryPaymentSchema.parse(req.body);
      const order = await paymentService.retryPayment(userId, paymentId);

      res.status(201).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  },

  // ─── Invoices ────────────────────────────────────────────────

  async getInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const invoices = await paymentService.getInvoices(userId);
      res.json({ success: true, data: invoices });
    } catch (error) {
      next(error);
    }
  },

  async getInvoiceDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const { paymentId } = req.params;
      const detail = await paymentService.getInvoiceDetail(userId, paymentId);

      res.json({ success: true, data: detail });
    } catch (error) {
      next(error);
    }
  },

  // ─── Payment History ─────────────────────────────────────────

  async getPaymentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const history = await paymentService.getPaymentHistory(userId, page, limit);
      res.json({
        success: true,
        data: history.payments,
        meta: { page: history.page, limit: history.limit, total: history.total },
      });
    } catch (error) {
      next(error);
    }
  },

  // ─── Webhook ─────────────────────────────────────────────────

  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      if (!signature) {
        throw new AppError('Missing webhook signature', 400, 'MISSING_SIGNATURE');
      }

      const result = await paymentService.handleWebhook(req.body, signature);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
