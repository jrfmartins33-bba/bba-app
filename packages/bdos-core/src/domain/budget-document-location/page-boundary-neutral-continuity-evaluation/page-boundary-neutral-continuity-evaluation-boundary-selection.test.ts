import { selectClosingLine, selectClosingRegion, selectOpeningLine, selectOpeningRegion } from "./page-boundary-neutral-continuity-evaluation-boundary-selection";
import { lineFixture, pageFixture, positionFixture, regionFixture } from "./testing/page-boundary-neutral-continuity-evaluation-fixture-builders";

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const p1 = positionFixture("gi-1", "L1", 1, 1, 1, "R1");
const l1 = lineFixture("L1", 1, 1, "structured", [p1]);
const l2 = lineFixture("L2", 1, 2, "structured", [p1]);
const l3 = lineFixture("L3", 1, 3, "structured", [p1]);

// --- seleção de região ----------------------------------------------------------

const noRegionsPage = pageFixture(1, "without_neutral_structure", []);
equal(selectClosingRegion(noRegionsPage).outcome, "missing", "a page with zero regions must select 'missing', never throw or invent a region");
equal(selectOpeningRegion(noRegionsPage).outcome, "missing", "same for opening selection");

const onlyUpstreamNotProcessableRegionPage = pageFixture(1, "upstream_not_processable", [regionFixture("R1", 1, 1, "upstream_not_processable", [])]);
equal(selectClosingRegion(onlyUpstreamNotProcessableRegionPage).outcome, "missing", "an upstream_not_processable region is never eligible as a boundary region");

const onlyFailedRegionPage = pageFixture(1, "structured_with_problems", [regionFixture("R1", 1, 1, "failed", [])]);
equal(selectClosingRegion(onlyFailedRegionPage).outcome, "missing", "a failed region is never eligible as a boundary region");

const multiRegionPage = pageFixture(1, "structured", [
  regionFixture("R1", 1, 1, "structured", [l1]),
  regionFixture("R2", 1, 2, "structured", [l2]),
  regionFixture("R3", 1, 3, "structured_with_ambiguities", [l3]),
]);
const closing = selectClosingRegion(multiRegionPage);
if (closing.outcome !== "selected") throw new Error("expected a selected closing region");
equal(closing.region.sourceRegionKey, "R3", "the closing region must be the one with maximum order among eligible regions");
const opening = selectOpeningRegion(multiRegionPage);
if (opening.outcome !== "selected") throw new Error("expected a selected opening region");
equal(opening.region.sourceRegionKey, "R1", "the opening region must be the one with minimum order among eligible regions");

const tiedOrderPage = pageFixture(1, "structured", [
  regionFixture("R1", 1, 5, "structured", [l1]),
  regionFixture("R2", 1, 5, "structured", [l2]),
]);
equal(selectClosingRegion(tiedOrderPage).outcome, "ambiguous", "two regions tied at the same maximum order must be ambiguous, never resolved by arbitrary pick");
equal(selectOpeningRegion(tiedOrderPage).outcome, "ambiguous", "two regions tied at the same minimum order must be ambiguous, never resolved by arbitrary pick");

// --- seleção de linha ------------------------------------------------------------

const emptyLinesRegion = regionFixture("R1", 1, 1, "structured", []);
equal(selectClosingLine(emptyLinesRegion).outcome, "missing", "a region with zero lines must select 'missing' for the boundary line");

const onlyUpstreamNotProcessableLine = lineFixture("L1", 1, 1, "upstream_not_processable", []);
const onlyFailedLine = lineFixture("L2", 1, 2, "failed", []);
const onlyIneligibleRegion = regionFixture("R1", 1, 1, "structured_with_problems", [onlyUpstreamNotProcessableLine, onlyFailedLine]);
equal(selectClosingLine(onlyIneligibleRegion).outcome, "missing", "emenda 1: upstream_not_processable is never eligible (alongside failed) — a region with only these two must select 'missing', never proceed to a false ambiguity/inconclusive");

const withoutPositionsLine = lineFixture("L3", 1, 3, "without_positions", []);
const eligibleLinesRegion = regionFixture("R2", 1, 1, "structured", [l1, l2, withoutPositionsLine]);
const closingLine = selectClosingLine(eligibleLinesRegion);
if (closingLine.outcome !== "selected") throw new Error("expected a selected closing line");
equal(closingLine.line.sourceLineKey, "L3", "the closing line must be the one with maximum verticalOrder among eligible lines (without_positions IS eligible per emenda 1)");
const openingLine = selectOpeningLine(eligibleLinesRegion);
if (openingLine.outcome !== "selected") throw new Error("expected a selected opening line");
equal(openingLine.line.sourceLineKey, "L1", "the opening line must be the one with minimum verticalOrder among eligible lines");

const tiedVerticalOrderRegion = regionFixture("R3", 1, 1, "structured", [
  lineFixture("La", 1, 7, "structured", [p1]),
  lineFixture("Lb", 1, 7, "structured", [p1]),
]);
equal(selectClosingLine(tiedVerticalOrderRegion).outcome, "ambiguous", "two lines tied at the same maximum verticalOrder must be ambiguous");
equal(selectOpeningLine(tiedVerticalOrderRegion).outcome, "ambiguous", "two lines tied at the same minimum verticalOrder must be ambiguous");

console.log("ok - boundary region/line selection: missing (no eligible candidates), emenda 1 (upstream_not_processable excluded, without_positions included), extremal max/min correctness across multiple regions/lines, and ambiguous ties never resolved arbitrarily");
