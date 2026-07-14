/**
 * Cenário sintético (Sprint 21.3B, mapa §17) — todos os valores, códigos e
 * descrições abaixo são **explicitamente fictícios**. Nada aqui reproduz o
 * caso real Lagoa do Arroz; serve apenas para exercitar o modelo de domínio
 * com múltiplos lotes, hierarquia completa e transições de rascunho para
 * consolidado. Nunca reutilize estes valores como se fossem dados reais.
 */
import { createLotScope, createProcurementCase, createProcurementLot, createWholeCaseScope } from "../procurement-case";
import type { ProcurementCase, ProcurementLot, ProcurementScope } from "../procurement-case";
import { addBudgetLine, consolidateBudgetVersion, createBudgetVersion } from "./budget-version";
import { reaisToCents } from "./budget-version-money";
import { BudgetLineKind, BudgetVersionOriginKind } from "./budget-version.types";
import type { BudgetVersion } from "./budget-version.types";

const SYNTHETIC_ORGANIZATION_ID = "organization-synthetic-001";

export interface SyntheticMultiLotScenario {
  readonly procurementCase: ProcurementCase;
  readonly lotA: ProcurementLot;
  readonly lotB: ProcurementLot;
  readonly wholeCaseScope: ProcurementScope;
  readonly lotAScope: ProcurementScope;
  readonly lotBScope: ProcurementScope;
  readonly draftBudgetVersion: BudgetVersion;
  readonly consolidatedBudgetVersion: BudgetVersion;
}

/**
 * Um Processo sintético com dois lotes (A e B), uma Versão do Orçamento
 * cujo Escopo é o processo inteiro, contendo: um Grupo global (aplicável ao
 * processo inteiro), um Grupo/Subgrupo/Item dentro do Lote A, um Item
 * diretamente sob Grupo (sem Subgrupo) no Lote B, e um Item sem código
 * externo (análogo ao papel estrutural de `COT-015`, mas com dados
 * inteiramente fictícios). Consolida a versão ao final.
 */
