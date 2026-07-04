declare const process: { cwd(): string };

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  CalculationFormulaType,
  CalculationMemoryStatus,
  MeasurementUnit,
  addCalculationSourceEvidence,
  addMeasurementDimension,
  approveCalculationMemory,
  archiveCalculationMemory,
  createCalculationMemory,
  linkEvidenceToDimension,
  markCalculationMemoryCalculated,
  markCalculationMemoryReady,
  markCalculationMemoryReviewed,
  rejectCalculationMemory,
  removeCalculationSourceEvidence,
  removeMeasurementDimension,
  setCalculationResult,
  summarizeCalculationEvidenceLinks,
  summarizeCalculationMemory,
  unlinkEvidenceFromDimension,
  type CalculationMemory,
  type CalculationMemoryResult,
  type CreateCalculationMemoryInput,
  type MeasurementDimensionInput,
} from "./index";

const memoryId = "calc-memory-001";
const actor = "engineer-bruno";
const occurredAt = "2026-07-03T14:00:00Z";
const correlationId = "measurement-calculation-correlation-001";
const createdBy = "engineering-app";
const sourceSystem = "engineering-workspace";

runTest("valid creation", () => {
  const result = createCalculationMemory(createMemoryInputFixture());

  assertSuccess(result, "expected creation success");
  assertEqual(result.memory.id, memoryId, "id mismatch");
  assertEqual(result.memory.formulaType, CalculationFormulaType.VolumeBox, "formulaType mismatch");
  assertEqual(result.memory.status, CalculationMemoryStatus.Draft, "initial status mismatch");
  assertEqual(result.memory.result, null, "expected null initial result");
  assertEqual(result.memory.dimensions.length, 0, "expected empty dimensions by default");
  assertEqual(result.memory.sourceEvidenceIds.length, 0, "expected empty sourceEvidenceIds by default");
  assertEqual(result.memory.timeline.length, 1, "timeline count mismatch");
  assertEqual(result.memory.timeline[0]?.type, "calculation_memory_created", "timeline type mismatch");
  assertEqual(result.memory.trace.length, 1, "trace count mismatch");
  assertEqual(result.memory.trace[0]?.action, "calculation_memory_created", "trace action mismatch");
});

runTest("rejects missing id", () => {
  const result = createCalculationMemory(createMemoryInputFixture({ id: "" }));
  assertFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing title", () => {
  const result = createCalculationMemory(createMemoryInputFixture({ title: "" }));
  assertFailure(result, "expected missing title failure");
  assertEqual(result.errors[0]?.code, "missing_title", "error code mismatch");
});

runTest("rejects missing description", () => {
  const result = createCalculationMemory(createMemoryInputFixture({ description: "" }));
  assertFailure(result, "expected missing description failure");
  assertEqual(result.errors[0]?.code, "missing_description", "error code mismatch");
});

runTest("rejects missing formulaType", () => {
  const result = createCalculationMemory(
    createMemoryInputFixture({ formulaType: "" as CalculationFormulaType }),
  );
  assertFailure(result, "expected missing formulaType failure");
  assertEqual(result.errors[0]?.code, "missing_formula_type", "error code mismatch");
});

runTest("accepts explicit initial dimensions and sourceEvidenceIds", () => {
  const result = createCalculationMemory(
    createMemoryInputFixture({
      dimensions: [dimensionInputFixture(), dimensionInputFixture({ id: "dim-002", name: "altura" })],
      sourceEvidenceIds: ["evidence-a", "evidence-b"],
    }),
  );

  assertSuccess(result, "expected creation success");
  assertEqual(result.memory.dimensions.length, 2, "expected two initial dimensions");
  assertEqual(result.memory.sourceEvidenceIds.length, 2, "expected two initial sourceEvidenceIds");
});

runTest("rejects duplicated dimension ids at creation", () => {
  const result = createCalculationMemory(
    createMemoryInputFixture({
      dimensions: [dimensionInputFixture(), dimensionInputFixture({ name: "altura" })],
    }),
  );

  assertFailure(result, "expected duplicate dimension id failure");
  assertEqual(
    result.errors.some((error) => error.code === "duplicate_dimension_id"),
    true,
    "expected duplicate_dimension_id error",
  );
});

runTest("rejects a negative dimension value at creation", () => {
  const result = createCalculationMemory(
    createMemoryInputFixture({ dimensions: [dimensionInputFixture({ value: -1 })] }),
  );

  assertFailure(result, "expected negative dimension value failure");
  assertEqual(result.errors[0]?.code, "negative_dimension_value", "error code mismatch");
});

runTest("rejects duplicated sourceEvidenceIds at creation", () => {
  const result = createCalculationMemory(
    createMemoryInputFixture({ sourceEvidenceIds: ["evidence-a", "evidence-a"] }),
  );

  assertFailure(result, "expected duplicate sourceEvidenceId failure");
  assertEqual(result.errors[0]?.code, "duplicate_source_evidence_id", "error code mismatch");
});

runTest("rejects duplicated dimension sourceEvidenceIds at creation", () => {
  const result = createCalculationMemory(
    createMemoryInputFixture({
      dimensions: [dimensionInputFixture({ sourceEvidenceIds: ["evidence-a", "evidence-a"] })],
    }),
  );

  assertFailure(result, "expected duplicate dimension sourceEvidenceId failure");
  assertEqual(result.errors[0]?.code, "duplicate_dimension_source_evidence_id", "error code mismatch");
});

