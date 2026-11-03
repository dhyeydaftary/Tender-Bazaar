/**
 * Paging rule for the home-page "See all" tender lists.
 */

interface TenderListPage {
  page: number;
  limit: number;
  total: number;
  /** True when the user's plan pins results to page 1. */
  paginationLocked: boolean;
}

/**
 * Next page to request, or undefined when every result is loaded. A locked
 * plan always gets page 1 back from the API, so paging further would only
 * repeat the same results.
 */
export function getNextTenderListPage(lastPage: TenderListPage): number | undefined {
  if (lastPage.paginationLocked) return undefined;
  return lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined;
}
