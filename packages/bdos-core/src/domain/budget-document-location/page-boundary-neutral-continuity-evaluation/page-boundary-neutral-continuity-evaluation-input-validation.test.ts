import { computeExpectedBoundaryPopulation, validateGroupPopulation, validatePageBoundaryNeutralContinuityEvaluationInput } from "./page-boundary-neutral-continuity-evaluation-input-validation";
import { groupFixture, lineFixture, pageFixture, pageLocalResultFixture, positionFixture, regionFixture } from "./testing/page-boundary-neutral-continuity-evaluation-fixture-builders";

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function onePageOneRegionOneLine(pageNumber: number): ReturnType<typeof pageFixture> {
  const position = positionFixture(`gi-${pageNumber}`, `L${pageNumber}`, 1, 1, pageNumber, `R${pageNumber}`);
  const line = lineFixture(`L${pageNumber}`, pageNumber, 1, "structured", [position]);
  const region = regionFixture(`R${pageNumber}`, pageNumber, 1, "structured", [line]);
  return pageFixture(pageNumber, "structured", [region]);
}

// --- validação global (contrato/status/fingerprint) ---------------------------

const validGroup = groupFixture("G1", "structured", [onePageOneRegionOneLine(1), onePageOneRegionOneLine(2)]);
const validSource = pageLocalResultFixture([validGroup]);

const validated = validatePageBoundaryNeutralContinuityEvaluationInput({ pageLocalNeutralStructuredEvidence: validSource });
equal(validated.kind, "valid", "a well-formed, fingerprint-consistent g.2 result must validate");

const unsupportedContract = { ...validSource, schemaVersion: 999 as unknown as typeof validSource.schemaVersion };
const invalidContract = validatePageBoundaryNeutralContinuityEvaluationInput({ pageLocalNeutralStructuredEvidence: unsupportedContract });
equal(invalidContract.kind, "invalid", "an unsupported g.2 contract version must invalidate the whole input");
if (invalidContract.kind === "invalid") equal(invalidContract.problems[0].code, "source_contract_version_unsupported", "wrong invalidation code for unsupported contract");

const failedStatusSource = { ...validSource, status: "failed" as const };
const invalidStatus = validatePageBoundaryNeutralContinuityEvaluationInput({ pageLocalNeutralStructuredEvidence: failedStatusSource });
equal(invalidStatus.kind, "invalid", "a g.2 result with status failed must invalidate the whole input");
if (invalidStatus.kind === "invalid") equal(invalidStatus.problems[0].code, "source_status_invalid", "wrong invalidation code for failed g.2 status");

const taperedFingerprint = { ...validSource, resultFingerprint: "tampered" };
const invalidFingerprint = validatePageBoundaryNeutralContinuityEvaluationInput({ pageLocalNeutralStructuredEvidence: taperedFingerprint });
equal(invalidFingerprint.kind, "invalid", "a tampered g.2 resultFingerprint must invalidate the whole input");
if (invalidFingerprint.kind === "invalid") equal(invalidFingerprint.problems[0].code, "source_fingerprint_invalid", "wrong invalidation code for tampered fingerprint");

// --- unicidade global de sourceCandidateGroupKey -------------------------------

const duplicateKeyGroupA = groupFixture("GDUP", "structured", [onePageOneRegionOneLine(30)]);
const duplicateKeyGroupB = groupFixture("GDUP", "structured", [onePageOneRegionOneLine(50), onePageOneRegionOneLine(51)]);
const duplicateGroupKeySource = pageLocalResultFixture([duplicateKeyGroupA, duplicateKeyGroupB]);
const duplicateGroupKeyResult = validatePageBoundaryNeutralContinuityEvaluationInput({ pageLocalNeutralStructuredEvidence: duplicateGroupKeySource });
equal(duplicateGroupKeyResult.kind, "invalid", "two distinct groups sharing the same sourceCandidateGroupKey must invalidate the whole input, never partially processed");
if (duplicateGroupKeyResult.kind === "invalid") {
  equal(duplicateGroupKeyResult.problems.length, 1, "exactly one technical problem must be reported for a duplicate group key");
  equal(duplicateGroupKeyResult.problems[0].code, "source_group_reference_invalid", "the code must be source_group_reference_invalid, never source_group_page_population_incoherent (reserved for page gaps/duplicates WITHIN a single group)");
  equal(duplicateGroupKeyResult.problems[0].phase, "source_validation", "the duplicate-group-key failure must be reported at the source_validation phase, before any group-level processing");
  equal(duplicateGroupKeyResult.problems[0].sourceCandidateGroupKey, "GDUP", "the duplicated key itself must be reported");
  equal(duplicateGroupKeyResult.problems[0].originPageNumber, null, "no page coordinate applies to a global group-key duplication");
}

