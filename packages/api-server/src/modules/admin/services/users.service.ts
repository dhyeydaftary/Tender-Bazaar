import { prisma } from '../../../config/database';
import { AppError } from '../../../shared/middleware/error-handler';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface UserListFilters {
  page: number;
  limit: number;
  search?: string;
  plan?: string;
  role?: string;
  status?: string;
  sortBy: string;
  sortOrder: string;
}

export const usersService = {
  async getUserList(filters: UserListFilters) {
    const { page, limit, search, plan, role, status, sortBy, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { companyProfile: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (role) where.role = role;

    if (status === 'active') where.isEmailVerified = true;
    else if (status === 'inactive') where.isEmailVerified = false;

    if (plan) {
      if (plan === 'free') {
        where.subscription = null;
      } else {
        where.subscription = {
          plan: { slug: plan },
          status: 'ACTIVE',
        };
      }
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          createdAt: true,
          updatedAt: true,
          subscription: {
            select: {
              status: true,
              billingCycle: true,
              endDate: true,
              plan: { select: { name: true, slug: true } },
            },
          },
          companyProfile: {
            select: { companyName: true, companyType: true, statesOperated: true },
          },
          _count: {
            select: { savedTenders: true, alerts: true, payments: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isActive: u.isEmailVerified,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        plan: u.subscription?.plan?.name || 'Free',
        planSlug: u.subscription?.plan?.slug || 'free',
        subscriptionStatus: u.subscription?.status || null,
        subscriptionEnd: u.subscription?.endDate || null,
        billingCycle: u.subscription?.billingCycle || null,
        companyName: u.companyProfile?.companyName || null,
        companyType: u.companyProfile?.companyType || null,
        statesOperated: u.companyProfile?.statesOperated || [],
        savedTendersCount: u._count.savedTenders,
        alertsCount: u._count.alerts,
        paymentsCount: u._count.payments,
      })),
      total,
      page,
      limit,
    };
  },

  async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: {
          include: { plan: true },
        },
        companyProfile: {
          include: { documents: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        savedTenders: {
          include: {
            tender: {
              select: { id: true, title: true, organization: true, status: true, category: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        alerts: {
          orderBy: { createdAt: 'desc' },
        },
        eligibilityChecks: {
          include: {
            tender: { select: { id: true, title: true, organization: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        searchHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            savedTenders: true,
            alerts: true,
            eligibilityChecks: true,
            payments: true,
            notifications: true,
            searchHistory: true,
            supportTickets: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return user;
  },

  async updateUser(
    userId: string,
    data: { role?: string; isActive?: boolean; planOverride?: string | null; name?: string; email?: string },
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const updateData: any = {};
    const changes: Record<string, { old: any; new: any }> = {};

    if (data.role !== undefined && data.role !== user.role) {
      changes.role = { old: user.role, new: data.role };
      updateData.role = data.role;
    }

    if (data.isActive !== undefined && data.isActive !== user.isEmailVerified) {
      changes.isActive = { old: user.isEmailVerified, new: data.isActive };
      updateData.isEmailVerified = data.isActive;
    }

    if (data.name !== undefined && data.name !== user.name) {
      changes.name = { old: user.name, new: data.name };
      updateData.name = data.name;
    }

    if (data.email !== undefined && data.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing && existing.id !== userId) {
        throw new AppError('Email already in use', 409, 'EMAIL_TAKEN');
      }
      changes.email = { old: user.email, new: data.email };
      updateData.email = data.email;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isEmailVerified: true,
        updatedAt: true,
      },
    });

    // Handle plan override
    if (data.planOverride !== undefined) {
      if (data.planOverride === null) {
        await prisma.subscription.deleteMany({ where: { userId } });
        changes.subscription = { old: 'existing', new: 'removed' };
      } else {
        const plan = await prisma.subscriptionPlan.findUnique({
          where: { slug: data.planOverride },
        });
        if (!plan) {
          throw new AppError('Plan not found', 404, 'PLAN_NOT_FOUND');
        }

        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            planId: plan.id,
            status: 'ACTIVE',
            billingCycle: 'YEARLY',
            startDate: new Date(),
            endDate,
          },
          update: {
            planId: plan.id,
            status: 'ACTIVE',
            startDate: new Date(),
            endDate,
          },
        });
        changes.subscription = { old: 'previous', new: data.planOverride };
      }
    }

    return { user: updatedUser, changes };
  },

  async deleteUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role === 'SUPER_ADMIN') {
      throw new AppError('Cannot delete super admin', 403, 'CANNOT_DELETE_SUPER_ADMIN');
    }

    // Soft delete by deactivating
    await prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: false },
    });

    // Revoke all sessions
    await prisma.session.deleteMany({ where: { userId } });

    return { message: 'User deactivated and sessions revoked' };
  },

  async resetUserPassword(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Generate a temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    // Revoke all sessions
    await prisma.session.deleteMany({ where: { userId } });

    return {
      message: 'Password reset successfully. All sessions revoked.',
      temporaryPassword: tempPassword,
    };
  },

  async exportUsers(filters: { plan?: string; role?: string; status?: string }) {
    const where: any = {};
    if (filters.role) where.role = filters.role;
    if (filters.status === 'active') where.isEmailVerified = true;
    else if (filters.status === 'inactive') where.isEmailVerified = false;
    if (filters.plan && filters.plan !== 'free') {
      where.subscription = { plan: { slug: filters.plan }, status: 'ACTIVE' };
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        subscription: {
          select: {
            plan: { select: { name: true } },
            status: true,
            billingCycle: true,
            endDate: true,
          },
        },
        companyProfile: {
          select: { companyName: true, gstin: true, statesOperated: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role: u.role,
      isActive: u.isEmailVerified,
      plan: u.subscription?.plan?.name || 'Free',
      subscriptionStatus: u.subscription?.status || 'N/A',
      billingCycle: u.subscription?.billingCycle || 'N/A',
      subscriptionEnd: u.subscription?.endDate?.toISOString() || 'N/A',
      companyName: u.companyProfile?.companyName || '',
      gstin: u.companyProfile?.gstin || '',
      statesOperated: u.companyProfile?.statesOperated?.join(', ') || '',
      createdAt: u.createdAt.toISOString(),
    }));
  },
};
