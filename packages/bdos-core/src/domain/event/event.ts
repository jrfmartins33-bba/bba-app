import type {
  EventCategory,
  EventId,
  EventMetadata,
  EventPayload,
  EventSeverity,
  EventSource,
  EventStatus,
  Evidence,
  ISODateTimeString,
  OrganizationId,
  TenantId,
  WorkspaceId,
} from "./event.types";

export interface Event {
  readonly id: EventId;
  readonly tenantId: TenantId;
  readonly organizationId: OrganizationId;
  readonly workspaceId: WorkspaceId;
  readonly source: EventSource;
  readonly sourceReference: string;
  readonly category: EventCategory;
  readonly type: string;
  readonly title: string;
  readonly description: string;
  readonly occurredAt: ISODateTimeString;
  readonly detectedAt: ISODateTimeString;
  readonly payload: EventPayload;
  readonly severity: EventSeverity;
  readonly relevanceScore: number;
  readonly status: EventStatus;
  readonly confidence: number;
  readonly evidence: ReadonlyArray<Evidence>;
  readonly metadata: EventMetadata;
  readonly createdAt: ISODateTimeString;
  readonly updatedAt: ISODateTimeString;
}
