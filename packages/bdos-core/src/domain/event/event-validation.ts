import type { Event } from "./event";

type RequiredEventField =
  | "tenantId"
  | "organizationId"
  | "source"
  | "category"
  | "type"
  | "title"
  | "occurredAt"
  | "payload";

export type EventValidationInput =
  | Readonly<Partial<Pick<Event, RequiredEventField>>>
  | null
  | undefined;

export interface EventValidationError {
  field: string;
  message: string;
}

export interface EventValidationResult {
  valid: boolean;
  errors: EventValidationError[];
}

const requiredEventFields: ReadonlyArray<RequiredEventField> = [
  "tenantId",
  "organizationId",
  "source",
  "category",
  "type",
  "title",
  "occurredAt",
  "payload",
];

export function validateEvent(
  input: EventValidationInput,
): EventValidationResult {
  const errors = requiredEventFields.reduce<EventValidationError[]>(
    (validationErrors, field) => {
      const value = input?.[field];

      if (value === undefined || value === null) {
        validationErrors.push({
          field,
          message: `${field} is required`,
        });
      }

      return validationErrors;
    },
    [],
  );

  return {
    valid: errors.length === 0,
    errors,
  };
}
