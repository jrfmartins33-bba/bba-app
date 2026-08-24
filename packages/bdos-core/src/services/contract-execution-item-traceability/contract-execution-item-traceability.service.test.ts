import {
  ContractExecutionItemMatchMethod,
  validateContractExecutionItemLinkManifest,
  type ContractExecutionItemLinkManifest,
  type PreparedContractExecutionItemLink,
} from "../../domain/contract-execution-item-link";
import type {
  ContractExecutionItemLinkRevalidation,
  ContractExecutionItemTraceabilityRepository,
} from "./contract-execution-item-traceability.repository";
import {
  persistApprovedContractExecutionItemLinks,
  previewContractExecutionItemLinkPersistence,
} from "./contract-execution-item-traceability.service";

await run("accepts a non-300 one-to-one set without COT-015", async () => {
  const manifest = buildManifest({
    itemCount: 7,
    documentaryRemainderCount: 2,
    caseSpecificEvidenceCount: 3,
  });
  const validation = validateContractExecutionItemLinkManifest(manifest);
  const repository = repositoryWith(greenRevalidation(manifest));
  const preview = await previewContractExecutionItemLinkPersistence(manifest, repository.value);

  equal(validation.valid, true);
  equal(validation.linkCount, 7);
  equal(validation.distinctProposalLineCount, 7);
  equal(validation.distinctOperationalItemCount, 7);
  equal(manifest.links.some((link) => link.proposalLine.documentCode === "COT-015"), false);
  equal(preview.ready, true);
  equal(preview.plannedInsertCount, 7);
  equal(preview.mutationScope.changesHierarchy, false);
  equal(repository.persistCalls(), 0);
});

await run("accepts variable documentary exception evidence counts", async () => {
  const noExceptions = buildManifest({
    itemCount: 4,
    documentaryRemainderCount: 0,
    caseSpecificEvidenceCount: 0,
  });
  const fiveExceptions = buildManifest({
    itemCount: 6,
    documentaryRemainderCount: 4,
    caseSpecificEvidenceCount: 5,
  });

  equal(validateContractExecutionItemLinkManifest(noExceptions).valid, true);
  equal(validateContractExecutionItemLinkManifest(fiveExceptions).valid, true);
  equal(
    (fiveExceptions.specialCases?.documentaryExceptions as ReadonlyArray<unknown>).length,
    5,
  );
});

await run("rejects a reused operational item before any repository write", async () => {
  const manifest = buildManifest({
    itemCount: 5,
    documentaryRemainderCount: 1,
    caseSpecificEvidenceCount: 2,
  });
  const duplicate = {
    ...manifest,
    links: [
      ...manifest.links.slice(0, 4),
      {
        ...manifest.links[4],
        operationalItem: manifest.links[0].operationalItem,
      },
    ],
  };
  const result = validateContractExecutionItemLinkManifest(duplicate);
  equal(result.valid, false);
  assert(result.violations.some((violation) => violation.includes("Operational item reused")));
});

await run("rejects ambiguity before authoritative revalidation", async () => {
  const manifest = buildManifest({
    itemCount: 5,
    documentaryRemainderCount: 1,
    caseSpecificEvidenceCount: 1,
  });
  const ambiguous = {
    ...manifest,
    links: [
      {
        ...manifest.links[0],
        validation: {
          ...manifest.links[0].validation,
          ambiguous: true,
        },
      },
      ...manifest.links.slice(1),
    ],
  } as unknown as ContractExecutionItemLinkManifest;
  const repository = repositoryWith(greenRevalidation(manifest));
  const preview = await previewContractExecutionItemLinkPersistence(ambiguous, repository.value);

  equal(preview.ready, false);
  equal(repository.revalidationCalls(), 0);
  equal(repository.persistCalls(), 0);
});

await run("uses the manifest-approved count for future atomic persistence", async () => {
  const manifest = buildManifest({
    itemCount: 5,
    documentaryRemainderCount: 2,
    caseSpecificEvidenceCount: 1,
  });
  const repository = repositoryWith(greenRevalidation(manifest));
  const result = await persistApprovedContractExecutionItemLinks(
    uuid(999),
    "human-approval-001",
    manifest,
    repository.value,
  );

  equal(result.insertedCount, 5);
  equal(repository.persistCalls(), 1);
});

await run("blocks the future write atomically when authoritative data drift", async () => {
  const manifest = buildManifest({
    itemCount: 7,
    documentaryRemainderCount: 2,
    caseSpecificEvidenceCount: 3,
  });
  const repository = repositoryWith({
    ...greenRevalidation(manifest),
    ready: false,
    validPairCount: 6,
    sourceSnapshotsMatch: false,
    violations: ["At least one source item changed."],
  });
  let rejected = false;
  try {
    await persistApprovedContractExecutionItemLinks(
      uuid(999),
      "human-approval-001",
      manifest,
      repository.value,
    );
  } catch {
    rejected = true;
  }
  equal(rejected, true);
  equal(repository.persistCalls(), 0);
});

