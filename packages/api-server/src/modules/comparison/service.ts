import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/error-handler';

function formatINR(value: number | null | undefined): string {
  if (!value) return 'Not specified';
  if (value >= 10000000) return `\u20b9${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `\u20b9${(value / 100000).toFixed(2)} L`;
  return `\u20b9${value.toLocaleString('en-IN')}`;
}

export const comparisonService = {
  async compareTenders(tenderIds: string[], userId?: string) {
    if (tenderIds.length < 2 || tenderIds.length > 3) {
      throw new AppError('Provide 2 to 3 tender IDs for comparison', 400, 'INVALID_INPUT');
    }

    // Fetch all tenders
    const tenders = await prisma.tender.findMany({
      where: { id: { in: tenderIds } },
      include: {
        documents: {
          select: { id: true, name: true, fileType: true },
        },
      },
    });

    if (tenders.length < 2) {
      throw new AppError('Could not find enough tenders for comparison', 404, 'TENDERS_NOT_FOUND');
    }

    // Ensure tenders are ordered as requested
    const orderedTenders = tenderIds
      .map((id) => tenders.find((t) => t.id === id))
      .filter(Boolean) as typeof tenders;

    // Build comparison metrics
    const values = orderedTenders.map((t) => t.estimatedValue || 0);
    const emdAmounts = orderedTenders.map((t) => t.emdAmount || 0);
    const deadlines = orderedTenders
      .filter((t) => t.bidSubmissionDeadline)
      .map((t) => ({ id: t.id, deadline: t.bidSubmissionDeadline! }));

    // Get eligibility scores if user is authenticated
    let eligibilityScores: Record<string, { score: number; isEligible: boolean }> = {};
    if (userId) {
      const checks = await prisma.eligibilityCheck.findMany({
        where: {
          userId,
          tenderId: { in: tenderIds },
        },
      });

      for (const check of checks) {
        eligibilityScores[check.tenderId] = {
          score: check.score,
          isEligible: check.isEligible,
        };
      }
    }

    // Build comparison result
    const comparison = {
      values: {
        highest: {
          tenderId: orderedTenders.reduce((prev, curr) =>
            (curr.estimatedValue || 0) > (prev.estimatedValue || 0) ? curr : prev
          ).id,
          amount: Math.max(...values),
          formatted: formatINR(Math.max(...values) || null),
        },
        lowest: {
          tenderId: orderedTenders.reduce((prev, curr) =>
            (curr.estimatedValue || 0) < (prev.estimatedValue || 0) ? curr : prev
          ).id,
          amount: Math.min(...values.filter((v) => v > 0)),
          formatted: formatINR(Math.min(...values.filter((v) => v > 0)) || null),
        },
      },
      deadlines: {
        earliest: deadlines.length > 0
          ? deadlines.reduce((prev, curr) =>
              new Date(curr.deadline) < new Date(prev.deadline) ? curr : prev
            )
          : null,
        latest: deadlines.length > 0
          ? deadlines.reduce((prev, curr) =>
              new Date(curr.deadline) > new Date(prev.deadline) ? curr : prev
            )
          : null,
      },
      emd: {
        amounts: orderedTenders.map((t) => ({
          tenderId: t.id,
          amount: t.emdAmount,
          formatted: formatINR(t.emdAmount),
        })),
      },
      eligibility: eligibilityScores,
    };

    // Generate recommendation
    let recommendation = '';
    if (userId && Object.keys(eligibilityScores).length > 0) {
      const bestMatch = Object.entries(eligibilityScores).reduce(
        (best, [tid, data]) => (data.score > best.score ? { tenderId: tid, ...data } : best),
        { tenderId: '', score: 0, isEligible: false }
      );

      if (bestMatch.tenderId) {
        const bestTender = orderedTenders.find((t) => t.id === bestMatch.tenderId);
        recommendation = `Based on your company profile, ${bestTender?.title || 'the recommended tender'} has the highest eligibility score of ${bestMatch.score}/100. ${bestMatch.isEligible ? 'You appear to meet the requirements for this tender.' : 'Consider reviewing the eligibility criteria before proceeding.'}`;
      }
    }

    if (!recommendation) {
      // Sort by deadline urgency and value
      const activeTenders = orderedTenders.filter((t) => t.status === 'ACTIVE');
      if (activeTenders.length > 0) {
        const sortedByDeadline = [...activeTenders].sort(
          (a, b) =>
            new Date(a.bidSubmissionDeadline || '9999-12-31').getTime() -
            new Date(b.bidSubmissionDeadline || '9999-12-31').getTime()
        );
        recommendation = `${sortedByDeadline[0].title} has the earliest deadline. Review requirements and start preparation to avoid missing the submission window. Run an eligibility check on each tender to get a personalised recommendation.`;
      } else {
        recommendation = 'Compare the tender values, deadlines, and EMD requirements to identify the best opportunity. Run eligibility checks to get personalised recommendations.';
      }
    }

    return {
      tenders: orderedTenders.map((t) => ({
        id: t.id,
        title: t.title,
        organization: t.organization,
        department: t.department,
        category: t.category,
        tenderType: t.tenderType,
        state: t.state,
        estimatedValue: t.estimatedValue,
        estimatedValueFormatted: formatINR(t.estimatedValue),
        emdAmount: t.emdAmount,
        emdAmountFormatted: formatINR(t.emdAmount),
        bidSubmissionDeadline: t.bidSubmissionDeadline,
        status: t.status,
        sourcePortal: t.sourcePortal,
        documentsCount: t.documents.length,
        eligibility: eligibilityScores[t.id] || null,
      })),
      comparison,
      recommendation,
    };
  },
};
