export interface ReviewPaginationState {
  readonly pageIndex: number;
  readonly totalPages: number;
  readonly firstDisabled: boolean;
  readonly previousDisabled: boolean;
  readonly nextDisabled: boolean;
  readonly lastDisabled: boolean;
  readonly firstPageIndex: number;
  readonly previousPageIndex: number;
  readonly nextPageIndex: number;
  readonly lastPageIndex: number;
}

export function getReviewPaginationState(pageIndex: number, totalPages: number): ReviewPaginationState {
  const safeTotalPages = Math.max(1, Math.trunc(totalPages));
  const safePageIndex = Math.min(Math.max(0, Math.trunc(pageIndex)), safeTotalPages - 1);
  const atFirst = safePageIndex === 0;
  const atLast = safePageIndex === safeTotalPages - 1;
  return {
    pageIndex: safePageIndex,
    totalPages: safeTotalPages,
    firstDisabled: atFirst,
    previousDisabled: atFirst,
    nextDisabled: atLast,
    lastDisabled: atLast,
    firstPageIndex: 0,
    previousPageIndex: Math.max(0, safePageIndex - 1),
    nextPageIndex: Math.min(safeTotalPages - 1, safePageIndex + 1),
    lastPageIndex: safeTotalPages - 1,
  };
}
