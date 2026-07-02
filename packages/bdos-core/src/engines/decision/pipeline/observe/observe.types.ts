import type {
  BusinessFact,
  BusinessFactCapability,
  BusinessFactCategory,
  BusinessFactDateTime,
  BusinessFactId,
  BusinessFactMetadata,
  BusinessFactOrganizationId,
  BusinessFactSource,
  BusinessFactSourceReference,
  BusinessFactTenantId,
  BusinessFactUnit,
  BusinessFactValue,
} from "../../../../domain/business-fact";

export interface CapabilityFact {
  readonly id: BusinessFactId;
  readonly source: BusinessFactSource;
  readonly sourceReference: BusinessFactSourceReference;
  readonly category: BusinessFactCategory;
  readonly type: string;
  readonly label: string;
  readonly description: string;
  readonly value: BusinessFactValue;
  readonly unit: BusinessFactUnit;
  readonly confidence: number;
  readonly observedAt: BusinessFactDateTime;
  readonly metadata: BusinessFactMetadata;
  readonly createdAt: BusinessFactDateTime;
}

export interface CapabilityContext {
  readonly tenantId: BusinessFactTenantId;
  readonly organizationId: BusinessFactOrganizationId;
  readonly capability: BusinessFactCapability;
  readonly facts: ReadonlyArray<CapabilityFact>;
}

export type ObserveResult = ReadonlyArray<BusinessFact>;
