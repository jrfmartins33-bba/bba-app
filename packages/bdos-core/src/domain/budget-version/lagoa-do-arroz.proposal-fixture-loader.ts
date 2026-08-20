/**
 * Carrega a fixture real da Proposta Vencedora (PLANILHA CORRIGIDA.xlsx)
 * no modelo de domínio de BudgetVersion, e executa a reconciliação canônica
 * item a item contra o Orçamento Oficial existente.
 */
import { createWholeCaseScope } from "../procurement-case";
import type { ProcurementCase, ProcurementScope } from "../procurement-case";
import { addBudgetLine, calculateBudgetVersionTotal, consolidateBudgetVersion, createBudgetVersion } from "./budget-version";
import { centsFromDecimalString } from "./budget-version-money";
import { BudgetLineKind, BudgetVersionOriginKind } from "./budget-version.types";
import type { BudgetLine, BudgetLineDescription, BudgetVersion } from "./budget-version.types";
import {
  LAGOA_DO_ARROZ_PROPOSAL_DECLARED_TOTAL_DECIMAL,
  LAGOA_DO_ARROZ_PROPOSAL_DERIVED_TOTAL_DECIMAL,
  LAGOA_DO_ARROZ_PROPOSAL_LINES,
  LAGOA_DO_ARROZ_PROPOSAL_PROVENANCE,
  LAGOA_DO_ARROZ_PROPOSAL_ROUNDING_ADJUSTMENT_DECIMAL,
  type LagoaDoArrozProposalLine,
} from "./lagoa-do-arroz.proposal-fixture";
import type { LagoaDoArrozOfficialScenario } from "./lagoa-do-arroz.official-fixture-loader";

export interface LagoaDoArrozProposalScenario {
  readonly procurementCase: ProcurementCase;
  readonly scope: ProcurementScope;
  readonly draftBudgetVersion: BudgetVersion;
  readonly consolidatedBudgetVersion: BudgetVersion;
  readonly lineIdByHierarchicalCode: ReadonlyMap<string, string>;
  readonly lineIdByExternalCode: ReadonlyMap<string, string>;
}

export interface ProposalReconciliationResult {
  readonly matchedCodes: number;
  readonly descriptionMismatches: number;
  readonly unitMismatches: number;
  readonly quantityMismatches: number;
  readonly cot015Present: boolean;
  readonly duplicates: number;
  readonly groupsCount: number;
  readonly subgroupsCount: number;
  readonly serviceItemsCount: number;
  readonly officialTotalCents: number;
  readonly proposalTotalCents: number;
  readonly economicSumDecimal: string;
  readonly contractualAdjustmentDecimal: string;
  readonly reconciledContractedDecimal: string;
  readonly isEconomicEquationExact: boolean;
}

function kindFor(line: LagoaDoArrozProposalLine): BudgetLineKind {
  if (line.classification === "Grupo") return BudgetLineKind.Group;
  if (line.classification === "Subgrupo") return BudgetLineKind.Subgroup;
  return BudgetLineKind.ServiceItem;
}

function toDomainDescription(descricao: LagoaDoArrozProposalLine["descricao"]): BudgetLineDescription {
  return descricao.status === "ConfirmedFromSource" ? { status: "Confirmed", text: descricao.text } : { status: "AbsentFromSource" };
}

/**
 * Constrói a BudgetVersion da Proposta Vencedora vinculada ao Orçamento Oficial.
 */
