export type BusinessFactId = string;

export type BusinessFactTenantId = string;

export type BusinessFactOrganizationId = string;

export type BusinessFactCapability = string;

export type BusinessFactSource =
  | "event"
  | "capability"
  | "external"
  | "alpha-engenharia.measurement"
  | "alpha-engenharia.invoice"
  | "alpha-engenharia.accounts-receivable"
  | "alpha-engenharia.cash-flow-signal"
  | "engineering-application.measurement-workspace"
  | "engineering-application.approval-workflow"
  | "engineering-application.bulletin-generator"
  | "engineering-application.export-engine"
  | "engineering-application.evidence-center";

export type BusinessFactSourceReference = string;

export type BusinessFactCategory =
  | "revenue"
  | "cash"
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