const distinctGroupKeysGroupA = groupFixture("GA", "structured", [onePageOneRegionOneLine(60)]);
const distinctGroupKeysGroupB = groupFixture("GB", "structured", [onePageOneRegionOneLine(70)]);
const distinctGroupKeysResult = validatePageBoundaryNeutralContinuityEvaluationInput({ pageLocalNeutralStructuredEvidence: pageLocalResultFixture([distinctGroupKeysGroupA, distinctGroupKeysGroupB]) });
equal(distinctGroupKeysResult.kind, "valid", "groups with distinct keys must continue to validate normally — the new check must never produce a false positive");

// --- Gate 0: contiguidade/duplicidade de página -------------------------------

const contiguousGroup = groupFixture("GC", "structured", [onePageOneRegionOneLine(4), onePageOneRegionOneLine(5), onePageOneRegionOneLine(6)]);
const coherent = validateGroupPopulation(contiguousGroup);
equal(coherent.kind, "coherent", "three genuinely contiguous pages (4,5,6) must validate as a coherent group");

const gapGroup = groupFixture("GG", "structured", [onePageOneRegionOneLine(4), onePageOneRegionOneLine(5), onePageOneRegionOneLine(7)]);
const gapResult = validateGroupPopulation(gapGroup);
equal(gapResult.kind, "incoherent", "a group with a page-number gap (4,5,7) must never be silently treated as contiguous");
if (gapResult.kind === "incoherent") equal(gapResult.code, "source_group_page_population_incoherent", "wrong code for a page gap");

const duplicateGroup = groupFixture("GD", "structured", [onePageOneRegionOneLine(4), onePageOneRegionOneLine(4)]);
const duplicateResult = validateGroupPopulation(duplicateGroup);
equal(duplicateResult.kind, "incoherent", "a group with a duplicated page number must be rejected, never silently deduplicated");

const singlePageGroup = groupFixture("GS", "structured", [onePageOneRegionOneLine(9)]);
const singlePageResult = validateGroupPopulation(singlePageGroup);
equal(singlePageResult.kind, "coherent", "a single-page group is trivially coherent (zero boundaries expected)");

const emptyGroup = groupFixture("GE", "without_neutral_structure", []);
const emptyResult = validateGroupPopulation(emptyGroup);
equal(emptyResult.kind, "coherent", "a group with zero pages is trivially coherent (zero boundaries expected)");

// --- Gate 0: coerência de chave de região/linha (emenda 2) --------------------

const duplicateRegionKeyPage = (() => {
  const position = positionFixture("gi-dup", "Ldup", 1, 1, 10, "Rdup");
  const line = lineFixture("Ldup", 10, 1, "structured", [position]);
  const regionA = regionFixture("Rdup", 10, 1, "structured", [line]);
  const regionB = { ...regionFixture("Rdup", 10, 2, "structured", []), sourceRegionKey: "Rdup" };
  return pageFixture(10, "structured", [regionA, regionB]);
})();
const duplicateRegionKeyGroup = groupFixture("GRK", "structured", [duplicateRegionKeyPage]);
const duplicateRegionKeyResult = validateGroupPopulation(duplicateRegionKeyGroup);
equal(duplicateRegionKeyResult.kind, "incoherent", "two regions sharing the same sourceRegionKey within one page must be rejected as an upstream contract incoherence");
if (duplicateRegionKeyResult.kind === "incoherent") equal(duplicateRegionKeyResult.code, "source_region_reference_invalid", "wrong code for duplicated region key");

