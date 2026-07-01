export type EventId = string;

export type TenantId = string;

export type OrganizationId = string;

export type WorkspaceId = string;

export type ISODateTimeString = string;

export type EventPayload = Readonly<Record<string, unknown>>;

export type EventMetadata = Readonly<Record<string, unknown>>;

export type EventSource =
  | "system"
  | "user"
  | "integration"
  | "automation"
  | "import"
  | "external";

export type EventCategory =
  | "business"
  | "operational"
  | "financial"
  | "compliance"
  | "risk"
  | "security"
  | "workflow";

export type EventSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type EventStatus =
  | "new"
  | "acknowledged"
  | "in_review"
  | "resolved"
  | "dismissed";

export type EvidenceType =
  | "document"
  | "record"
  | "message"
  | "file"
  | "link"
  | "metric"
  | "snapshot";

export interface Evidence {
  readonly id: string;
  readonly type: EvidenceType;
  readonly title: string;
  readonly description: string;
  readonly source: EventSource;
  readonly sourceReference: string;
  readonly occurredAt: ISODateTimeString;
  readonly metadata: EventMetadata;
}
