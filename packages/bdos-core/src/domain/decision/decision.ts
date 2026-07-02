import type {
  DecisionDateTime,
  DecisionEvidence,
  DecisionId,
  DecisionMetadata,
  DecisionOrganizationId,
  DecisionOwner,
  DecisionTenantId,
  ExpectedBenefit,
} from "./decision.types";
import {
  DecisionCategory,
  DecisionImpact,
  DecisionPriority,
  DecisionStatus,
} from "./decision.types";

export interface Decision {
  readonly id: DecisionId;
  readonly tenantId: DecisionTenantId;
  readonly organizationId: DecisionOrganizationId;
  readonly evidence: ReadonlyArray<DecisionEvidence>;
  readonly title: string;
  readonly summary: string;
  readonly status: DecisionStatus;
  readonly priority: DecisionPriority;
  readonly category: DecisionCategory;
  readonly impact: DecisionImpact;
  readonly confidence: number;
  readonly owner: DecisionOwner;
  readonly dueDate: DecisionDateTime | null;
  readonly expectedBenefit: ExpectedBenefit;
  readonly createdAt: DecisionDateTime;
  readonly updatedAt: DecisionDateTime;
  readonly resolvedAt: DecisionDateTime | null;
  readonly metadata: DecisionMetadata;
}
