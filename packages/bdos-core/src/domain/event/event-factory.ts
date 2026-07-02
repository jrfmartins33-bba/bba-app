import type { Event } from "./event";
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
import type { EventValidationError } from "./event-validation";
import { validateEvent } from "./event-validation";

export interface EventInput {
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
  readonly detectedAt?: ISODateTimeString;
  readonly payload: EventPayload;
  readonly severity: EventSeverity;
  readonly relevanceScore: number;
  readonly status: EventStatus;
  readonly confidence: number;
  readonly evidence?: ReadonlyArray<Evidence>;
  readonly metadata?: EventMetadata;
  readonly createdAt?: ISODateTimeString;
  readonly updatedAt?: ISODateTimeString;
}

export interface CreateEventSuccess {
  readonly success: true;
  readonly event: Event;
}

export interface CreateEventFailure {
  readonly success: false;
  readonly errors: EventValidationError[];
}

export type CreateEventResult = CreateEventSuccess | CreateEventFailure;

export function createEvent(input: EventInput): CreateEventResult {
  const validation = validateEvent(input);

  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  const timestamp = new Date().toISOString();
  const event: Event = {
    ...input,
    detectedAt: input.detectedAt ?? timestamp,
    evidence: input.evidence ?? [],
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };

  return {
    success: true,
    event,
  };
}
