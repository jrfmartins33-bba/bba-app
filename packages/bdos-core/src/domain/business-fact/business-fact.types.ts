export type BusinessFactId = string;

export type BusinessFactTenantId = string;

export type BusinessFactOrganizationId = string;

export type BusinessFactCapability = string;

export type BusinessFactSource = "event" | "capability" | "external";

export type BusinessFactSourceReference = string;

export type BusinessFactCategory =
  | "financial"
  | "operational"
  | "tax"
  | "people"
  | "customer"
  | "risk"
  | "compliance";

export type BusinessFactValue = string | number | boolean | null;

export type BusinessFactUnit =
  | "currency"
  | "percentage"
  | "number"
  | "count"
  | "days"
  | "date"
  | "text"
  | "none";

export type BusinessFactDateTime = string;

export type BusinessFactMetadata = Readonly<Record<string, unknown>>;