runTest("adds a valid dimension", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addMeasurementDimension({ memory: created.memory, dimension: dimensionInputFixture(), actor, occurredAt });

  assertSuccess(result, "expected add dimension success");
  assertEqual(result.memory.dimensions.length, 1, "dimensions count mismatch");
  assertEqual(result.memory.dimensions[0]?.id, "dim-001", "dimension id mismatch");
  assertEqual(result.memory.dimensions[0]?.value, 3.2, "dimension value mismatch");
  assertEqual(result.memory.dimensions[0]?.unit, MeasurementUnit.Meter, "dimension unit mismatch");
  assertEqual(result.memory.dimensions[0]?.sourceEvidenceIds.length, 0, "expected empty sourceEvidenceIds by default");
});

runTest("rejects adding a dimension with a duplicated id", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");
  const withDimension = addMeasurementDimension({
    memory: created.memory,
    dimension: dimensionInputFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(withDimension, "expected first add success");

  const result = addMeasurementDimension({
    memory: withDimension.memory,
    dimension: dimensionInputFixture(),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate dimension id failure");
  assertEqual(result.errors[0]?.code, "duplicate_dimension_id", "error code mismatch");
});

runTest("rejects adding a dimension with a negative value", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addMeasurementDimension({
    memory: created.memory,
    dimension: dimensionInputFixture({ value: -5 }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected negative dimension value failure");
  assertEqual(result.errors[0]?.code, "negative_dimension_value", "error code mismatch");
});

runTest("removes an existing dimension", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");
  const withDimension = addMeasurementDimension({
    memory: created.memory,
    dimension: dimensionInputFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(withDimension, "expected add success");

  const result = removeMeasurementDimension({ memory: withDimension.memory, dimensionId: "dim-001", actor, occurredAt });

  assertSuccess(result, "expected remove success");
  assertEqual(result.memory.dimensions.length, 0, "expected dimensions to be empty after removal");
});

runTest("rejects removing a dimension that does not exist", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");

  const result = removeMeasurementDimension({ memory: created.memory, dimensionId: "unknown-dim", actor, occurredAt });

  assertFailure(result, "expected dimension_not_found failure");
  assertEqual(result.errors[0]?.code, "dimension_not_found", "error code mismatch");
});

runTest("blocks dimension changes once memory reaches Approved or Rejected", () => {
  const approved = buildApprovedMemoryFixture();

  const addResult = addMeasurementDimension({ memory: approved, dimension: dimensionInputFixture(), actor, occurredAt });
  assertFailure(addResult, "expected add to be blocked on Approved");
  assertEqual(addResult.errors[0]?.code, "memory_locked_for_dimension_changes", "add error code mismatch");

  const rejected = buildRejectedMemoryFixture();
  const removeResult = removeMeasurementDimension({ memory: rejected, dimensionId: "dim-001", actor, occurredAt });
  assertFailure(removeResult, "expected remove to be blocked on Rejected");
  assertEqual(removeResult.errors[0]?.code, "memory_locked_for_dimension_changes", "remove error code mismatch");
});

runTest("addCalculationSourceEvidence adds a valid source evidence id", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");

  const result = addCalculationSourceEvidence({ memory: created.memory, sourceEvidenceId: "evidence-a", actor, occurredAt });

  assertSuccess(result, "expected add source evidence success");
  assertEqual(result.memory.sourceEvidenceIds.length, 1, "sourceEvidenceIds count mismatch");
  assertEqual(result.memory.sourceEvidenceIds[0], "evidence-a", "sourceEvidenceIds content mismatch");
});

runTest("rejects adding a duplicated source evidence id", () => {
  const withEvidence = buildMemoryWithSourceEvidenceFixture();

  const result = addCalculationSourceEvidence({ memory: withEvidence, sourceEvidenceId: "evidence-a", actor, occurredAt });

  assertFailure(result, "expected duplicate source evidence failure");
  assertEqual(result.errors[0]?.code, "duplicate_source_evidence_id", "error code mismatch");
});

runTest("removeCalculationSourceEvidence removes a valid, unlinked source evidence id", () => {
  const withEvidence = buildMemoryWithSourceEvidenceFixture();

  const result = removeCalculationSourceEvidence({ memory: withEvidence, sourceEvidenceId: "evidence-a", actor, occurredAt });

  assertSuccess(result, "expected remove source evidence success");
  assertEqual(result.memory.sourceEvidenceIds.length, 0, "expected sourceEvidenceIds to be empty after removal");
});

runTest("rejects removing a source evidence id that does not exist", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");

  const result = removeCalculationSourceEvidence({ memory: created.memory, sourceEvidenceId: "unknown-evidence", actor, occurredAt });

  assertFailure(result, "expected source_evidence_id_not_found failure");
  assertEqual(result.errors[0]?.code, "source_evidence_id_not_found", "error code mismatch");
});

runTest("blocks removing a global source evidence id still linked to a dimension", () => {
  const linked = buildMemoryWithLinkedEvidenceFixture();

  const result = removeCalculationSourceEvidence({ memory: linked, sourceEvidenceId: "evidence-a", actor, occurredAt });

  assertFailure(result, "expected source_evidence_still_linked failure");
  assertEqual(result.errors[0]?.code, "source_evidence_still_linked", "error code mismatch");
});

runTest("linkEvidenceToDimension links a valid global source evidence id to a dimension", () => {
  const withEvidence = buildMemoryWithSourceEvidenceFixture();

  const result = linkEvidenceToDimension({
    memory: withEvidence,
    dimensionId: "dim-001",
    sourceEvidenceId: "evidence-a",
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected link success");
  assertEqual(result.memory.dimensions[0]?.sourceEvidenceIds.length, 1, "dimension sourceEvidenceIds count mismatch");
  assertEqual(result.memory.dimensions[0]?.sourceEvidenceIds[0], "evidence-a", "dimension sourceEvidenceIds content mismatch");
});

runTest("rejects linking evidence to a dimension that does not exist", () => {
  const withEvidence = buildMemoryWithSourceEvidenceFixture();

  const result = linkEvidenceToDimension({
    memory: withEvidence,
    dimensionId: "unknown-dim",
    sourceEvidenceId: "evidence-a",
    actor,
    occurredAt,
  });

  assertFailure(result, "expected dimension_not_found failure");
  assertEqual(result.errors[0]?.code, "dimension_not_found", "error code mismatch");
});

runTest("rejects linking a source evidence id that does not exist at the memory level", () => {
  const created = createCalculationMemory(
    createMemoryInputFixture({ dimensions: [dimensionInputFixture()] }),
  );
  assertSuccess(created, "expected creation success");

  const result = linkEvidenceToDimension({
    memory: created.memory,
    dimensionId: "dim-001",
    sourceEvidenceId: "evidence-not-registered",
    actor,
    occurredAt,
  });

  assertFailure(result, "expected unknown_source_evidence_reference failure");
  assertEqual(result.errors[0]?.code, "unknown_source_evidence_reference", "error code mismatch");
});

runTest("rejects linking the same evidence id twice to the same dimension", () => {
  const linked = buildMemoryWithLinkedEvidenceFixture();

  const result = linkEvidenceToDimension({
    memory: linked,
    dimensionId: "dim-001",
    sourceEvidenceId: "evidence-a",
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate_dimension_source_evidence_id failure");
  assertEqual(result.errors[0]?.code, "duplicate_dimension_source_evidence_id", "error code mismatch");
});

runTest("unlinkEvidenceFromDimension unlinks a valid linked source evidence id", () => {
  const linked = buildMemoryWithLinkedEvidenceFixture();

  const result = unlinkEvidenceFromDimension({
    memory: linked,
    dimensionId: "dim-001",
    sourceEvidenceId: "evidence-a",
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected unlink success");
  assertEqual(result.memory.dimensions[0]?.sourceEvidenceIds.length, 0, "expected dimension sourceEvidenceIds to be empty after unlink");
  assertEqual(result.memory.sourceEvidenceIds.length, 1, "global sourceEvidenceIds must remain untouched by unlink");
});

runTest("rejects unlinking a source evidence id that is not linked to the dimension", () => {
  const withEvidence = buildMemoryWithSourceEvidenceFixture();

  const result = unlinkEvidenceFromDimension({
    memory: withEvidence,
    dimensionId: "dim-001",
    sourceEvidenceId: "evidence-a",
    actor,
    occurredAt,
  });

  assertFailure(result, "expected dimension_source_evidence_id_not_found failure");
  assertEqual(result.errors[0]?.code, "dimension_source_evidence_id_not_found", "error code mismatch");
});

runTest("blocks evidence link changes once memory reaches Approved, Rejected or Archived", () => {
  const memoryOverrides = {
    dimensions: [dimensionInputFixture()],
    sourceEvidenceIds: ["evidence-a"],
  };

  const approved = buildApprovedMemoryFixture(memoryOverrides);
  const addResult = addCalculationSourceEvidence({ memory: approved, sourceEvidenceId: "evidence-x", actor, occurredAt });
  assertFailure(addResult, "expected add to be blocked on Approved");
  assertEqual(addResult.errors[0]?.code, "memory_locked_for_evidence_changes", "add error code mismatch");

  const rejected = buildRejectedMemoryFixture(memoryOverrides);
  const linkResult = linkEvidenceToDimension({
    memory: rejected,
    dimensionId: "dim-001",
    sourceEvidenceId: "evidence-a",
    actor,
    occurredAt,
  });
  assertFailure(linkResult, "expected link to be blocked on Rejected");
  assertEqual(linkResult.errors[0]?.code, "memory_locked_for_evidence_changes", "link error code mismatch");

  const archivedResult = archiveCalculationMemory({ memory: approved, actor, occurredAt });
  assertSuccess(archivedResult, "expected archive success as setup step");
  const removeResult = removeCalculationSourceEvidence({
    memory: archivedResult.memory,
    sourceEvidenceId: "evidence-a",
    actor,
    occurredAt,
  });
  assertFailure(removeResult, "expected remove to be blocked on Archived");
  assertEqual(removeResult.errors[0]?.code, "memory_locked_for_evidence_changes", "remove error code mismatch");
});

runTest("evidence link mutations grow trace but not timeline", () => {
  const created = createCalculationMemory(createMemoryInputFixture({ dimensions: [dimensionInputFixture()] }));
  assertSuccess(created, "expected creation success");
  assertEqual(created.memory.trace.length, 1, "trace length after creation mismatch");
  assertEqual(created.memory.timeline.length, 1, "timeline length after creation mismatch");

  const withEvidence = addCalculationSourceEvidence({ memory: created.memory, sourceEvidenceId: "evidence-a", actor, occurredAt });
  assertSuccess(withEvidence, "expected add source evidence success");
  assertEqual(withEvidence.memory.trace.length, 2, "trace must grow on add source evidence");
  assertEqual(withEvidence.memory.timeline.length, 1, "timeline must not grow on add source evidence");

  const linked = linkEvidenceToDimension({
    memory: withEvidence.memory,
    dimensionId: "dim-001",
    sourceEvidenceId: "evidence-a",
    actor,
    occurredAt,
  });
  assertSuccess(linked, "expected link success");
  assertEqual(linked.memory.trace.length, 3, "trace must grow on link");
  assertEqual(linked.memory.timeline.length, 1, "timeline must not grow on link");

  const unlinked = unlinkEvidenceFromDimension({
    memory: linked.memory,
    dimensionId: "dim-001",
    sourceEvidenceId: "evidence-a",
    actor,
    occurredAt,
  });
  assertSuccess(unlinked, "expected unlink success");
  assertEqual(unlinked.memory.trace.length, 4, "trace must grow on unlink");
  assertEqual(unlinked.memory.timeline.length, 1, "timeline must not grow on unlink");

  const removed = removeCalculationSourceEvidence({ memory: unlinked.memory, sourceEvidenceId: "evidence-a", actor, occurredAt });
  assertSuccess(removed, "expected remove source evidence success");
  assertEqual(removed.memory.trace.length, 5, "trace must grow on remove source evidence");
  assertEqual(removed.memory.timeline.length, 1, "timeline must not grow on remove source evidence");
});

runTest("summarizeCalculationEvidenceLinks reports evidence traceability per dimension", () => {
  const linked = buildMemoryWithLinkedEvidenceFixture();

  const summary = summarizeCalculationEvidenceLinks(linked);

  assertEqual(summary.totalSourceEvidenceIds, 1, "totalSourceEvidenceIds mismatch");
  assertEqual(summary.totalLinkedDimensions, 1, "totalLinkedDimensions mismatch");
  assertEqual(summary.totalDimensionEvidenceLinks, 1, "totalDimensionEvidenceLinks mismatch");
  assertEqual(summary.dimensionLinks.length, 1, "dimensionLinks length mismatch");
  assertEqual(summary.dimensionLinks[0]?.dimensionId, "dim-001", "dimensionLinks dimensionId mismatch");
  assertEqual(summary.dimensionLinks[0]?.totalLinkedEvidenceIds, 1, "dimensionLinks count mismatch");
});

runTest("evidence link output is deeply immutable", () => {
  const withEvidence = buildMemoryWithSourceEvidenceFixture();

  const result = linkEvidenceToDimension({
    memory: withEvidence,
    dimensionId: "dim-001",
    sourceEvidenceId: "evidence-a",
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected link success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.memory), true, "memory should be frozen");
  assertEqual(Object.isFrozen(result.memory.dimensions[0]), true, "dimension should be frozen");
  assertEqual(Object.isFrozen(result.memory.dimensions[0]?.sourceEvidenceIds), true, "dimension sourceEvidenceIds should be frozen");
  assertEqual(Object.isFrozen(result.memory.sourceEvidenceIds), true, "memory sourceEvidenceIds should be frozen");
});

runTest("evidence link mutation is deterministic across identical operations", () => {
  const buildLinked = () => {
    const withEvidence = buildMemoryWithSourceEvidenceFixture();
    const result = linkEvidenceToDimension({
      memory: withEvidence,
      dimensionId: "dim-001",
      sourceEvidenceId: "evidence-a",
      actor,
      occurredAt,
    });
    assertSuccess(result, "expected link success");
    return result;
  };

  const first = JSON.stringify(buildLinked());
  const second = JSON.stringify(buildLinked());
  assertEqual(first, second, "expected deterministic evidence link output");
});

runTest("sets a valid calculation result while Ready", () => {
  const ready = buildReadyMemoryFixture();

  const result = setCalculationResult({
    memory: ready,
    value: 40.96,
    unit: MeasurementUnit.CubicMeter,
    precision: 2,
    rounded: true,
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected set result success");
  assertEqual(result.memory.result?.value, 40.96, "result value mismatch");
  assertEqual(result.memory.result?.unit, MeasurementUnit.CubicMeter, "result unit mismatch");
  assertEqual(result.memory.result?.precision, 2, "result precision mismatch");
  assertEqual(result.memory.result?.rounded, true, "result rounded mismatch");
});

runTest("rejects setting a calculation result with a negative value", () => {
  const ready = buildReadyMemoryFixture();

  const result = setCalculationResult({
    memory: ready,
    value: -1,
    unit: MeasurementUnit.CubicMeter,
    precision: 2,
    rounded: false,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected negative result value failure");
  assertEqual(result.errors[0]?.code, "negative_result_value", "error code mismatch");
});

runTest("rejects setting a calculation result with invalid precision", () => {
  const ready = buildReadyMemoryFixture();

  const result = setCalculationResult({
    memory: ready,
    value: 10,
    unit: MeasurementUnit.CubicMeter,
    precision: -1,
    rounded: false,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected invalid precision failure");
  assertEqual(result.errors[0]?.code, "invalid_result_precision", "error code mismatch");

  const nonIntegerResult = setCalculationResult({
    memory: ready,
    value: 10,
    unit: MeasurementUnit.CubicMeter,
    precision: 1.5,
    rounded: false,
    actor,
    occurredAt,
  });

  assertFailure(nonIntegerResult, "expected non-integer precision failure");
  assertEqual(nonIntegerResult.errors[0]?.code, "invalid_result_precision", "error code mismatch");
});

runTest("blocks setting a calculation result while Draft", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");

  const result = setCalculationResult({
    memory: created.memory,
    value: 10,
    unit: MeasurementUnit.CubicMeter,
    precision: 2,
    rounded: false,
    actor,
    occurredAt,
  });

  assertFailure(result, "expected result blocked on Draft");
  assertEqual(result.errors[0]?.code, "result_not_allowed_in_current_status", "error code mismatch");
});

runTest("adding/removing a dimension does not grow the timeline", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");
  assertEqual(created.memory.timeline.length, 1, "timeline length after creation mismatch");

  const withDimension = addMeasurementDimension({
    memory: created.memory,
    dimension: dimensionInputFixture(),
    actor,
    occurredAt,
  });
  assertSuccess(withDimension, "expected add success");
  assertEqual(withDimension.memory.timeline.length, 1, "timeline must not grow on add dimension");
  assertEqual(withDimension.memory.trace.length, 2, "trace must grow on add dimension");

  const withoutDimension = removeMeasurementDimension({
    memory: withDimension.memory,
    dimensionId: "dim-001",
    actor,
    occurredAt,
  });
  assertSuccess(withoutDimension, "expected remove success");
  assertEqual(withoutDimension.memory.timeline.length, 1, "timeline must not grow on remove dimension");
  assertEqual(withoutDimension.memory.trace.length, 3, "trace must grow on remove dimension");
});

runTest("setting a calculation result does not grow the timeline", () => {
  const ready = buildReadyMemoryFixture();
  const traceLengthBefore = ready.trace.length;
  const timelineLengthBefore = ready.timeline.length;

  const result = setCalculationResult({
    memory: ready,
    value: 10,
    unit: MeasurementUnit.CubicMeter,
    precision: 2,
    rounded: false,
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected set result success");
  assertEqual(result.memory.timeline.length, timelineLengthBefore, "timeline must not grow on set result");
  assertEqual(result.memory.trace.length, traceLengthBefore + 1, "trace must grow on set result");
});

runTest("valid transition path: Draft -> Ready -> Calculated -> Reviewed -> Approved -> Archived", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");

  const ready = markCalculationMemoryReady({ memory: created.memory, actor, occurredAt });
  assertSuccess(ready, "expected ready success");
  assertEqual(ready.memory.status, CalculationMemoryStatus.Ready, "status after ready mismatch");

  const calculated = markCalculationMemoryCalculated({ memory: ready.memory, actor, occurredAt });
  assertSuccess(calculated, "expected calculated success");
  assertEqual(calculated.memory.status, CalculationMemoryStatus.Calculated, "status after calculated mismatch");

  const reviewed = markCalculationMemoryReviewed({ memory: calculated.memory, actor, occurredAt });
  assertSuccess(reviewed, "expected reviewed success");
  assertEqual(reviewed.memory.status, CalculationMemoryStatus.Reviewed, "status after reviewed mismatch");

  const approved = approveCalculationMemory({ memory: reviewed.memory, actor, occurredAt });
  assertSuccess(approved, "expected approve success");
  assertEqual(approved.memory.status, CalculationMemoryStatus.Approved, "status after approve mismatch");

  const archived = archiveCalculationMemory({ memory: approved.memory, actor, occurredAt });
  assertSuccess(archived, "expected archive success");
  assertEqual(archived.memory.status, CalculationMemoryStatus.Archived, "status after archive mismatch");
});

runTest("valid rejection path: Reviewed -> Rejected -> Archived", () => {
  const reviewed = buildReviewedMemoryFixture();

  const rejected = rejectCalculationMemory({ memory: reviewed, actor, occurredAt });
  assertSuccess(rejected, "expected reject success");
  assertEqual(rejected.memory.status, CalculationMemoryStatus.Rejected, "status after reject mismatch");

  const archived = archiveCalculationMemory({ memory: rejected.memory, actor, occurredAt });
  assertSuccess(archived, "expected archive success");
  assertEqual(archived.memory.status, CalculationMemoryStatus.Archived, "status after archive mismatch");
});

runTest("Draft, Ready, Calculated and Reviewed can all archive directly", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");
  const archivedFromDraft = archiveCalculationMemory({ memory: created.memory, actor, occurredAt });
  assertSuccess(archivedFromDraft, "expected Draft -> Archived to succeed");

  const ready = buildReadyMemoryFixture();
  const archivedFromReady = archiveCalculationMemory({ memory: ready, actor, occurredAt });
  assertSuccess(archivedFromReady, "expected Ready -> Archived to succeed");

  const calculated = buildCalculatedMemoryFixture();
  const archivedFromCalculated = archiveCalculationMemory({ memory: calculated, actor, occurredAt });
  assertSuccess(archivedFromCalculated, "expected Calculated -> Archived to succeed");

  const reviewed = buildReviewedMemoryFixture();
  const archivedFromReviewed = archiveCalculationMemory({ memory: reviewed, actor, occurredAt });
  assertSuccess(archivedFromReviewed, "expected Reviewed -> Archived to succeed");
});

runTest("rejects invalid status transitions", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");

  const skipToCalculated = markCalculationMemoryCalculated({ memory: created.memory, actor, occurredAt });
  assertFailure(skipToCalculated, "expected Draft -> Calculated to be rejected");
  assertEqual(skipToCalculated.errors[0]?.code, "invalid_calculation_memory_status_transition", "error code mismatch");

  const skipToApproved = approveCalculationMemory({ memory: created.memory, actor, occurredAt });
  assertFailure(skipToApproved, "expected Draft -> Approved to be rejected");
  assertEqual(skipToApproved.errors[0]?.code, "invalid_calculation_memory_status_transition", "error code mismatch");

  const ready = buildReadyMemoryFixture();
  const backToDraft = markCalculationMemoryReady({ memory: ready, actor, occurredAt });
  assertFailure(backToDraft, "expected Ready -> Ready to be rejected");
  assertEqual(backToDraft.errors[0]?.code, "invalid_calculation_memory_status_transition", "error code mismatch");
});

runTest("Approved is operationally terminal: blocks further status changes except archive", () => {
  const approved = buildApprovedMemoryFixture();

  const backToReviewed = markCalculationMemoryReviewed({ memory: approved, actor, occurredAt });
  assertFailure(backToReviewed, "expected Approved -> Reviewed to be rejected");
  assertEqual(backToReviewed.errors[0]?.code, "invalid_calculation_memory_status_transition", "error code mismatch");

  const toRejected = rejectCalculationMemory({ memory: approved, actor, occurredAt });
  assertFailure(toRejected, "expected Approved -> Rejected to be rejected");
  assertEqual(toRejected.errors[0]?.code, "invalid_calculation_memory_status_transition", "error code mismatch");

  const archived = archiveCalculationMemory({ memory: approved, actor, occurredAt });
  assertSuccess(archived, "expected Approved -> Archived to succeed");
});

runTest("Rejected is operationally terminal: blocks further status changes except archive", () => {
  const rejected = buildRejectedMemoryFixture();

  const toApproved = approveCalculationMemory({ memory: rejected, actor, occurredAt });
  assertFailure(toApproved, "expected Rejected -> Approved to be rejected");
  assertEqual(toApproved.errors[0]?.code, "invalid_calculation_memory_status_transition", "error code mismatch");

  const archived = archiveCalculationMemory({ memory: rejected, actor, occurredAt });
  assertSuccess(archived, "expected Rejected -> Archived to succeed");
});

runTest("Archived is an absolute terminal: blocks any further mutation", () => {
  const approved = buildApprovedMemoryFixture();
  const archivedResult = archiveCalculationMemory({ memory: approved, actor, occurredAt });
  assertSuccess(archivedResult, "expected archive success as setup step");
  const archived = archivedResult.memory;

  [
    () => markCalculationMemoryReady({ memory: archived, actor, occurredAt }),
    () => markCalculationMemoryCalculated({ memory: archived, actor, occurredAt }),
    () => markCalculationMemoryReviewed({ memory: archived, actor, occurredAt }),
    () => approveCalculationMemory({ memory: archived, actor, occurredAt }),
    () => rejectCalculationMemory({ memory: archived, actor, occurredAt }),
    () => archiveCalculationMemory({ memory: archived, actor, occurredAt }),
  ].forEach((attempt, index) => {
    const result = attempt();
    assertFailure(result, `expected terminal block on attempt #${index}`);
    assertEqual(result.errors[0]?.code, "memory_terminal", `error code mismatch on attempt #${index}`);
  });

  const addResult = addMeasurementDimension({ memory: archived, dimension: dimensionInputFixture(), actor, occurredAt });
  assertFailure(addResult, "expected dimension add to be blocked on Archived");
  assertEqual(addResult.errors[0]?.code, "memory_locked_for_dimension_changes", "error code mismatch");
});

runTest("every mutation grows trace", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");
  assertEqual(created.memory.trace.length, 1, "trace length after creation mismatch");

  const ready = markCalculationMemoryReady({ memory: created.memory, actor, occurredAt });
  assertSuccess(ready, "expected ready success");
  assertEqual(ready.memory.trace.length, 2, "trace length after ready mismatch");

  const withDimension = addMeasurementDimension({ memory: ready.memory, dimension: dimensionInputFixture(), actor, occurredAt });
  assertSuccess(withDimension, "expected add dimension success");
  assertEqual(withDimension.memory.trace.length, 3, "trace length after add dimension mismatch");
});

runTest("only status transitions grow the timeline", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");
  assertEqual(created.memory.timeline.length, 1, "timeline length after creation mismatch");

  const ready = markCalculationMemoryReady({ memory: created.memory, actor, occurredAt });
  assertSuccess(ready, "expected ready success");
  assertEqual(ready.memory.timeline.length, 2, "timeline length after ready mismatch");
  assertEqual(ready.memory.timeline[1]?.type, "calculation_memory_marked_ready", "timeline type mismatch");
});

runTest("summarizeCalculationMemory matches memory state", () => {
  const created = createCalculationMemory(createMemoryInputFixture());
  assertSuccess(created, "expected creation success");

  const draftSummary = summarizeCalculationMemory(created.memory);
  assertEqual(draftSummary.status, CalculationMemoryStatus.Draft, "draft summary status mismatch");
  assertEqual(draftSummary.formulaType, CalculationFormulaType.VolumeBox, "draft summary formulaType mismatch");
  assertEqual(draftSummary.totalDimensions, 0, "draft summary totalDimensions mismatch");
  assertEqual(draftSummary.hasResult, false, "draft summary hasResult mismatch");
  assertEqual(draftSummary.totalSourceEvidenceIds, 0, "draft summary totalSourceEvidenceIds mismatch");
  assertEqual(draftSummary.totalTraceEntries, 1, "draft summary trace count mismatch");
  assertEqual(draftSummary.totalTimelineEntries, 1, "draft summary timeline count mismatch");
  assertEqual(draftSummary.isTerminal, false, "draft summary isTerminal mismatch");
  assertEqual(draftSummary.isOperationallyTerminal, false, "draft summary isOperationallyTerminal mismatch");

  const approved = buildApprovedMemoryFixture();
  const approvedSummary = summarizeCalculationMemory(approved);
  assertEqual(approvedSummary.isTerminal, false, "approved summary isTerminal mismatch (operational, not absolute)");
  assertEqual(approvedSummary.isOperationallyTerminal, true, "approved summary isOperationallyTerminal mismatch");

  const archivedResult = archiveCalculationMemory({ memory: approved, actor, occurredAt });
  assertSuccess(archivedResult, "expected archive success as setup step");
  const archivedSummary = summarizeCalculationMemory(archivedResult.memory);
  assertEqual(archivedSummary.isTerminal, true, "archived summary isTerminal mismatch");

  const ready = buildReadyMemoryFixture();
  const withResult = setCalculationResult({
    memory: ready,
    value: 10,
    unit: MeasurementUnit.CubicMeter,
    precision: 2,
    rounded: false,
    actor,
    occurredAt,
  });
  assertSuccess(withResult, "expected set result success");
  assertEqual(summarizeCalculationMemory(withResult.memory).hasResult, true, "expected hasResult true after set result");
});

runTest("output is deeply immutable", () => {
  const result = createCalculationMemory(createMemoryInputFixture());

  assertSuccess(result, "expected creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.memory), true, "memory should be frozen");
  assertEqual(Object.isFrozen(result.memory.dimensions), true, "dimensions should be frozen");
  assertEqual(Object.isFrozen(result.memory.trace), true, "trace should be frozen");
  assertEqual(Object.isFrozen(result.memory.timeline), true, "timeline should be frozen");
  assertEqual(Object.isFrozen(result.memory.metadata), true, "metadata should be frozen");

  const withDimension = addMeasurementDimension({ memory: result.memory, dimension: dimensionInputFixture(), actor, occurredAt });
  assertSuccess(withDimension, "expected add success");
  assertEqual(Object.isFrozen(withDimension.memory), true, "memory after add should be frozen");
  assertEqual(Object.isFrozen(withDimension.memory.dimensions), true, "dimensions after add should be frozen");
  assertEqual(Object.isFrozen(withDimension.memory.dimensions[0]), true, "individual dimension should be frozen");
});

runTest("creation is deterministic for identical input", () => {
  const input = createMemoryInputFixture();
  const first = JSON.stringify(createCalculationMemory(input));
  const second = JSON.stringify(createCalculationMemory(input));

  assertEqual(first, second, "expected deterministic creation output");
});

runTest("mutation is deterministic across identical operations", () => {
  const buildMutated = () => {
    const created = createCalculationMemory(createMemoryInputFixture());
    assertSuccess(created, "expected creation success");
    const withDimension = addMeasurementDimension({
      memory: created.memory,
      dimension: dimensionInputFixture(),
      actor,
      occurredAt,
    });
    assertSuccess(withDimension, "expected add success");
    return withDimension;
  };

  const first = JSON.stringify(buildMutated());
  const second = JSON.stringify(buildMutated());
  assertEqual(first, second, "expected deterministic mutation output");
});

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourceCode = readDomainSourceFiles();
  const lowerSourceCode = sourceCode.toLowerCase();

  [
    "date.now(",
    "math.random(",
    "crypto.randomuuid",
    "uuid()",
    "field-evidence",
    "engineering-contract",
    "engineering-project-context",
    "measurement-workspace",
    "approval-workflow",
    "official-template-engine",
    "template-engine",
    "export-engine",
    "decision-engine",
    "engines/decision",
    "business-fact",
    "business-facts",
    "react",
    "next",
    "supabase",
    "\"fs\"",
    "'fs'",
    "node:fs",
    "\"path\"",
    "'path'",
    "node:path",
    "xlsx",
    "pdf-lib",
    "pdfkit",
    "docx",
    "ocr",
    "gps.get",
    "whatsapp",
    "tensorflow",
    "openai",
    "fetch(",
  ].forEach((forbidden) => {
    assertEqual(
      lowerSourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in domain source: ${forbidden}`,
    );
  });
});

// --- Fixtures ----------------------------------------------------------------

function buildReadyMemoryFixture(overrides: Partial<CreateCalculationMemoryInput> = {}): CalculationMemory {
  const created = createCalculationMemory(createMemoryInputFixture(overrides));
  assertSuccess(created, "expected creation success");
  const ready = markCalculationMemoryReady({ memory: created.memory, actor, occurredAt });
  assertSuccess(ready, "expected ready success");
  return ready.memory;
}

function buildCalculatedMemoryFixture(overrides: Partial<CreateCalculationMemoryInput> = {}): CalculationMemory {
  const ready = buildReadyMemoryFixture(overrides);
  const calculated = markCalculationMemoryCalculated({ memory: ready, actor, occurredAt });
  assertSuccess(calculated, "expected calculated success");
  return calculated.memory;
}

function buildReviewedMemoryFixture(overrides: Partial<CreateCalculationMemoryInput> = {}): CalculationMemory {
  const calculated = buildCalculatedMemoryFixture(overrides);
  const reviewed = markCalculationMemoryReviewed({ memory: calculated, actor, occurredAt });
  assertSuccess(reviewed, "expected reviewed success");
  return reviewed.memory;
}

function buildApprovedMemoryFixture(overrides: Partial<CreateCalculationMemoryInput> = {}): CalculationMemory {
  const reviewed = buildReviewedMemoryFixture(overrides);
  const approved = approveCalculationMemory({ memory: reviewed, actor, occurredAt });
  assertSuccess(approved, "expected approve success");
  return approved.memory;
}

function buildRejectedMemoryFixture(overrides: Partial<CreateCalculationMemoryInput> = {}): CalculationMemory {
  const reviewed = buildReviewedMemoryFixture(overrides);
  const rejected = rejectCalculationMemory({ memory: reviewed, actor, occurredAt });
  assertSuccess(rejected, "expected reject success");
  return rejected.memory;
}

function buildMemoryWithSourceEvidenceFixture(): CalculationMemory {
  const created = createCalculationMemory(
    createMemoryInputFixture({ dimensions: [dimensionInputFixture()] }),
  );
  assertSuccess(created, "expected creation success");
  const withEvidence = addCalculationSourceEvidence({
    memory: created.memory,
    sourceEvidenceId: "evidence-a",
    actor,
    occurredAt,
  });
  assertSuccess(withEvidence, "expected add source evidence success");
  return withEvidence.memory;
}

function buildMemoryWithLinkedEvidenceFixture(): CalculationMemory {
  const withEvidence = buildMemoryWithSourceEvidenceFixture();
  const linked = linkEvidenceToDimension({
    memory: withEvidence,
    dimensionId: "dim-001",
    sourceEvidenceId: "evidence-a",
    actor,
    occurredAt,
  });
  assertSuccess(linked, "expected link success");
  return linked.memory;
}

function createMemoryInputFixture(
  overrides: Partial<CreateCalculationMemoryInput> = {},
): CreateCalculationMemoryInput {
  return {
    id: overrides.id ?? memoryId,
    title: overrides.title ?? "Volume de concreto - Bloco B",
    description: overrides.description ?? "Memoria de calculo do volume de concreto do bloco B.",
    formulaType: overrides.formulaType ?? CalculationFormulaType.VolumeBox,
    dimensions: overrides.dimensions,
    sourceEvidenceIds: overrides.sourceEvidenceIds,
    actor: overrides.actor ?? actor,
    occurredAt: overrides.occurredAt ?? occurredAt,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "measurement-calculation" },
  };
}

function dimensionInputFixture(
  overrides: Partial<MeasurementDimensionInput> = {},
): MeasurementDimensionInput {
  return {
    id: overrides.id ?? "dim-001",
    name: overrides.name ?? "largura",
    value: overrides.value ?? 3.2,
    unit: overrides.unit ?? MeasurementUnit.Meter,
    notes: overrides.notes,
    sourceEvidenceIds: overrides.sourceEvidenceIds,
  };
}

function readDomainSourceFiles(): string {
  const domainDir = resolve(process.cwd(), "src", "domain", "measurement-calculation");
  return listTsFiles(domainDir)
    .filter((file) => !file.endsWith(".test.ts"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function listTsFiles(dir: string): ReadonlyArray<string> {
  let entries: ReadonlyArray<string>;

  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const files: string[] = [];

  entries.forEach((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listTsFiles(fullPath));
      return;
    }

    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  });

  return files;
}

// --- Test harness --------------------------------------------------------------

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertSuccess(
  result: CalculationMemoryResult,
  message: string,
): asserts result is Extract<CalculationMemoryResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertFailure(
  result: CalculationMemoryResult,
  message: string,
): asserts result is Extract<CalculationMemoryResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
