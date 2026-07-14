/**
 * Carrega a fixture real (`lagoa-do-arroz.official-fixture.ts`) no modelo
 * de domínio puro desta Sprint. A planilha não declara lotes de forma
 * inequívoca (nenhuma coluna de lote na aba "ORÇAMENTO") — por isso, esta
 * fixture usa exclusivamente o Escopo do processo inteiro, sem criar
 * nenhum lote. A confirmação sobre a existência ou ausência de lotes reais
 * permanece pendência documental (mapa §O).
 *
 * Identidade e posição nunca são recomputadas aqui: `fixtureLineId` e
 * `documentaryPosition` já vêm fixos na própria fixture, atribuídos uma
 * única vez na extração — este carregador apenas os usa diretamente,
 * independentemente da ordem em que `lines` for percorrida ou reorganizada.
 */
import { createProcurementCase, createWholeCaseScope } from "../procurement-case";
import type { ProcurementCase, ProcurementScope } from "../procurement-case";
import { addBudgetLine, consolidateBudgetVersion, createBudgetVersion } from "./budget-version";
import { centsFromDecimalString } from "./budget-version-money";
import { BudgetLineKind, BudgetVersionOriginKind } from "./budget-version.types";
import type { BudgetLineDescription, BudgetVersion } from "./budget-version.types";
import { LAGOA_DO_ARROZ_OFFICIAL_LINES, LAGOA_DO_ARROZ_SOURCE_PROVENANCE } from "./lagoa-do-arroz.official-fixture";
import type { LagoaDoArrozOfficialLine } from "./lagoa-do-arroz.official-fixture";

const ORGANIZATION_ID = "organization-lagoa-do-arroz-official";

export type SiblingInsertionOrder = "Documentary" | "ReversedWithinSiblings";

export interface LagoaDoArrozOfficialScenario {
  readonly procurementCase: ProcurementCase;
  readonly scope: ProcurementScope;
  readonly consolidatedBudgetVersion: BudgetVersion;
  readonly lineIdByHierarchicalCode: ReadonlyMap<string, string>;
}

function kindFor(line: LagoaDoArrozOfficialLine): BudgetLineKind {
  if (line.classification === "Grupo") return BudgetLineKind.Group;
  if (line.classification === "Subgrupo") return BudgetLineKind.Subgroup;
  return BudgetLineKind.ServiceItem;
}

/**
 * Nenhum texto de apresentação é produzido aqui — mapeia diretamente para a
 * união discriminada do domínio (`BudgetLineDescription`), preservando o
 * estado real (confirmada ou ausente na fonte) sem produzir rótulo algum.
 */
function toDomainDescription(descricao: LagoaDoArrozOfficialLine["descricao"]): BudgetLineDescription {
  return descricao.status === "ConfirmedFromSource" ? { status: "Confirmed", text: descricao.text } : { status: "AbsentFromSource" };
}

/**
 * Ordena as linhas para carga em três passagens topológicas por
 * classificação (Grupo, depois Subgrupo, depois Item de Serviço) — nunca
 * confia na ordem do array de entrada estar topologicamente válida (um
 * `lines` reorganizado externamente, ex.: para o teste de identidade
 * opaca, pode não estar). Dentro de cada passagem, "Documentary" preserva
 * a ordem relativa original de `lines`; "ReversedWithinSiblings" inverte a
 * ordem apenas entre irmãos (mesmo pai), variando genuinamente a ordem de
 * inserção sem jamais inserir um filho antes do seu pai. A posição final
 * de cada linha nunca depende desta ordem — vem fixa em
 * `line.documentaryPosition`.
 */
function orderLinesForLoading(
  lines: ReadonlyArray<LagoaDoArrozOfficialLine>,
  strategy: SiblingInsertionOrder,
): ReadonlyArray<LagoaDoArrozOfficialLine> {
  const grupos = lines.filter((l) => l.classification === "Grupo");
  const subgrupos = lines.filter((l) => l.classification === "Subgrupo");
  const itens = lines.filter((l) => l.classification === "ServiceItem");

  if (strategy === "Documentary") {
    return [...grupos, ...subgrupos, ...itens];
  }

  return [
    ...reverseWithinSiblingGroups(grupos, () => null),
    ...reverseWithinSiblingGroups(subgrupos, (l) => l.parentHierarchicalCode),
    ...reverseWithinSiblingGroups(itens, (l) => l.parentHierarchicalCode),
  ];
}

function reverseWithinSiblingGroups<T>(items: ReadonlyArray<T>, keyOf: (item: T) => string | null): ReadonlyArray<T> {
  const order: Array<string | null> = [];
  const bySiblingGroup = new Map<string | null, T[]>();

  items.forEach((item) => {
    const key = keyOf(item);
    if (!bySiblingGroup.has(key)) {
      bySiblingGroup.set(key, []);
      order.push(key);
    }
    bySiblingGroup.get(key)!.push(item);
  });

  return order.flatMap((key) => [...bySiblingGroup.get(key)!].reverse());
}

