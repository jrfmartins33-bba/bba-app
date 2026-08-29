import { getReviewPaginationState } from "./review-pagination";

run("primeira página desabilita Primeira e Anterior", () => {
  const state = getReviewPaginationState(0, 11);
  equal(state.firstDisabled, true);
  equal(state.previousDisabled, true);
  equal(state.nextDisabled, false);
  equal(state.lastDisabled, false);
  equal(state.lastPageIndex, 10);
});

run("página intermediária mantém os quatro destinos corretos", () => {
  const state = getReviewPaginationState(4, 11);
  equal(state.firstPageIndex, 0);
  equal(state.previousPageIndex, 3);
  equal(state.nextPageIndex, 5);
  equal(state.lastPageIndex, 10);
  equal(state.firstDisabled || state.previousDisabled || state.nextDisabled || state.lastDisabled, false);
});

run("última página desabilita Próxima e Última", () => {
  const state = getReviewPaginationState(10, 11);
  equal(state.nextDisabled, true);
  equal(state.lastDisabled, true);
  equal(state.firstDisabled, false);
  equal(state.previousDisabled, false);
});

run("uma única página desabilita todos os controles", () => {
  const state = getReviewPaginationState(0, 1);
  equal(state.firstDisabled, true);
  equal(state.previousDisabled, true);
  equal(state.nextDisabled, true);
  equal(state.lastDisabled, true);
  equal(state.lastPageIndex, 0);
});

run("Última leva diretamente para totalPages - 1", () => {
  equal(getReviewPaginationState(2, 9).lastPageIndex, 8);
});

function run(name: string, fn: () => void) { fn(); console.log(`ok - ${name}`); }
function equal<T>(actual: T, expected: T) {
  if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
}