const mismatchedRegionCandidatePage = (() => {
  const position = positionFixture("gi-m", "Lm", 1, 1, 11, "Rm");
  const line = lineFixture("Lm", 11, 1, "structured", [position]);
  const region = regionFixture("Rm", 11, 1, "structured", [line]);
  const tampered = { ...region, sourceRegionCandidate: { ...region.sourceRegionCandidate, regionKey: "someone-else" } };
  return pageFixture(11, "structured", [tampered]);
})();
const mismatchedResult = validateGroupPopulation(groupFixture("GMC", "structured", [mismatchedRegionCandidatePage]));
equal(mismatchedResult.kind, "incoherent", "a region whose sourceRegionCandidate.regionKey diverges from sourceRegionKey must be rejected");

const sharedLineAcrossRegionsPage = (() => {
  const position = positionFixture("gi-s", "Lshared", 1, 1, 12, "Ra");
  const line = lineFixture("Lshared", 12, 1, "structured", [position]);
  const regionA = regionFixture("Ra", 12, 1, "structured", [line]);
  const regionB = regionFixture("Rb", 12, 2, "structured", [{ ...line, pageNumber: 12 }]);
  return pageFixture(12, "structured", [regionA, regionB]);
})();
const sharedLineResult = validateGroupPopulation(groupFixture("GSL", "structured", [sharedLineAcrossRegionsPage]));
equal(sharedLineResult.kind, "incoherent", "the same sourceLineKey appearing in two different regions of the same page must be rejected");
if (sharedLineResult.kind === "incoherent") equal(sharedLineResult.code, "source_line_reference_invalid", "wrong code for a line shared between two regions");

// --- ties de order/verticalOrder NÃO são incoerência de chave (permanecem falha localizada do par) ---
const tiedOrderPage = (() => {
  const position = positionFixture("gi-t1", "Lt1", 1, 1, 13, "Rt1");
  const line = lineFixture("Lt1", 13, 1, "structured", [position]);
  const regionA = regionFixture("Rt1", 13, 1, "structured", [line]);
  const regionB = regionFixture("Rt2", 13, 1, "structured", []); // same order=1, different key — legitimate tie, not a key duplicate
  return pageFixture(13, "structured", [regionA, regionB]);
})();
const tiedOrderResult = validateGroupPopulation(groupFixture("GTO", "structured", [tiedOrderPage]));
equal(tiedOrderResult.kind, "coherent", "two distinct regions tied at the same order is a legitimate structural tie, never a key-coherence incoherence — resolved as a pair-level failure by boundary selection instead");

// --- população esperada (§5/§12) ----------------------------------------------

const twoAdjacentGroup = groupFixture("G2P", "structured", [onePageOneRegionOneLine(20), onePageOneRegionOneLine(21), onePageOneRegionOneLine(22)]);
const population = computeExpectedBoundaryPopulation([twoAdjacentGroup]);
equal(population.pairs.length, 2, "a three-page contiguous group must produce exactly two expected boundaries (N=pages-1)");
equal(population.incoherentGroups.length, 0, "a coherent group must never be reported as incoherent");
equal(population.pairs[0].originPage.pageNumber, 20, "first expected boundary must originate at the lowest page number");
equal(population.pairs[1].targetPage.pageNumber, 22, "last expected boundary must target the highest page number");

const mixedPopulation = computeExpectedBoundaryPopulation([twoAdjacentGroup, gapGroup]);
equal(mixedPopulation.pairs.length, 2, "an incoherent group must contribute zero pairs, while a sibling coherent group is unaffected (group-level isolation)");
equal(mixedPopulation.incoherentGroups.length, 1, "exactly one group must be reported incoherent");
equal(mixedPopulation.incoherentGroups[0].sourceCandidateGroupKey, "GG", "the reported incoherent group key must match the actual gapped group");

console.log("ok - global input validation (contract version, failed status, tampered fingerprint), Gate 0 page contiguity/duplication, Gate 0 region/line key coherence (emenda 2), order ties correctly NOT treated as key incoherence, and expected boundary population with group-level isolation");
