/**
 * Home page: KPI card sizing, API → card mapping, "See all" paging and navigation.
 *
 * Regression: KPI values and both tender sections were hard-coded (and the
 * mock tenders had already expired), the KPI cards had a fixed size that
 * clipped their label, and both "See all" buttons opened the Search tab.
 */

import { formatStatNumber, getStatCardWidth, getStatValueFontSize } from '../src/utils/homeStats';
import { getNextTenderListPage } from '../src/utils/tenderList';
import { toTenderCardData } from '../src/utils/tenderCard';
import type { TenderListItem } from '../src/services/api/tenders';
import { TenderCategory, TenderStatus } from '../src/types/tender';

describe('KPI cards', () => {
  it('sizes cards to the window within legible bounds', () => {
    const phones = [320, 360, 393, 411, 430];
    for (const width of phones) {
      const card = getStatCardWidth(width);
      expect(card).toBeGreaterThanOrEqual(112);
      expect(card).toBeLessThanOrEqual(170);
    }
    // Wider phones get wider cards; tablets stop growing at the cap.
    expect(getStatCardWidth(411)).toBeGreaterThan(getStatCardWidth(360));
    expect(getStatCardWidth(1024)).toBe(170);
    // On a typical phone more than two cards are visible, so the row reads as scrollable.
    const visible = (411 - 40) / (getStatCardWidth(411) + 12);
    expect(visible).toBeGreaterThan(2.5);
    expect(visible).toBeLessThan(3);
  });

  it('scales the number font with the card', () => {
    expect(getStatValueFontSize(112)).toBe(19);
    expect(getStatValueFontSize(170)).toBe(26);
    expect(getStatValueFontSize(60)).toBe(18);
  });

  it('groups long numbers the Indian way', () => {
    expect(formatStatNumber(7)).toBe('7');
    expect(formatStatNumber(999)).toBe('999');
    expect(formatStatNumber(12438)).toBe('12,438');
    expect(formatStatNumber(123456)).toBe('1,23,456');
  });
});

describe('API tender → card mapping', () => {
  const apiTender: TenderListItem = {
    id: 't1',
    title: 'Road works',
    organization: 'NHAI',
    category: TenderCategory.WORKS,
    state: 'Gujarat',
    status: TenderStatus.CORRIGENDUM,
    estimatedValue: null,
    emdAmount: 50000,
    publishedDate: '2026-11-01T00:00:00.000Z',
    bidSubmissionDeadline: '2026-11-06T17:00:00.000Z',
    sourcePortal: 'CPPP',
    referenceNumber: 'NHAI/1',
  };

  it('maps API enums and field names to what the cards render', () => {
    const card = toTenderCardData(apiTender);
    expect(card.category).toBe('Works');
    expect(card.submissionDeadline).toBe(apiTender.bidSubmissionDeadline);
    expect(card.status).toBe('CORRIGENDUM');
  });

  it('keeps an undisclosed estimate as null instead of inventing ₹0', () => {
    expect(toTenderCardData(apiTender).estimatedValue).toBeNull();
  });
});

describe('"See all" paging', () => {
  it('requests the next page until every result is loaded', () => {
    expect(getNextTenderListPage({ page: 1, limit: 20, total: 45, paginationLocked: false })).toBe(2);
    expect(getNextTenderListPage({ page: 2, limit: 20, total: 45, paginationLocked: false })).toBe(3);
    expect(getNextTenderListPage({ page: 3, limit: 20, total: 45, paginationLocked: false })).toBeUndefined();
    expect(getNextTenderListPage({ page: 1, limit: 20, total: 0, paginationLocked: false })).toBeUndefined();
  });

  it('stops when the plan pins results to page 1', () => {
    expect(getNextTenderListPage({ page: 1, limit: 5, total: 45, paginationLocked: true })).toBeUndefined();
  });
});

// The app's tsconfig has no Node types; Jest provides fs and __dirname at runtime.
declare const __dirname: string;
const fs: { readFileSync(path: string, encoding: 'utf8'): string } = jest.requireActual('fs');

describe('Home navigation wiring', () => {
  const src = (p: string) => fs.readFileSync(`${__dirname}/../src/${p}`, 'utf8');
  const home = src('screens/home/HomeScreen.tsx');

  it('opens a dedicated listing for each "See all", not the Search tab', () => {
    expect(home).toMatch(/navigate\('TenderList', \{ kind: 'recommended' \}\)/);
    expect(home).toMatch(/navigate\('TenderList', \{ kind: 'expiring' \}\)/);
    const recommendedButton = /testID="see-all-recommended"/.test(home);
    const expiringButton = /testID="see-all-expiring"/.test(home);
    expect(recommendedButton && expiringButton).toBe(true);
    expect(home).toMatch(/onPress=\{handleSeeAllRecommended\}/);
    expect(home).toMatch(/onPress=\{handleSeeAllExpiring\}/);
  });

  it('no longer renders hard-coded tenders or KPI values', () => {
    expect(home).not.toMatch(/MOCK_RECOMMENDED_TENDERS|MOCK_EXPIRING_TENDERS/);
    expect(home).not.toMatch(/rawValue:\s*\d/);
  });

  it('registers the TenderList route', () => {
    expect(src('app/navigation/RootNavigator.tsx')).toMatch(/name="TenderList"/);
    expect(src('types/navigation.ts')).toMatch(/TenderList: \{ kind: 'recommended' \| 'expiring' \}/);
  });
});