function buildManifest(input: {
  readonly itemCount: number;
  readonly documentaryRemainderCount: number;
  readonly caseSpecificEvidenceCount: number;
}): ContractExecutionItemLinkManifest {
  const links: PreparedContractExecutionItemLink[] = [];
  for (let index = 0; index < input.itemCount; index += 1) {
    const remainder = index < input.documentaryRemainderCount;
    links.push({
      sequence: index + 1,
      proposalLine: {
        id: uuid(index + 1),
        position: index,
        documentCode: "DOC-" + index,
        structuralCode: "01.00." + index,
        description: "Item " + index,
        parentLineId: index % 2 === 0 ? null : uuid(5000 + index),
        unit: "UN",
        quantityDecimal: "1",
        unitPriceCents: 100,
        totalCents: 100,
        createdAtSnapshot: "2026-08-21T14:50:55.860541+00:00",
      },
      operationalItem: {
        id: uuid(index + 1001),
        code: "01.00." + index,
        description: "Item " + index,
        unit: "UN",
        contractQuantityDecimal: "1",
        unitPriceDecimal: "1",
        extendedValueDecimal: "1.00000000",
        workPackageId: uuid(index + 2001),
        updatedAtSnapshot: "2026-08-20T13:50:51.285212+00:00",
      },
      matchMethod: remainder
        ? ContractExecutionItemMatchMethod.UniqueExactDocumentaryRemainder
        : ContractExecutionItemMatchMethod.StructuralCodeAndExactMaterialFields,
      evidence: {
        structuralCodeExact: !remainder,
        descriptionExact: true,
        unitExact: true,
        quantityExact: true,
        unitPriceExact: true,
        candidateUniqueInApplicableSet: true,
        externalCodesAreEvidenceOnly: true,
        documentaryExceptionReference: remainder ? "exception-" + index : null,
      },
      validation: {
        status: "Validated",
        materialDivergence: false,
        ambiguous: false,
        proposalIdentityUsesInternalId: true,
        operationalIdentityUsesInternalId: true,
      },
    });
  }

  return {
    schemaVersion: "1.0.0",
    manifestId: "synthetic-contract-execution-traceability",
    writeStatus: "NOT_APPLIED",
    scope: {
      organizationId: uuid(9001),
      engineeringProjectId: uuid(9002),
      contractBaselineId: uuid(9003),
      proposalBudgetVersionId: uuid(9004),
      procurementCaseId: uuid(9005),
      contractNumber: "SYNTHETIC",
      contractor: "Synthetic contractor",
    },
    integrity: {
      validationSetIntegrityId: "11111111111111111111111111111111",
      expectedLinkCount: input.itemCount,
      expectedDistinctProposalLineCount: input.itemCount,
      expectedDistinctOperationalItemCount: input.itemCount,
      structuralCodeAndExactMaterialFieldsCount:
        input.itemCount - input.documentaryRemainderCount,
      uniqueExactDocumentaryRemainderCount: input.documentaryRemainderCount,
      ambiguousCount: 0,
      unmatchedCount: 0,
      materialDivergenceCount: 0,
    },
    sourceSnapshots: {
      contractBaselineUpdatedAt: "2026-08-20T00:00:00Z",
      proposalBudgetVersionUpdatedAt: "2026-08-21T00:00:00Z",
      proposalLinesCreatedAt: "2026-08-21T00:00:00Z",
      operationalItemsUpdatedAt: "2026-08-20T00:00:00Z",
    },
    economics: {
      contractedProposalValueCents: input.itemCount * 100,
      operationalItemsGrossTotalDecimal: String(input.itemCount),
      contractualRoundingAdjustmentDecimal: "0",
      subCentPrecisionItemCount: 0,
      mutationPlanned: false,
    },
    specialCases: {
      documentaryExceptions: Array.from(
        { length: input.caseSpecificEvidenceCount },
        (_, index) => ({ reference: "case-evidence-" + index }),
      ),
    },
    links,
  };
}

function greenRevalidation(
  manifest: ContractExecutionItemLinkManifest,
): ContractExecutionItemLinkRevalidation {
  return {
    ready: true,
    violations: [],
    currentIntegrityId: manifest.integrity.validationSetIntegrityId,
    proposalItemCount: manifest.integrity.expectedDistinctProposalLineCount,
    operationalItemCount: manifest.integrity.expectedDistinctOperationalItemCount,
    validPairCount: manifest.integrity.expectedLinkCount,
    distinctProposalLineCount: manifest.integrity.expectedDistinctProposalLineCount,
    distinctOperationalItemCount: manifest.integrity.expectedDistinctOperationalItemCount,
    sourceSnapshotsMatch: true,
    baselineStillPointsToProposal: true,
    economicsUnchanged: true,
  };
}

function repositoryWith(revalidation: ContractExecutionItemLinkRevalidation) {
  let revalidated = 0;
  let persisted = 0;
  const value: ContractExecutionItemTraceabilityRepository = {
    async revalidateManifest() {
      revalidated += 1;
      return revalidation;
    },
    async persistManifestAtomically(_actorId, _approvalReference, manifest) {
      persisted += 1;
      return {
        insertedCount: manifest.links.length,
        integrityId: revalidation.currentIntegrityId,
      };
    },
    async listByContractBaseline() {
      return [];
    },
  };
  return {
    value,
    revalidationCalls: () => revalidated,
    persistCalls: () => persisted,
  };
}

function uuid(value: number): string {
  return "00000000-0000-4000-8000-" + value.toString(16).padStart(12, "0");
}

async function run(name: string, test: () => Promise<void>): Promise<void> {
  await test();
  console.log("ok - " + name);
}

function equal<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error("expected " + String(expected) + ", got " + String(actual));
  }
}

function assert(condition: boolean): void {
  if (!condition) throw new Error("assertion failed");
}
