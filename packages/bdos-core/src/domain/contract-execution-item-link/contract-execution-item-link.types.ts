export enum ContractExecutionItemMatchMethod {
  StructuralCodeAndExactMaterialFields = "StructuralCodeAndExactMaterialFields",
  UniqueExactDocumentaryRemainder = "UniqueExactDocumentaryRemainder",
}

export interface ContractExecutionItemLinkEvidence {
  readonly structuralCodeExact: boolean;
  readonly descriptionExact: boolean;
  readonly unitExact: boolean;
  readonly quantityExact: boolean;
  readonly unitPriceExact: boolean;
  readonly candidateUniqueInApplicableSet: boolean;
  readonly externalCodesAreEvidenceOnly: true;
  readonly documentaryPositionShiftPreserved: boolean;
  readonly cot015ParentlessPreserved: boolean;
}

export interface PreparedContractExecutionItemLink {
  readonly sequence: number;
  readonly proposalLine: {
    readonly id: string;
    readonly position: number;
    readonly documentCode: string | null;
    readonly structuralCode: string | null;
    readonly description: string;
    readonly parentLineId: string | null;
    readonly unit: string;
    readonly quantityDecimal: string;
    readonly unitPriceCents: number;
    readonly totalCents: number;
    readonly createdAtSnapshot: string;
  };
  readonly operationalItem: {
    readonly id: string;
    readonly code: string;
    readonly description: string;
    readonly unit: string;
    readonly contractQuantityDecimal: string;
    readonly unitPriceDecimal: string;
    readonly extendedValueDecimal: string;
    readonly workPackageId: string;
    readonly updatedAtSnapshot: string;
  };
  readonly matchMethod: ContractExecutionItemMatchMethod;
  readonly evidence: ContractExecutionItemLinkEvidence;
  readonly validation: {
    readonly status: "Validated";
    readonly materialDivergence: false;
    readonly ambiguous: false;
    readonly proposalIdentityUsesInternalId: true;
    readonly operationalIdentityUsesInternalId: true;
  };
}

export interface ContractExecutionItemLinkManifest {
  readonly schemaVersion: "1.0.0";
  readonly manifestId: string;
  readonly writeStatus: "NOT_APPLIED";
  readonly scope: {
    readonly organizationId: string;
    readonly engineeringProjectId: string;
    readonly contractBaselineId: string;
    readonly proposalBudgetVersionId: string;
    readonly procurementCaseId: string;
    readonly contractNumber: string;
    readonly contractor: string;
  };
  readonly integrity: {
    readonly validationSetIntegrityId: string;
    readonly expectedLinkCount: number;
    readonly expectedDistinctProposalLineCount: number;
    readonly expectedDistinctOperationalItemCount: number;
    readonly structuralCodeAndExactMaterialFieldsCount: number;
    readonly uniqueExactDocumentaryRemainderCount: number;
    readonly ambiguousCount: number;
    readonly unmatchedCount: number;
    readonly materialDivergenceCount: number;
  };
  readonly sourceSnapshots: {
    readonly contractBaselineUpdatedAt: string;
    readonly proposalBudgetVersionUpdatedAt: string;
    readonly proposalLinesCreatedAt: string;
    readonly operationalItemsUpdatedAt: string;
  };
  readonly economics: {
    readonly contractedProposalValueCents: number;
    readonly operationalItemsGrossTotalDecimal: string;
    readonly contractualRoundingAdjustmentDecimal: string;
    readonly subCentPrecisionItemCount: number;
    readonly mutationPlanned: false;
  };
  readonly specialCases: {
    readonly cot015: {
      readonly proposalDocumentCode: "COT-015";
      readonly quantityDecimal: "60";
      readonly unit: "DIA";
      readonly unitPriceCents: 294767;
      readonly totalCents: 17686020;
      readonly proposalParentMustRemainNull: true;
      readonly operationalHierarchyMustRemainIndependent: true;
    };
    readonly documentaryPositionShiftPairCount: 14;
  };
  readonly links: ReadonlyArray<PreparedContractExecutionItemLink>;
}

export interface ManifestValidationResult {
  readonly valid: boolean;
  readonly violations: ReadonlyArray<string>;
  readonly linkCount: number;
  readonly distinctProposalLineCount: number;
  readonly distinctOperationalItemCount: number;
}
