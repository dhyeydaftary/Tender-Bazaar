/**
 * Maps API tenders to the shape TenderCard / TenderMiniCard render.
 *
 * The cards were written against display labels ("Works") and a
 * `submissionDeadline` field; the API returns Prisma enums ("WORKS") and
 * `bidSubmissionDeadline`.
 */

import type { TenderCardData } from '../components/tender/TenderCard';
import type { TenderListItem } from '../services/api/tenders';

const CATEGORY_LABELS: Record<TenderListItem['category'], TenderCardData['category']> = {
  WORKS: 'Works',
  GOODS: 'Goods',
  SERVICES: 'Services',
  CONSULTANCY: 'Consultancy',
};

export function toTenderCardData(tender: TenderListItem): TenderCardData {
  return {
    id: tender.id,
    title: tender.title,
    organization: tender.organization,
    state: tender.state,
    category: CATEGORY_LABELS[tender.category],
    estimatedValue: tender.estimatedValue,
    emdAmount: tender.emdAmount,
    submissionDeadline: tender.bidSubmissionDeadline,
    publishedDate: tender.publishedDate,
    status: tender.status,
    sourcePortal: tender.sourcePortal,
    referenceNumber: tender.referenceNumber,
  };
}
