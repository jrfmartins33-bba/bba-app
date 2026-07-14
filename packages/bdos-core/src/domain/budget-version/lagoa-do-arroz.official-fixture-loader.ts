/**
 * Carrega a fixture real (`lagoa-do-arroz.official-fixture.ts`) no modelo
 * de domínio puro desta Sprint. A planilha não declara lotes de forma
 * inequívoca (nenhuma coluna de lote na aba "ORÇAMENTO") — por isso, esta
 * fixture usa exclusivamente o Escopo do processo inteiro, sem criar
 * nenhum lote. A confirmação sobre a existência ou ausência de lotes reais
 * permanece pendência documental (mapa §O).
 *
 * Identidade interna nunca é derivada do código externo: cada linha recebe
 * `lagoa-line-{sourceRowNumber}` — a posição na fonte, não o código de
 * negócio (`externalSourceCode`), que é preservado em campo próprio.
 */
import { createProcurementCase, createWholeCaseScope } from "../procurement-case";
import type { ProcurementCase, ProcurementScope } from "../procurement-case";
import { addBudgetLine, consolidateBudgetVersion, createBudgetVersion } from "./budget-version";
import { reaisToCents } from "./budget-version-money";
import { BudgetLineKind, BudgetVersionOriginKind } from "./budget-version.types";
import type { BudgetVersion } from "./budget-version.types";
import { LAGOA_DO_ARROZ_OFFICIAL_LINES, LAGOA_DO_ARROZ_SOURCE_PROVENANCE } from "./lagoa-do-arroz.official-fixture";
import type { LagoaDoArrozOfficialLine } from "./lagoa-do-arroz.official-fixture";

const ORGANIZATION_ID = "organization-lagoa-do-arroz-official";

export interface LagoaDoArrozOfficialScenario {
  readonly procurementCase: ProcurementCase;
  readonly scope: ProcurementScope;
  readonly consolidatedBudgetVersion: BudgetVersion;
  readonly lineIdByHierarchicalCode: ReadonlyMap<string, string>;
}

function internalLineId(line: LagoaDoArrozOfficialLine): string {
  return `lagoa-line-${line.sourceRowNumber}`;
}

function kindFor(line: LagoaDoArrozOfficialLine): BudgetLineKind {
  if (line.classification === "Grupo") return BudgetLineKind.Group;
  if (line.classification === "Subgrupo") return BudgetLineKind.Subgroup;
  return BudgetLineKind.ServiceItem;
}

export function buildLagoaDoArrozOfficialScenario(): LagoaDoArrozOfficialScenario {
  const procurementCaseResult = createProcurementCase({
    id: "case-lagoa-do-arroz-dnocs-90006-2025",
    organizationId: ORGANIZATION_ID,
    title: "Recuperação e Modernização da Barragem Lagoa do Arroz — DNOCS Pregão Eletrônico 90006/2025",
    externalReference: "pregao-eletronico-90006-2025",
    correlationId: "lagoa-do-arroz-official-fixture",
    createdBy: "lagoa-do-arroz-official-fixture-loader",
    sourceSystem: "bdos-core-tests",
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
    organizationId: ORGANIZATION_ID,
    procurementCaseId: procurementCase.id,
    scope,
    origin: {
      kind: BudgetVersionOriginKind.DocumentaryOpaqueReference,
      reference: LAGOA_DO_ARROZ_SOURCE_PROVENANCE.sourceFileName,
    },
    correlationId: "lagoa-do-arroz-official-fixture",
    createdBy: "lagoa-do-arroz-official-fixture-loader",
    sourceSystem: "bdos-core-tests",
  });
  if (!versionResult.success) {
    throw new Error(`buildLagoaDoArrozOfficialScenario: failed to create BudgetVersion — ${JSON.stringify(versionResult.errors)}`);
  }
  let budgetVersion = versionResult.budgetVersion;

  const lineIdByHierarchicalCode = new Map<string, string>();
  const positionByParent = new Map<string | null, number>();

  LAGOA_DO_ARROZ_OFFICIAL_LINES.forEach((line) => {
    const id = internalLineId(line);
    const parentLineId =
      line.parentHierarchicalCode === null ? null : (lineIdByHierarchicalCode.get(line.parentHierarchicalCode) ?? null);

    if (line.parentHierarchicalCode !== null && parentLineId === null) {
      throw new Error(
        `buildLagoaDoArrozOfficialScenario: parent "${line.parentHierarchicalCode}" not yet loaded for row ${line.sourceRowNumber}.`,
      );
    }

    const position = positionByParent.get(parentLineId) ?? 0;
    positionByParent.set(parentLineId, position + 1);

    // Limitação real da fonte: 8 linhas (todas do tipo "Cotação") têm a
    // célula de descrição vazia na própria planilha oficial. Nenhum texto é
    // inventado — usa-se um rótulo neutro que declara a ausência, com a
    // lacuna também registrada explicitamente em metadata.
    const descriptionAbsentFromSource = line.descricao.trim().length === 0;
    const description = descriptionAbsentFromSource ? "(descrição não informada na fonte oficial)" : line.descricao;

    const result = addBudgetLine({
      budgetVersion,
      id,
      kind: kindFor(line),
      description,
      externalCode: line.externalSourceCode,
      parentLineId,
      position,
      scope,
      totalCents: line.classification === "ServiceItem" ? reaisToCents(line.totalComBdiReais ?? 0) : null,
      metadata: {
        sourceRowNumber: line.sourceRowNumber,
        fonte: line.fonte,
        tipo: line.tipo,
        unidade: line.unidade,
        quantidade: line.quantidade,
        custoUnitarioSemBdiReais: line.custoUnitarioSemBdiReais,
        bdiPercent: line.bdiPercent,
        precoUnitarioComBdiReais: line.precoUnitarioComBdiReais,
        totalDeclaradoNaFonteReais: line.totalComBdiReais,
        descricaoAusenteNaFonte: descriptionAbsentFromSource,
      },
    });

    if (!result.success) {
      throw new Error(
        `buildLagoaDoArrozOfficialScenario: failed to add line for row ${line.sourceRowNumber} (${line.hierarchicalCode ?? "sem código"}) — ${JSON.stringify(result.errors)}`,
      );
    }

    budgetVersion = result.budgetVersion;

    if (line.hierarchicalCode !== null) {
      lineIdByHierarchicalCode.set(line.hierarchicalCode, id);
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
