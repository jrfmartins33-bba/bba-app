// Única porta estreita para os Serviços de Aplicação de Engenharia de
// Custos e Licitações (Epic 21, Sprint 21.3C) — um consumidor (adaptador de
// persistência em apps/web, ou um futuro Route Handler) importa deste
// subpath, nunca de domain/procurement-case ou domain/budget-version
// diretamente. Mesma disciplina de "uma porta estreita" já usada por
// services/execution-management e services/bba-project-import.

export * from "./application-context";
export * from "./procurement-case.repository";
export * from "./budget-version.repository";
export * from "./procurement-case-service.types";
export * from "./procurement-case-service";
export * from "./budget-version-service.types";
export * from "./budget-version-service";

// Reexporta exatamente as identidades, enums e tipos de domínio que um
// adaptador de persistência (apps/web/lib/bdos/procurement-engineering-*)
// precisa para construir comandos e reconstruir os retratos de domínio a
// partir de linhas de banco — nunca a superfície inteira de
// domain/procurement-case ou domain/budget-version, e nunca as funções de
// domínio em si (createBudgetVersion, addBudgetLine etc. só são chamadas
// pelos Serviços de Aplicação acima, nunca diretamente por um adaptador).
export { ProcurementScopeKind } from "../../domain/procurement-case";
export type {
  ProcurementCase,
  ProcurementCaseId,
  ProcurementLot,
  ProcurementLotId,
  ProcurementOrganizationId,
  ProcurementScope,
} from "../../domain/procurement-case";

export { BudgetLineKind, BudgetVersionOriginKind, BudgetVersionStatus, LineageRelationNature } from "../../domain/budget-version";
export type {
  BudgetLine,
  BudgetLineDescription,
  BudgetLineId,
  BudgetOrganizationId,
  BudgetVersion,
  BudgetVersionId,
  BudgetVersionMetadata,
  BudgetVersionOrigin,
  LineageRelation,
} from "../../domain/budget-version";
export type { MoneyCents } from "../../domain/budget-version/budget-version-money";
export { isValidMoneyCents } from "../../domain/budget-version/budget-version-money";
