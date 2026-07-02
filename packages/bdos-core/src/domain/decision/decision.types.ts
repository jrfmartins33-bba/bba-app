export type DecisionId = string;

export type DecisionTenantId = string;

export type DecisionOrganizationId = string;

export type DecisionEvidenceSource =
  | "event"
  | "kpi"
  | "document"
  | "api"
  | "user_input"
  | (string & {});

export type DecisionDateTime = string;

export type DecisionOwner = string;

export type DecisionMetadata = Readonly<Record<string, unknown>>;

export interface DecisionEvidence {
  readonly source: DecisionEvidenceSource;
  readonly sourceReference: string;
  readonly description: string;
  readonly metadata: DecisionMetadata;
}

export interface ExpectedBenefit {
  readonly description: string;
  readonly metadata: DecisionMetadata;
}

export enum DecisionStatus {
  Proposed = "proposed",
  InReview = "in_review",
  Approved = "approved",
  Rejected = "rejected",
  Resolved = "resolved",
  Cancelled = "cancelled",
}

export enum DecisionPriority {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum DecisionImpact {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum DecisionCategory {
  Strategic = "strategic",
  Operational = "operational",
  Financial = "financial",
  Compliance = "compliance",
  Risk = "risk",
}
