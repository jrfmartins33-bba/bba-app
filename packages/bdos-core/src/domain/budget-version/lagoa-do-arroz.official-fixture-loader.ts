/**
 * Carrega a fixture real (`lagoa-do-arroz.official-fixture.ts`) no modelo
 * de domínio puro desta Sprint. A planilha não declara lotes de forma
 * inequívoca (nenhuma coluna de lote na aba "ORÇAMENTO") — por isso, esta
 * fixture usa exclusivamente o Escopo do processo inteiro, sem criar
 * nenhum lote. A confirmação sobre a existência ou ausência de lotes reais
 * permanece pendência documental (mapa §O).
 *
 * Identidade interna nunca é derivada de fonte documental: cada linha
 * recebe um identificador sintético (`fixture-line-NNNN`), gerado por uma
 * sequência interna estável da própria carga — nunca do código externo,
 * nunca do `sourceRowNumber`. `sourceRowNumber` é preservado exclusivamente
 * como metadado de proveniência.
 */
import { createProcurementCase, createWholeCaseScope } from "../procurement-case";
import type { ProcurementCase, ProcurementScope } from "../procurement-case";
import { addBudgetLine, consolidateBudgetVersion, createBudgetVersion } from "./budget-version";
import { centsFromDecimalString } from "./budget-version-money";
import { BudgetLineKind, BudgetVersionOriginKind } from "./budget-version.types";
import type { BudgetVersion } from "./budget-version.types";
import { LAGOA_DO_ARROZ_OFFICIAL_LINES, LAGOA_DO_ARROZ_SOURCE_PROVENANCE } from "./lagoa-do-arroz.official-fixture";
import type { LagoaDoArrozOfficialLine } from "./lagoa-do-arroz.official-fixture";

const ORGANIZATION_ID = "organization-lagoa-do-arroz-official";

/** Rótulo de apresentação para uma descrição ausente na fonte — nunca gravado na fixture, apenas produzido aqui, no carregador, como apresentação derivada. */
export const ABSENT_DESCRIPTION_PRESENTATION_LABEL = "(descrição não informada na fonte oficial)";

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
 * Ordena as linhas para carga: em ordem documental (a ordem natural da
 * fonte, já topologicamente válida — pai sempre antes do filho) ou com os
 * grupos de irmãos internamente invertidos, preservando ainda a
 * necessidade topológica (nenhum filho é inserido antes do seu pai) mas
 * variando genuinamente a ordem de inserção entre irmãos, em três
 * passagens: todos os Grupos primeiro (ordem entre si invertida), depois
 * todos os Subgrupos (invertidos dentro de cada grupo de irmãos), depois
 * todos os Itens de Serviço (invertidos dentro de cada grupo de irmãos).
 */