export function buildSyntheticMultiLotScenario(): SyntheticMultiLotScenario {
  const procurementCase = unwrap(
    createProcurementCase({
      id: "case-synthetic-multilot",
      organizationId: SYNTHETIC_ORGANIZATION_ID,
      title: "Processo Sintético — Cenário Multi-Lote",
      externalReference: "edital-sintetico-0001",
      correlationId: "synthetic-fixture-correlation",
      createdBy: "synthetic-fixture",
      sourceSystem: "bdos-core-tests",
    }),
    "procurementCase",
  ).procurementCase;

  const lotA = unwrap(
    createProcurementLot({
      id: "lot-synthetic-a",
      procurementCase,
      title: "Lote A — Sintético",
      correlationId: "synthetic-fixture-correlation",
      createdBy: "synthetic-fixture",
      sourceSystem: "bdos-core-tests",
    }),
    "lotA",
  ).procurementLot;

  const lotB = unwrap(
    createProcurementLot({
      id: "lot-synthetic-b",
      procurementCase,
      title: "Lote B — Sintético",
      correlationId: "synthetic-fixture-correlation",
      createdBy: "synthetic-fixture",
      sourceSystem: "bdos-core-tests",
    }),
    "lotB",
  ).procurementLot;

  const wholeCaseScope = unwrap(createWholeCaseScope({ procurementCase }), "wholeCaseScope").scope;
  const lotAScope = unwrap(createLotScope({ procurementCase, procurementLot: lotA }), "lotAScope").scope;
  const lotBScope = unwrap(createLotScope({ procurementCase, procurementLot: lotB }), "lotBScope").scope;

  let budgetVersion = unwrap(
    createBudgetVersion({
      id: "version-synthetic-multilot",
      organizationId: SYNTHETIC_ORGANIZATION_ID,
      procurementCaseId: procurementCase.id,
      scope: wholeCaseScope,
      origin: { kind: BudgetVersionOriginKind.Native },
      correlationId: "synthetic-fixture-correlation",
      createdBy: "synthetic-fixture",
      sourceSystem: "bdos-core-tests",
    }),
    "budgetVersion",
  ).budgetVersion;

  budgetVersion = unwrap(
    addBudgetLine({
      budgetVersion,
      id: "group-global",
      kind: BudgetLineKind.Group,
      description: "Grupo Sintético — Serviços Gerais (processo inteiro)",
      position: 0,
      scope: wholeCaseScope,
    }),
    "group-global",
  ).budgetVersion;

  budgetVersion = unwrap(
    addBudgetLine({
      budgetVersion,
      id: "group-lot-a",
      kind: BudgetLineKind.Group,
      description: "Grupo Sintético — Lote A",
      position: 1,
      scope: lotAScope,
    }),
    "group-lot-a",
  ).budgetVersion;

  budgetVersion = unwrap(
    addBudgetLine({
      budgetVersion,
      id: "subgroup-lot-a-1",
      kind: BudgetLineKind.Subgroup,
      description: "Subgrupo Sintético A.1",
      parentLineId: "group-lot-a",
      position: 0,
      scope: lotAScope,
    }),
    "subgroup-lot-a-1",
  ).budgetVersion;

  budgetVersion = unwrap(
    addBudgetLine({
      budgetVersion,
      id: "item-lot-a-1",
      kind: BudgetLineKind.ServiceItem,
      description: "Item Sintético A.1.1 — escavação fictícia",
      externalCode: "SINT-A.1.1",
      parentLineId: "subgroup-lot-a-1",
      position: 0,
      scope: lotAScope,
      totalCents: reaisToCents(15000),
    }),
    "item-lot-a-1",
  ).budgetVersion;

  budgetVersion = unwrap(
    addBudgetLine({
      budgetVersion,
      id: "group-lot-b",
      kind: BudgetLineKind.Group,
      description: "Grupo Sintético — Lote B",
      position: 2,
      scope: lotBScope,
    }),
    "group-lot-b",
  ).budgetVersion;

  budgetVersion = unwrap(
    addBudgetLine({
      budgetVersion,
      id: "item-lot-b-1",
      kind: BudgetLineKind.ServiceItem,
      description: "Item Sintético B.1 — direto sob Grupo, sem Subgrupo",
      externalCode: "SINT-B.1",
      parentLineId: "group-lot-b",
      position: 0,
      scope: lotBScope,
      totalCents: reaisToCents(8000),
    }),
    "item-lot-b-1",
  ).budgetVersion;

  budgetVersion = unwrap(
    addBudgetLine({
      budgetVersion,
      id: "item-lot-b-2-no-code",
      kind: BudgetLineKind.ServiceItem,
      description: "Item Sintético B.2 — sem código externo (papel estrutural análogo a COT-015, dado fictício)",
      externalCode: null,
      parentLineId: "group-lot-b",
      position: 1,
      scope: lotBScope,
      totalCents: reaisToCents(1234.56),
    }),
    "item-lot-b-2-no-code",
  ).budgetVersion;

  const consolidatedBudgetVersion = unwrap(consolidateBudgetVersion({ budgetVersion }), "consolidate").budgetVersion;

  return {
    procurementCase,
    lotA,
    lotB,
    wholeCaseScope,
    lotAScope,
    lotBScope,
    draftBudgetVersion: budgetVersion,
    consolidatedBudgetVersion,
  };
}

/**
 * Processo sintético sem nenhum lote — "processo inteiro" nunca recebe um
 * lote artificial; o Escopo do processo inteiro basta.
 */
export function buildSyntheticCaseWithoutLots(): { readonly procurementCase: ProcurementCase; readonly budgetVersion: BudgetVersion } {
  const procurementCase = unwrap(
    createProcurementCase({
      id: "case-synthetic-no-lot",
      organizationId: SYNTHETIC_ORGANIZATION_ID,
      title: "Processo Sintético — Sem Lote",
      correlationId: "synthetic-fixture-correlation",
      createdBy: "synthetic-fixture",
      sourceSystem: "bdos-core-tests",
    }),
    "procurementCase",
  ).procurementCase;

  const scope = unwrap(createWholeCaseScope({ procurementCase }), "scope").scope;

  const budgetVersion = unwrap(
    createBudgetVersion({
      id: "version-synthetic-no-lot",
      organizationId: SYNTHETIC_ORGANIZATION_ID,
      procurementCaseId: procurementCase.id,
      scope,
      origin: { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: "referencia-opaca-sintetica-001" },
      correlationId: "synthetic-fixture-correlation",
      createdBy: "synthetic-fixture",
      sourceSystem: "bdos-core-tests",
    }),
    "budgetVersion",
  ).budgetVersion;

  return { procurementCase, budgetVersion };
}

function unwrap<T extends { readonly success: boolean }>(result: T, label: string): Extract<T, { success: true }> {
  if (!result.success) {
    throw new Error(`buildSyntheticMultiLotScenario: unexpected failure building "${label}" — ${JSON.stringify((result as { errors?: unknown }).errors)}`);
  }
  return result as Extract<T, { success: true }>;
}
