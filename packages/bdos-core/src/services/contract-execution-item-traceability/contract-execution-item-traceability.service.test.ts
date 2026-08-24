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

const manifest = buildManifest();

await run("validates 300 permanent-ID one-to-one pairs and the COT-015 exception", async () => {
  const result = validateContractExecutionItemLinkManifest(manifest);
  equal(result.valid, true);
  equal(result.linkCount, 300);
  equal(result.distinctProposalLineCount, 300);
  equal(result.distinctOperationalItemCount, 300);
});

await run("rejects a reused operational item before any repository write", async () => {
  const duplicate = {
    ...manifest,
    links: [
      ...manifest.links.slice(0, 299),
      {
        ...manifest.links[299],
        operationalItem: manifest.links[0].operationalItem,
      },
    ],
  };
  const result = validateContractExecutionItemLinkManifest(duplicate);
  equal(result.valid, false);
  assert(result.violations.some((violation) => violation.includes("Operational item reused")));
});

await run("previews the exact insert set without invoking persistence", async () => {
  const repository = repositoryWith(greenRevalidation());
  const preview = await previewContractExecutionItemLinkPersistence(manifest, repository.value);
  equal(preview.ready, true);
  equal(preview.plannedInsertCount, 300);
  equal(repository.persistCalls(), 0);
  equal(preview.mutationScope.changesMeasurements, false);
  equal(preview.mutationScope.changesEconomics, false);
});

await run("blocks the future write atomically when authoritative data drift", async () => {
  const repository = repositoryWith({
    ...greenRevalidation(),
    ready: false,
    validPairCount: 299,
    sourceSnapshotsMatch: false,
    violations: ["At least one source item changed."],
  });
  let rejected = false;
  try {
    await persistApprovedContractExecutionItemLinks(
      "00000000-0000-4000-8000-000000000999",
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

function buildManifest(): ContractExecutionItemLinkManifest {
  const links: PreparedContractExecutionItemLink[] = [];
  for (let index = 0; index < 300; index += 1) {
    const remainder = index < 15;
    const cot = index === 0;
    links.push({
      sequence: index + 1,
      proposalLine: {
        id: uuid(index + 1),
        position: index,
        documentCode: cot ? "COT-015" : "DOC-" + index,
        structuralCode: "01.00." + index,
        description: "Item " + index,
        parentLineId: null,
        unit: cot ? "DIA" : "UN",
        quantityDecimal: cot ? "60" : "1",
        unitPriceCents: cot ? 294767 : 100,
        totalCents: cot ? 17686020 : 100,
        createdAtSnapshot: "2026-08-21T14:50:55.860541+00:00",
      },
      operationalItem: {
        id: uuid(index + 1001),
        code: "01.00." + index,
        description: "Item " + index,
        unit: cot ? "DIA" : "UN",
        contractQuantityDecimal: cot ? "60" : "1",
        unitPriceDecimal: cot ? "2947.67" : "1",
        extendedValueDecimal: cot ? "176860.20000000" : "1.00000000",
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
        documentaryPositionShiftPreserved: remainder && !cot,
        cot015ParentlessPreserved: cot,
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
    manifestId: "fixture",
    writeStatus: "NOT_APPLIED",
    scope: {
      organizationId: uuid(9001),
      engineeringProjectId: uuid(9002),
      contractBaselineId: uuid(9003),
      proposalBudgetVersionId: uuid(9004),
      procurementCaseId: uuid(9005),
      contractNumber: "22/2025",
      contractor: "Consórcio",
    },
    integrity: {
      validationSetIntegrityId: "7e362455f55af07f8378009c1dce1d5f",
      expectedLinkCount: 300,
      expectedDistinctProposalLineCount: 300,
      expectedDistinctOperationalItemCount: 300,
      structuralCodeAndExactMaterialFieldsCount: 285,
      uniqueExactDocumentaryRemainderCount: 15,
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
      contractedProposalValueCents: 761185165,
      operationalItemsGrossTotalDecimal: "7611852.11454550",
      contractualRoundingAdjustmentDecimal: "-0.46454550",
      subCentPrecisionItemCount: 88,
      mutationPlanned: false,
    },
    specialCases: {
      cot015: {
        proposalDocumentCode: "COT-015",
        quantityDecimal: "60",
        unit: "DIA",
        unitPriceCents: 294767,
        totalCents: 17686020,
        proposalParentMustRemainNull: true,
        operationalHierarchyMustRemainIndependent: true,
      },
      documentaryPositionShiftPairCount: 14,
    },
    links,
  };
}

function greenRevalidation(): ContractExecutionItemLinkRevalidation {
  return {
    ready: true,
    violations: [],
    currentIntegrityId: "7e362455f55af07f8378009c1dce1d5f",
    proposalItemCount: 300,
    operationalItemCount: 300,
    validPairCount: 300,
    distinctProposalLineCount: 300,
    distinctOperationalItemCount: 300,
    sourceSnapshotsMatch: true,
    baselineStillPointsToProposal: true,
    economicsUnchanged: true,
  };
}

function repositoryWith(revalidation: ContractExecutionItemLinkRevalidation) {
  let persisted = 0;
  const value: ContractExecutionItemTraceabilityRepository = {
    async revalidateManifest() {
      return revalidation;
    },
    async persistManifestAtomically() {
      persisted += 1;
      return { insertedCount: 300, integrityId: revalidation.currentIntegrityId };
    },
    async listByContractBaseline() {
      return [];
    },
  };
  return { value, persistCalls: () => persisted };
}

function uuid(value: number): string {
  return "00000000-0000-4000-8000-" + value.toString(16).padStart(12, "0");
}

async function run(name: string, test: () => Promise<void>): Promise<void> {
  await test();
  console.log("ok - " + name);
}

function equal<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error("expected " + String(expected) + ", got " + String(actual));
}

function assert(condition: boolean): void {
  if (!condition) throw new Error("assertion failed");
}
