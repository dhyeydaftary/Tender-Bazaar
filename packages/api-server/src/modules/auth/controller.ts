import { Request, Response, NextFunction } from 'express';
import { authService } from './service';
import {
  registerSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './validation';
import { AppError } from '../../shared/middleware/error-handler';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await authService.register(data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async sendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone } = sendOtpSchema.parse(req.body);
      const result = await authService.sendOtp(phone);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, otp } = verifyOtpSchema.parse(req.body);
      const result = await authService.verifyOtp(phone, otp);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      const result = await authService.refreshToken(refreshToken);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async googleAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const { idToken } = googleAuthSchema.parse(req.body);
      const result = await authService.googleAuth(idToken);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const result = await authService.forgotPassword(email);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = resetPasswordSchema.parse(req.body);
      const result = await authService.resetPassword(data.token, data.password);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refreshToken;
      const accessToken = req.headers.authorization?.replace('Bearer ', '');

      if (!refreshToken) {
        throw new AppError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN');
      }

      const result = await authService.logout(refreshToken, accessToken);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  },
};