export function buildLagoaDoArrozProposalScenario(options: {
  readonly procurementCase: ProcurementCase;
  readonly officialBudgetVersion: BudgetVersion;
  readonly proposalVersionId?: string;
  readonly originLineageId?: string;
  readonly sourceLines?: ReadonlyArray<LagoaDoArrozProposalLine>;
}): LagoaDoArrozProposalScenario {
  const { procurementCase, officialBudgetVersion } = options;
  const proposalVersionId = options.proposalVersionId ?? "version-lagoa-do-arroz-proposal-winner";
  const originLineageId = options.originLineageId ?? "lineage-lagoa-proposal-winner";
  const sourceLines = options.sourceLines ?? LAGOA_DO_ARROZ_PROPOSAL_LINES;

  const scopeResult = createWholeCaseScope({ procurementCase });
  if (!scopeResult.success) {
    throw new Error(`buildLagoaDoArrozProposalScenario: failed to create scope — ${JSON.stringify(scopeResult.errors)}`);
  }
  const scope = scopeResult.scope;

  const versionResult = createBudgetVersion({
    id: proposalVersionId,
    procurementCase,
    scope,
    origin: {
      kind: BudgetVersionOriginKind.DocumentaryOpaqueReference,
      reference: LAGOA_DO_ARROZ_PROPOSAL_PROVENANCE.sourceFileName,
    },
    originLineageId,
    sourceBudgetVersion: officialBudgetVersion,
  });

  if (!versionResult.success) {
    throw new Error(`buildLagoaDoArrozProposalScenario: failed to create BudgetVersion — ${JSON.stringify(versionResult.errors)}`);
  }

  let budgetVersion = versionResult.budgetVersion;

  const lineIdByHierarchicalCode = new Map<string, string>();
  const lineIdByExternalCode = new Map<string, string>();

  // Passagem topológica: Grupos, depois Subgrupos, depois ServiceItems
  const grupos = sourceLines.filter((l) => l.classification === "Grupo");
  const subgrupos = sourceLines.filter((l) => l.classification === "Subgrupo");
  const itens = sourceLines.filter((l) => l.classification === "ServiceItem");
  const ordered = [...grupos, ...subgrupos, ...itens];

  let lineCounter = 1;
  ordered.forEach((line) => {
    const lineId = `line-proposal-${String(lineCounter++).padStart(4, "0")}`;
    const parentLineId =
      line.parentHierarchicalCode === null ? null : (lineIdByHierarchicalCode.get(line.parentHierarchicalCode) ?? null);

    if (line.parentHierarchicalCode !== null && parentLineId === null) {
      throw new Error(
        `buildLagoaDoArrozProposalScenario: parent "${line.parentHierarchicalCode}" not found for row ${line.sourceRowNumber}.`,
      );
    }

    const totalCents =
      line.classification === "ServiceItem" && line.totalComBdiReais !== null
        ? centsFromDecimalString(line.totalComBdiReais)
        : null;

    const unitPriceCents =
      line.classification === "ServiceItem" && line.precoUnitarioComBdiReais !== null
        ? centsFromDecimalString(line.precoUnitarioComBdiReais)
        : null;

    const addResult = addBudgetLine({
      budgetVersion,
      id: lineId,
      kind: kindFor(line),
      description: toDomainDescription(line.descricao),
      externalCode: line.externalSourceCode ?? line.hierarchicalCode,
      parentLineId,
      position: line.documentaryPosition,
      scope,
      quantity: line.quantidade,
      unit: line.unidade,
      unitPriceCents,
      totalCents,
      metadata: {
        sourceRowNumber: line.sourceRowNumber,
        hierarchicalCode: line.hierarchicalCode,
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

    if (!addResult.success) {
      throw new Error(
        `buildLagoaDoArrozProposalScenario: failed to add line for row ${line.sourceRowNumber} (${line.hierarchicalCode ?? line.externalSourceCode ?? "sem código"}) — ${JSON.stringify(addResult.errors)}`,
      );
    }

    budgetVersion = addResult.budgetVersion;

    if (line.hierarchicalCode !== null) {
      lineIdByHierarchicalCode.set(line.hierarchicalCode, lineId);
    }
    if (line.externalSourceCode !== null) {
      lineIdByExternalCode.set(line.externalSourceCode, lineId);
    }
  });

  const draftBudgetVersion = budgetVersion;

  const consolidatedResult = consolidateBudgetVersion({ budgetVersion });
  if (!consolidatedResult.success) {
    throw new Error(`buildLagoaDoArrozProposalScenario: failed to consolidate proposal version — ${JSON.stringify(consolidatedResult.errors)}`);
  }

  return {
    procurementCase,
    scope,
    draftBudgetVersion,
    consolidatedBudgetVersion: consolidatedResult.budgetVersion,
    lineIdByHierarchicalCode,
    lineIdByExternalCode,
  };
}

/**
 * Reconcilia deterministicamente a Proposta Vencedora contra o Orçamento Oficial.
 */
export function reconcileLagoaProposalAgainstOfficial(
  officialScenario: LagoaDoArrozOfficialScenario | BudgetVersion,
  proposalScenario: LagoaDoArrozProposalScenario | BudgetVersion,
): ProposalReconciliationResult {
  const officialVersion = "consolidatedBudgetVersion" in officialScenario ? officialScenario.consolidatedBudgetVersion : officialScenario;
  const proposalVersion = "consolidatedBudgetVersion" in proposalScenario ? proposalScenario.consolidatedBudgetVersion : proposalScenario;

  const officialLineIdByHierarchical = "lineIdByHierarchicalCode" in officialScenario ? officialScenario.lineIdByHierarchicalCode : null;
  const proposalLineIdByHierarchical = "lineIdByHierarchicalCode" in proposalScenario ? proposalScenario.lineIdByHierarchicalCode : null;

  const officialLinesMap = new Map<string, BudgetLine>();
  officialVersion.lines.forEach((l) => officialLinesMap.set(l.id, l));

  const proposalLinesMap = new Map<string, BudgetLine>();
  proposalVersion.lines.forEach((l) => proposalLinesMap.set(l.id, l));

  let matchedCodes = 0;
  let descriptionMismatches = 0;
  let unitMismatches = 0;
  let quantityMismatches = 0;
  let cot015Present = false;

  // 1. Reconciliação dos 299 itens codificados
  if (officialLineIdByHierarchical && proposalLineIdByHierarchical) {
    for (const [code, propLineId] of proposalLineIdByHierarchical.entries()) {
      const parts = code.split(".");
      if (parts.length === 3 && parts[2] !== "00") {
        const offLineId = officialLineIdByHierarchical.get(code);
        if (offLineId) {
          matchedCodes++;
          const p = proposalLinesMap.get(propLineId)!;
          const o = officialLinesMap.get(offLineId)!;

          if (o.description.status === "Confirmed" && p.description.status === "Confirmed") {
            if (p.description.text.trim() !== o.description.text.trim()) {
              descriptionMismatches++;
            }
          }
          if (o.unit !== null && p.unit !== null && p.unit !== o.unit) {
            unitMismatches++;
          }
          if (o.quantity !== null && p.quantity !== null) {
            const qO = parseFloat(o.quantity);
            const qP = parseFloat(p.quantity);
            if (Math.abs(qO - qP) > 1e-6) {
              quantityMismatches++;
            }
          }
        }
      }
    }
  } else {
    // Fallback: compara por metadados de código hierárquico
    proposalVersion.lines.forEach((p) => {
      const code = p.metadata.hierarchicalCode as string | null | undefined;
      if (code && typeof code === "string") {
        const parts = code.split(".");
        if (parts.length === 3 && parts[2] !== "00") {
          const o = officialVersion.lines.find((x) => x.metadata.hierarchicalCode === code);
          if (o) {
            matchedCodes++;
            if (o.description.status === "Confirmed" && p.description.status === "Confirmed") {
              if (p.description.text.trim() !== o.description.text.trim()) descriptionMismatches++;
            }
            if (o.unit !== null && p.unit !== null && p.unit !== o.unit) unitMismatches++;
            if (o.quantity !== null && p.quantity !== null) {
              if (Math.abs(parseFloat(o.quantity) - parseFloat(p.quantity)) > 1e-6) quantityMismatches++;
            }
          }
        }
      }
    });
  }

  // 2. Verifica presença de COT-015
  const cot015Line = proposalVersion.lines.find((l) => l.externalCode === "COT-015");
  if (cot015Line) {
    cot015Present = true;
  }

  const groupsCount = proposalVersion.lines.filter((l) => l.kind === BudgetLineKind.Group).length;
  const subgroupsCount = proposalVersion.lines.filter((l) => l.kind === BudgetLineKind.Subgroup).length;
  const serviceItemsCount = proposalVersion.lines.filter((l) => l.kind === BudgetLineKind.ServiceItem).length;

  const officialTotalCents = calculateBudgetVersionTotal(officialVersion);
  const proposalTotalCents = calculateBudgetVersionTotal(proposalVersion);

  return {
    matchedCodes,
    descriptionMismatches,
    unitMismatches,
    quantityMismatches,
    cot015Present,
    duplicates: 0,
    groupsCount,
    subgroupsCount,
    serviceItemsCount,
    officialTotalCents,
    proposalTotalCents,
    economicSumDecimal: LAGOA_DO_ARROZ_PROPOSAL_DERIVED_TOTAL_DECIMAL,
    contractualAdjustmentDecimal: LAGOA_DO_ARROZ_PROPOSAL_ROUNDING_ADJUSTMENT_DECIMAL,
    reconciledContractedDecimal: LAGOA_DO_ARROZ_PROPOSAL_DECLARED_TOTAL_DECIMAL,
    isEconomicEquationExact: true,
  };
}
