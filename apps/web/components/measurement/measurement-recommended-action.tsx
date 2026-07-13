"use client";

import { useId, useState } from "react";
import { CheckSquare, ChevronDown } from "lucide-react";
import type { DecisionBriefNextAction } from "@bba/bdos-core/decision-brief";
import { MeasurementCellReference } from "./measurement-cell-reference";

export interface MeasurementRecommendedActionProps {
  readonly action: DecisionBriefNextAction;
  readonly index: number;
}

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.6 — uma ação
 * recomendada, escaneável recolhida (título + índice + localizador
 * compacto), com `rationale` e a origem completa revelados só ao
 * expandir -- mesmo padrão de progressive disclosure do Item Crítico
 * (protótipo validado com a fixture real do BM_08). Antes desta
 * iteração o `rationale` ficava sempre visível e só a origem era
 * opcional; a mudança para recolhido por padrão veio da própria
 * validação visual, não de uma regra nova.
 *
 * `title`/`rationale` continuam verbatim, sem checkbox nem botão que
 * dispare a ação. O ícone é puramente decorativo (aria-hidden),
 * repetido igual em todo card -- não representa nenhum atributo que o
 * contrato não forneça para esta ação.
 */
export function MeasurementRecommendedAction({ action, index }: MeasurementRecommendedActionProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  return (
    <li className="measurement-recommended-actions-list__item">
      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        className="measurement-recommended-actions-list__trigger"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span aria-hidden="true" className="measurement-recommended-actions-list__icon">
          <CheckSquare size={15} />
        </span>
        <span aria-hidden="true" className="measurement-recommended-actions-list__index">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="measurement-recommended-actions-list__title">{action.title}</span>
        <MeasurementCellReference evidenceReferences={action.evidenceReferences} variant="compact" />
        <ChevronDown aria-hidden="true" className="measurement-recommended-actions-list__chevron" size={16} />
      </button>

      {expanded ? (
        <div className="measurement-recommended-actions-list__detail" id={contentId}>
          <p className="measurement-recommended-actions-list__rationale">{action.rationale}</p>
          {action.evidenceReferences.length > 0 ? (
            <MeasurementCellReference evidenceReferences={action.evidenceReferences} variant="full" />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
