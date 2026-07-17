import {
  PHYSICAL_DOCUMENT_GEOMETRY_CONTEXT_FINGERPRINT_VERSION,
  PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
  PHYSICAL_DOCUMENT_READER_NAME,
  PHYSICAL_DOCUMENT_READER_VERSION,
  PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
  PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
  computePageTextMetrics,
  createTechnicalProblem,
  derivePageOrientation,
  normalizePageText,
} from "./index";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

runTest("schema version, reader name and reader version are present and stable at v2", () => {
  assertEqual(PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION, 2);
  assertEqual(PHYSICAL_DOCUMENT_READER_NAME, "physical-document-reader");
  assertEqual(PHYSICAL_DOCUMENT_READER_VERSION, "physical-document-reader-v2");
});

runTest("text item coordinate space, geometry profile and fingerprint versions are present and stable", () => {
  assertEqual(PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION, "physical-document-text-item-coordinate-space-v1");
  assertEqual(PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION, "physical-document-text-item-geometry-profile-v1");
  assertEqual(PHYSICAL_DOCUMENT_GEOMETRY_CONTEXT_FINGERPRINT_VERSION, "physical-document-geometry-context-fingerprint-v1");
});

// --- derivePageOrientation ---------------------------------------------

runTest("orientation: width greater than height is landscape", () => {
  assertEqual(derivePageOrientation(792, 612), "landscape");
});

runTest("orientation: height greater than width is portrait", () => {
  assertEqual(derivePageOrientation(612, 792), "portrait");
});

runTest("orientation: exactly equal width and height is indeterminate (no arbitrary threshold)", () => {
  assertEqual(derivePageOrientation(600, 600), "indeterminate");
});

runTest("orientation: null width or height is indeterminate", () => {
  assertEqual(derivePageOrientation(null, 792), "indeterminate");
  assertEqual(derivePageOrientation(612, null), "indeterminate");
  assertEqual(derivePageOrientation(null, null), "indeterminate");
});

runTest("orientation: non-finite or non-positive dimensions are indeterminate", () => {
  assertEqual(derivePageOrientation(Number.NaN, 792), "indeterminate");
  assertEqual(derivePageOrientation(612, Number.POSITIVE_INFINITY), "indeterminate");
  assertEqual(derivePageOrientation(0, 792), "indeterminate");
  assertEqual(derivePageOrientation(612, -10), "indeterminate");
});

// --- normalizePageText ---------------------------------------------------

runTest("normalization: joins items in order, one item per line", () => {
  assertEqual(normalizePageText(["Item 1", "Item 2", "Item 3"]), "Item 1\nItem 2\nItem 3");
});

runTest("normalization: CRLF and CR are normalized to LF within an item", () => {
  assertEqual(normalizePageText(["a\r\nb\rc"]), "a\nb\nc");
});

runTest("normalization: consecutive spaces/tabs are consolidated to a single space", () => {
  assertEqual(normalizePageText(["a   b\t\tc"]), "a b c");
});

runTest("normalization: trailing spaces are removed", () => {
  assertEqual(normalizePageText(["trailing   "]), "trailing");
});

runTest("normalization: leading space is preserved as a single consolidated space, not stripped", () => {
  assertEqual(normalizePageText(["   leading"]), " leading");
});

runTest("normalization: empty item list normalizes to empty string", () => {
  assertEqual(normalizePageText([]), "");
});

runTest("normalization: does not alter numbers or decimal separators", () => {
  assertEqual(normalizePageText(["R$ 1.234,56"]), "R$ 1.234,56");
});

runTest("normalization: is deterministic across repeated calls with the same input", () => {
  const items = ["Line one", "  Line   two  ", "Line\r\nthree"];
  assertEqual(normalizePageText(items), normalizePageText(items));
});

// --- computePageTextMetrics ------------------------------------------------

runTest("metrics: counts non-empty characters, excluding Unicode whitespace", () => {
  const metrics = computePageTextMetrics(["ab c"]);
  assertEqual(metrics.textItemCount, 1);
  assertEqual(metrics.nonEmptyCharacterCount, 3);
});

runTest("metrics: Unicode space separators (e.g. NBSP) count as empty", () => {
  const metrics = computePageTextMetrics(["a b"]);
  assertEqual(metrics.nonEmptyCharacterCount, 2);
});

runTest("metrics: counts U+FFFD replacement characters", () => {
  const metrics = computePageTextMetrics(["a�b�"]);
  assertEqual(metrics.replacementCharacterCount, 2);
});

runTest("metrics: replacement characters also count toward non-empty characters", () => {
  const metrics = computePageTextMetrics(["�"]);
  assertEqual(metrics.nonEmptyCharacterCount, 1);
  assertEqual(metrics.replacementCharacterCount, 1);
});

runTest("metrics: counts unexpected C0/C1 control characters and DEL", () => {
  // U+0001 (SOH, C0 control), U+007F (DEL), U+0090 (DCS, C1 control) -- three unexpected control codepoints among four letters.
  const metrics = computePageTextMetrics(["a\u0001b\u007fc\u0090d"]);
  assertEqual(metrics.unexpectedControlCharacterCount, 3);
});

runTest("metrics: tab, line feed and carriage return are not counted as unexpected control characters", () => {
  const metrics = computePageTextMetrics(["a\tb\nc\rd"]);
  assertEqual(metrics.unexpectedControlCharacterCount, 0);
});

runTest("metrics: zero items produces zero counts, not an error", () => {
  const metrics = computePageTextMetrics([]);
  assertEqual(metrics.textItemCount, 0);
  assertEqual(metrics.nonEmptyCharacterCount, 0);
  assertEqual(metrics.replacementCharacterCount, 0);
  assertEqual(metrics.unexpectedControlCharacterCount, 0);
});

runTest("metrics: is deterministic across repeated calls with the same input", () => {
  const items = ["abc�", "def"];
  assertEqual(JSON.stringify(computePageTextMetrics(items)), JSON.stringify(computePageTextMetrics(items)));
});

// --- createTechnicalProblem -------------------------------------------------

runTest("technical problem: wires code, level and page number, with a controlled Portuguese message", () => {
  const problem = createTechnicalProblem("page_text_extraction_failed", "page", 7);
  assertEqual(problem.code, "page_text_extraction_failed");
  assertEqual(problem.level, "page");
  assertEqual(problem.pageNumber, 7);
  assertEqual(typeof problem.message, "string");
  assertEqual(problem.message.length > 0, true);
});

runTest("technical problem: document-level problems carry a null page number", () => {
  const problem = createTechnicalProblem("document_invalid_structure", "document", null);
  assertEqual(problem.pageNumber, null);
});

runTest("technical problem: the same code always produces the same controlled message (stable across calls)", () => {
  const first = createTechnicalProblem("page_load_failed", "page", 3);
  const second = createTechnicalProblem("page_load_failed", "page", 9);
  assertEqual(first.message, second.message);
});
