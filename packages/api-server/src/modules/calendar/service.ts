import { prisma } from '../../config/database';
import { format } from 'date-fns';

interface TenderSummary {
  id: string;
  title: string;
  organization: string;
  category: string;
  state: string;
  estimatedValue: number | null;
  bidSubmissionDeadline: string;
  status: string;
  tenderType: string;
}

interface CalendarDay {
  count: number;
  tenders: TenderSummary[];
}

export const calendarService = {
  async getTendersByDateRange(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<Record<string, CalendarDay>> {
    const tenders = await prisma.tender.findMany({
      where: {
        bidSubmissionDeadline: {
          gte: startDate,
          lte: endDate,
        },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        title: true,
        organization: true,
        category: true,
        state: true,
        estimatedValue: true,
        bidSubmissionDeadline: true,
        status: true,
        tenderType: true,
      },
      orderBy: { bidSubmissionDeadline: 'asc' },
    });

    // If userId provided, also include user's saved tenders in range
    let savedTenderIds = new Set<string>();
    if (userId) {
      const savedTenders = await prisma.savedTender.findMany({
        where: { userId },
        select: { tenderId: true },
      });
      savedTenderIds = new Set(savedTenders.map((s) => s.tenderId));
    }

    const grouped: Record<string, CalendarDay> = {};

    for (const tender of tenders) {
      const dateKey = format(tender.bidSubmissionDeadline, 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = { count: 0, tenders: [] };
      }
      grouped[dateKey].count += 1;
      grouped[dateKey].tenders.push({
        id: tender.id,
        title: tender.title,
        organization: tender.organization,
        category: tender.category,
        state: tender.state,
        estimatedValue: tender.estimatedValue,
        bidSubmissionDeadline: tender.bidSubmissionDeadline.toISOString(),
        status: tender.status,
        tenderType: tender.tenderType,
      });
    }

    return grouped;
  },

  exportToICal(
    tenders: Array<{
      id: string;
      title: string;
      organization: string;
      category: string;
      estimatedValue: number | null;
      bidSubmissionDeadline: Date;
      sourceUrl: string;
    }>
  ): string {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TenderBazaar//Tender Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (const tender of tenders) {
      const dtStart = format(tender.bidSubmissionDeadline, "yyyyMMdd'T'HHmmss'Z'");
      const dtEnd = dtStart;
      const valueStr = tender.estimatedValue
        ? `Estimated Value: INR ${tender.estimatedValue.toLocaleString('en-IN')}`
        : 'Estimated Value: Not specified';

      lines.push(
        'BEGIN:VEVENT',
        `UID:${tender.id}@tenderbazaar.com`,
        `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escapeICalText(tender.title)}`,
        `DESCRIPTION:Organization: ${escapeICalText(tender.organization)}\\nCategory: ${tender.category}\\n${escapeICalText(valueStr)}`,
        `URL:${tender.sourceUrl}`,
        'STATUS:CONFIRMED',
        `CATEGORIES:${tender.category}`,
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  },
};

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