export function buildLagoaDoArrozOfficialScenario(
  options: {
    readonly siblingInsertionOrder?: SiblingInsertionOrder;
    readonly lines?: ReadonlyArray<LagoaDoArrozOfficialLine>;
  } = {},
): LagoaDoArrozOfficialScenario {
  const siblingInsertionOrder = options.siblingInsertionOrder ?? "Documentary";
  const sourceLines = options.lines ?? LAGOA_DO_ARROZ_OFFICIAL_LINES;

  const procurementCaseResult = createProcurementCase({
    id: "case-lagoa-do-arroz-dnocs-90006-2025",
    organizationId: ORGANIZATION_ID,
    title: "Recuperação e Modernização da Barragem Lagoa do Arroz — DNOCS Pregão Eletrônico 90006/2025",
    externalReference: "pregao-eletronico-90006-2025",
  });
  if (!procurementCaseResult.success) {
    throw new Error(`buildLagoaDoArrozOfficialScenario: failed to create ProcurementCase — ${JSON.stringify(procurementCaseResult.errors)}`);
  }
  const procurementCase = procurementCaseResult.procurementCase;

  const scopeResult = createWholeCaseScope({ procurementCase });
  if (!scopeResult.success) {
    throw new Error(`buildLagoaDoArrozOfficialScenario: failed to create scope — ${JSON.stringify(scopeResult.errors)}`);
  }
  const scope = scopeResult.scope;

  const versionResult = createBudgetVersion({
    id: "version-lagoa-do-arroz-official",
    procurementCase,
    scope,
    origin: {
      kind: BudgetVersionOriginKind.DocumentaryOpaqueReference,
      reference: LAGOA_DO_ARROZ_SOURCE_PROVENANCE.sourceFileName,
    },
    originLineageId: "lineage-lagoa-do-arroz-official",
  });
  if (!versionResult.success) {
    throw new Error(`buildLagoaDoArrozOfficialScenario: failed to create BudgetVersion — ${JSON.stringify(versionResult.errors)}`);
  }
  let budgetVersion = versionResult.budgetVersion;

  const lineIdByHierarchicalCode = new Map<string, string>();
  const loadOrder = orderLinesForLoading(sourceLines, siblingInsertionOrder);

  loadOrder.forEach((line) => {
    const parentLineId =
      line.parentHierarchicalCode === null ? null : (lineIdByHierarchicalCode.get(line.parentHierarchicalCode) ?? null);

    if (line.parentHierarchicalCode !== null && parentLineId === null) {
      throw new Error(
        `buildLagoaDoArrozOfficialScenario: parent "${line.parentHierarchicalCode}" not yet loaded for row ${line.sourceRowNumber}.`,
      );
    }

    const result = addBudgetLine({
      budgetVersion,
      id: line.fixtureLineId,
      kind: kindFor(line),
      description: toDomainDescription(line.descricao),
      externalCode: line.externalSourceCode,
      parentLineId,
      position: line.documentaryPosition,
      scope,
      totalCents:
        line.classification === "ServiceItem" && line.totalComBdiReais !== null
          ? centsFromDecimalString(line.totalComBdiReais)
          : null,
      metadata: {
        sourceRowNumber: line.sourceRowNumber,
        parentResolutionMethod: line.parentResolutionMethod,
        fonte: line.fonte,
        tipo: line.tipo,
        unidade: line.unidade,
        quantidade: line.quantidade,
        custoUnitarioSemBdiReais: line.custoUnitarioSemBdiReais,
        bdiPercent: line.bdiPercent,
        precoUnitarioComBdiReais: line.precoUnitarioComBdiReais,
        totalDeclaradoNaFonteDecimal: line.totalComBdiReais,
      },
    });

    if (!result.success) {
      throw new Error(
        `buildLagoaDoArrozOfficialScenario: failed to add line for row ${line.sourceRowNumber} (${line.hierarchicalCode ?? "sem código"}) — ${JSON.stringify(result.errors)}`,
      );
    }

    budgetVersion = result.budgetVersion;

    if (line.hierarchicalCode !== null) {
      lineIdByHierarchicalCode.set(line.hierarchicalCode, line.fixtureLineId);
    }
  });

  const consolidatedResult = consolidateBudgetVersion({ budgetVersion });
  if (!consolidatedResult.success) {
    throw new Error(`buildLagoaDoArrozOfficialScenario: failed to consolidate — ${JSON.stringify(consolidatedResult.errors)}`);
  }

  return {
    procurementCase,
    scope,
    consolidatedBudgetVersion: consolidatedResult.budgetVersion,
    lineIdByHierarchicalCode,
  };
}
