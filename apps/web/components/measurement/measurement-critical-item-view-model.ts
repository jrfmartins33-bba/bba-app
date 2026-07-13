import type { DecisionBriefCriticalItem, DecisionBriefSourceReference } from "@bba/bdos-core/decision-brief";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.4 — apresentação pura do
 * item crítico. Traduz `severity`; nunca recalcula, prioriza ou
 * inventa uma relação com outro campo do Brief.
 */

export interface SeverityPresentation {
  readonly label: string;
}

// Só os dois valores reais do contrato -- nenhuma severidade
// especulativa (ex.: um terceiro nível informativo não existe hoje).
const SEVERITY_PRESENTATION: Record<DecisionBriefCriticalItem["severity"], SeverityPresentation> = {
  blocking: { label: "Bloqueante" },
  warning: { label: "Ponto de atenção" }
};

export function translateSeverity(severity: DecisionBriefCriticalItem["severity"]): SeverityPresentation {
  return SEVERITY_PRESENTATION[severity];
}

export interface SourceReferenceGroup {
  readonly sheetName: string;
  readonly row: number;
  readonly columns: ReadonlyArray<string>;
}

/**
 * Agrupa só referências ADJACENTES que compartilham planilha+linha
 * (ex.: duas colunas da mesma issue, `physicalColumn`/`financialColumn`)
 * numa única linha de apresentação -- nenhuma referência é descartada,
 * a ordem do array nunca é alterada, e referências não adjacentes
 * (mesmo que coincidam em planilha+linha) permanecem em grupos
 * separados, exatamente na posição em que vieram.
 */
export function groupSourceReferencesForDisplay(
  references: ReadonlyArray<DecisionBriefSourceReference>
): ReadonlyArray<SourceReferenceGroup> {
  const groups: SourceReferenceGroup[] = [];

  references.forEach((reference) => {
    const last = groups[groups.length - 1];
    const sameCell = last !== undefined && last.sheetName === reference.locator.sheetName && last.row === reference.locator.row;

    if (sameCell && last !== undefined) {
      const column = reference.locator.column;
      if (column !== undefined && !last.columns.includes(column)) {
        groups[groups.length - 1] = { ...last, columns: [...last.columns, column] };
      }
      return;
    }

    groups.push({
      sheetName: reference.locator.sheetName,
      row: reference.locator.row,
      columns: reference.locator.column !== undefined ? [reference.locator.column] : []
    });
  });

  return groups;
}

/** "G" / "G e H" / "G, H e I" -- nunca reordena as colunas recebidas. */
export function joinColumnsLabel(columns: ReadonlyArray<string>): string {
  if (columns.length <= 1) {
    return columns[0] ?? "";
  }
  if (columns.length === 2) {
    return `${columns[0]} e ${columns[1]}`;
  }
  return `${columns.slice(0, -1).join(", ")} e ${columns[columns.length - 1]}`;
}
