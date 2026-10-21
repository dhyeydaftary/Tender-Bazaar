import { prisma } from '../../config/database';
import redis from '../../config/redis';
import { AppError } from '../../shared/middleware/error-handler';
import { invalidateUnreadCount } from '../notifications/service';

const CORRIGENDUM_TTL = 365 * 24 * 60 * 60; // 365 days in seconds

interface CorrigendumChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

interface CorrigendumEntry {
  date: string;
  changes: CorrigendumChange[];
}

export const corrigendumService = {
  async processCorrigendum(tenderId: string, changes: Record<string, unknown>) {
    // Verify tender exists
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        title: true,
        estimatedValue: true,
        emdAmount: true,
        bidSubmissionDeadline: true,
        description: true,
        status: true,
        category: true,
        state: true,
        organization: true,
        department: true,
      },
    });

    if (!tender) {
      throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');
    }

    // Build changelog from old values
    const changeLog: CorrigendumChange[] = [];
    const updateData: Record<string, unknown> = {};

    for (const [field, newValue] of Object.entries(changes)) {
      const oldValue = (tender as any)[field];
      if (oldValue !== newValue) {
        changeLog.push({
          field,
          oldValue: oldValue ?? null,
          newValue,
        });
        updateData[field] = newValue;
      }
    }

    if (changeLog.length === 0) {
      return { updated: false, usersNotified: 0, message: 'No actual changes detected' };
    }

    // Update the tender with new data
    await prisma.tender.update({
      where: { id: tenderId },
      data: updateData,
    });

    // Store corrigendum history in Redis
    const redisKey = `corrigendum:${tenderId}`;
    const existingData = await redis.get(redisKey);
    const history: CorrigendumEntry[] = existingData ? JSON.parse(existingData) : [];

    history.unshift({
      date: new Date().toISOString(),
      changes: changeLog,
    });

    await redis.set(redisKey, JSON.stringify(history), 'EX', CORRIGENDUM_TTL);

    // Find all users who saved this tender
    const savedTenders = await prisma.savedTender.findMany({
      where: { tenderId },
      select: { userId: true },
    });

    const userIds = savedTenders.map((st) => st.userId);

    // Build a summary of changes
    const changeSummary = changeLog
      .map((c) => `${formatFieldName(c.field)}: ${formatValue(c.oldValue)} -> ${formatValue(c.newValue)}`)
      .join(', ');

    // Create notifications for each user
    if (userIds.length > 0) {
      await prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          type: 'NEW_CORRIGENDUM' as const,
          channel: 'IN_APP' as const,
          title: `Tender Updated: ${tender.title}`,
          message: `Changes: ${changeSummary}`,
          data: {
            tenderId,
            tenderTitle: tender.title,
            changes: changeLog as any,
          },
        })),
      });
      await invalidateUnreadCount(userIds);
    }

    return {
      updated: true,
      usersNotified: userIds.length,
      changes: changeLog,
    };
  },

  async getCorrigendumHistory(tenderId: string) {
    // Verify tender exists
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, title: true },
    });

    if (!tender) {
      throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');
    }

    const redisKey = `corrigendum:${tenderId}`;
    const data = await redis.get(redisKey);
    const history: CorrigendumEntry[] = data ? JSON.parse(data) : [];

    return {
      tenderId,
      tenderTitle: tender.title,
      history,
    };
  },
};

function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return value.toLocaleString('en-IN');
  return String(value);
}