function orderLinesForLoading(
  lines: ReadonlyArray<LagoaDoArrozOfficialLine>,
  strategy: SiblingInsertionOrder,
): ReadonlyArray<LagoaDoArrozOfficialLine> {
  if (strategy === "Documentary") {
    return lines;
  }

  const grupos = lines.filter((l) => l.classification === "Grupo").slice().reverse();
  const subgrupos = reverseWithinSiblingGroups(
    lines.filter((l) => l.classification === "Subgrupo"),
    (l) => l.parentHierarchicalCode,
  );
  const itens = reverseWithinSiblingGroups(
    lines.filter((l) => l.classification === "ServiceItem"),
    (l) => l.parentHierarchicalCode,
  );

  return [...grupos, ...subgrupos, ...itens];
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
  options: { readonly siblingInsertionOrder?: SiblingInsertionOrder } = {},
): LagoaDoArrozOfficialScenario {
  const siblingInsertionOrder = options.siblingInsertionOrder ?? "Documentary";

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
    organizationId: ORGANIZATION_ID,
    procurementCaseId: procurementCase.id,
    scope,
    origin: {
      kind: BudgetVersionOriginKind.DocumentaryOpaqueReference,
      reference: LAGOA_DO_ARROZ_SOURCE_PROVENANCE.sourceFileName,
    },
  });
  if (!versionResult.success) {
    throw new Error(`buildLagoaDoArrozOfficialScenario: failed to create BudgetVersion — ${JSON.stringify(versionResult.errors)}`);
  }
  let budgetVersion = versionResult.budgetVersion;

  const lineIdByHierarchicalCode = new Map<string, string>();
  const idBySourceRowNumber = new Map<number, string>();

  // Sequência interna estável da carga — não é o sourceRowNumber, não é o
  // código externo. Atribuída na ordem documental original
  // (LAGOA_DO_ARROZ_OFFICIAL_LINES), independentemente da estratégia de
  // inserção usada abaixo, para que o identificador de cada linha seja
  // estável entre as duas estratégias de carga (necessário para comparar
  // os resultados por identidade na Etapa de teste de ordem).
  LAGOA_DO_ARROZ_OFFICIAL_LINES.forEach((line, index) => {
    idBySourceRowNumber.set(line.sourceRowNumber, `fixture-line-${String(index + 1).padStart(4, "0")}`);
  });

  // A posição de cada linha é fixada de antemão, uma única vez, a partir da
  // ordem documental original — nunca derivada da ordem de inserção usada
  // abaixo. Isso é o que torna o teste de independência de ordem
  // significativo: as duas estratégias de carga inserem as MESMAS posições
  // em sequências diferentes, e a leitura ordenada final (`orderedChildren`)
  // deve produzir o mesmo resultado em ambas — provando que é a posição
  // declarada, não a ordem de inserção, que governa a leitura.
  const positionBySourceRowNumber = new Map<number, number>();
  const documentaryPositionCounter = new Map<string | null, number>();
  const idByHierarchicalCodeInDocumentaryOrder = new Map<string, string>();
  LAGOA_DO_ARROZ_OFFICIAL_LINES.forEach((line) => {
    const parentId = line.parentHierarchicalCode === null ? null : (idByHierarchicalCodeInDocumentaryOrder.get(line.parentHierarchicalCode) ?? null);
    const position = documentaryPositionCounter.get(parentId) ?? 0;
    documentaryPositionCounter.set(parentId, position + 1);
    positionBySourceRowNumber.set(line.sourceRowNumber, position);

    if (line.hierarchicalCode !== null) {
      idByHierarchicalCodeInDocumentaryOrder.set(line.hierarchicalCode, idBySourceRowNumber.get(line.sourceRowNumber)!);
    }
  });

  const loadOrder = orderLinesForLoading(LAGOA_DO_ARROZ_OFFICIAL_LINES, siblingInsertionOrder);

  loadOrder.forEach((line) => {
    const id = idBySourceRowNumber.get(line.sourceRowNumber)!;
    const parentLineId =
      line.parentHierarchicalCode === null ? null : (lineIdByHierarchicalCode.get(line.parentHierarchicalCode) ?? null);

    if (line.parentHierarchicalCode !== null && parentLineId === null) {
      throw new Error(
        `buildLagoaDoArrozOfficialScenario: parent "${line.parentHierarchicalCode}" not yet loaded for row ${line.sourceRowNumber}.`,
      );
    }

    const position = positionBySourceRowNumber.get(line.sourceRowNumber)!;

    // Limitação real da fonte: 8 linhas (todas do tipo "Cotação") têm a
    // célula de descrição vazia na própria planilha oficial. A fixture
    // preserva essa ausência como estado explícito
    // (`descricao.status === "AbsentFromSource"`); nenhum texto é
    // inventado. O rótulo abaixo é apresentação derivada, produzida aqui
    // no carregador, nunca tratado como descrição confirmada.
    const description =
      line.descricao.status === "ConfirmedFromSource" ? line.descricao.text : ABSENT_DESCRIPTION_PRESENTATION_LABEL;

    const result = addBudgetLine({
      budgetVersion,
      id,
      kind: kindFor(line),
      description,
      externalCode: line.externalSourceCode,
      parentLineId,
      position,
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
        descricaoConfirmadaNaFonte: line.descricao.status === "ConfirmedFromSource",
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
