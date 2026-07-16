export const BUDGET_DOCUMENT_SIGNAL_CATALOG_SCHEMA_VERSION = 1 as const;

export const BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION = "budget-document-signal-catalog-v1" as const;

export type BudgetDocumentSignalId = string;

/**
 * Documentary intent of a signal family — never an economic reading of
 * the page's content, only what kind of documentary evidence the family
 * represents. See EPIC_21_SPRINT_4A2A_DOCUMENT_LOCATION_SPIKE.md §20 for
 * the preliminary characterization this catalog formalizes.
 */
export enum BudgetDocumentSignalFamily {
  /** Mention, index entry, or cross-reference — never proof of structural presence. */
  Referential = "Referential",
  /** Composition compatible with budget line items (units, quantities, values). */
  Structural = "Structural",
  /** Indicates consecutive pages may belong to the same documentary block. */
  Continuity = "Continuity",
  /** Indicates possible closure of a block — never proof a budget preceded it. */
  Closure = "Closure",
  /** Observable condition of the page's extraction, not documentary content. */
  ExtractionCondition = "ExtractionCondition",
}

/**
 * A single definition in the signal catalog. Deliberately excludes any
 * numeric weight, score, confidence percentage, or probability — this
 * catalog describes what a signal means and how it is bounded, never how
 * much it should count for a decision. `sufficientAlone` is `false` for
 * every definition in this catalog by architectural rule (see the
 * catalog's own integrity test); the field exists so the rule is a
 * checked invariant instead of an implicit assumption.
 */
export interface BudgetDocumentSignalDefinition {
  readonly id: BudgetDocumentSignalId;
  readonly definitionVersion: number;
  readonly family: BudgetDocumentSignalFamily;
  readonly humanName: string;
  readonly description: string;
  readonly documentaryMeaning: string;
  readonly observableForms: ReadonlyArray<string>;
  readonly limitations: ReadonlyArray<string>;
  readonly permittedUses: ReadonlyArray<string>;
  readonly prohibitedUses: ReadonlyArray<string>;
  readonly sufficientAlone: boolean;
  readonly insufficiencyRationale: string | null;
  readonly relatedSignalIds: ReadonlyArray<BudgetDocumentSignalId>;
  readonly catalogVersion: typeof BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION;
}

export type BudgetDocumentSignalCatalog = ReadonlyArray<BudgetDocumentSignalDefinition>;

export type BudgetDocumentSignalCatalogIssueCode =
  | "duplicate_id"
  | "missing_human_name"
  | "missing_description"
  | "missing_documentary_meaning"
  | "empty_observable_forms"
  | "empty_limitations"
  | "empty_permitted_uses"
  | "empty_prohibited_uses"
  | "sufficient_alone_without_architectural_authorization"
  | "missing_insufficiency_rationale"
  | "unexpected_insufficiency_rationale"
  | "dangling_related_signal_id"
  | "catalog_version_mismatch";

export interface BudgetDocumentSignalCatalogIssue {
  readonly code: BudgetDocumentSignalCatalogIssueCode;
  readonly signalId: BudgetDocumentSignalId | null;
  readonly message: string;
}
