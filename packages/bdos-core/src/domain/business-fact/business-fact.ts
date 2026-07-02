import type {
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
} from "./business-fact.types";

export interface BusinessFact {
  readonly id: BusinessFactId;
  readonly tenantId: BusinessFactTenantId;
  readonly organizationId: BusinessFactOrganizationId;
  readonly capability: BusinessFactCapability;
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
