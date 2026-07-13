import type { DecisionBriefSourceReference } from "@bba/bdos-core/decision-brief";
import { groupSourceReferencesForDisplay, joinColumnsLabel } from "./measurement-evidence-reference-view-model";

export interface MeasurementCellReferenceProps {
  readonly evidenceReferences: ReadonlyArray<DecisionBriefSourceReference>;
  readonly variant: "compact" | "full";
}

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.6 (padrão visual
 * human-first, PRINCIPLE 008 -- segunda iteração, após protótipo
 * aprovado) — localizador visual no vocabulário da própria planilha
 * (crachá curto para linha/coluna, como um cabeçalho de Excel), em
 * vez de uma frase corrida atrás de um segundo toggle. Substitui
 * `MeasurementOriginDisclosure`: a origem agora fica sempre visível
 * assim que o item/ação já está expandido, sem exigir um clique à
 * parte só para revelar onde ela está -- exatamente a simplificação
 * validada no protótipo.
 *
 * `variant="compact"` (linha recolhida): só a linha, sem o nome da
 * planilha (não cabe ali). `variant="full"` (painel de resolução): o
 * nome real da planilha por extenso -- nunca abreviado -- mais
 * linha/coluna(s) como crachás curtos.
 *
 * Continua sem nenhum identificador técnico interno, sem navegação,
 * sem ação de obter o documento original -- só reorganiza
 * `sheetName`/`row`/`columns`, que já vêm do contrato.
 */
export function MeasurementCellReference({ evidenceReferences, variant }: MeasurementCellReferenceProps) {
  const groups = groupSourceReferencesForDisplay(evidenceReferences);

  if (groups.length === 0) {
    return null;
  }

  if (variant === "compact") {
    return (
      <span className="measurement-cell-ref-compact">
        {groups.map((group, index) => (
          <span className="measurement-cell-ref-compact__badge" key={`${group.sheetName}-${group.row}-${index}`}>
            L{group.row}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className="measurement-cell-ref-full">
      {groups.map((group, index) => (
        <div className="measurement-cell-ref-full__group" key={`${group.sheetName}-${group.row}-${index}`}>
          <span className="measurement-cell-ref-full__sheet">{group.sheetName}</span>
          <span className="measurement-cell-ref-full__badge">Linha {group.row}</span>
          {group.columns.length > 0 ? (
            <span className="measurement-cell-ref-full__badge">
              {group.columns.length === 1 ? "Coluna" : "Colunas"} {joinColumnsLabel(group.columns)}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
