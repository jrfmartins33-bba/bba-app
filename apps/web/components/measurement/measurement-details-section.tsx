"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@bba/ui";
import type { DecisionBrief } from "@bba/bdos-core/decision-brief";

export interface MeasurementDetailsSectionProps {
  readonly details: DecisionBrief["details"];
}

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.5 — apresenta `details`
 * (o mesmo tipo de `situation`: `{ title, body }`, um bloco único, não
 * uma lista de seções) com progressive disclosure. `details.title` é
 * sempre o literal "Detalhamento" no builder atual -- redundante com o
 * heading da própria seção, por isso não é exibido de novo aqui, só o
 * heading de UI ("Detalhamento", vocabulário de produto, não campo do
 * contrato) e o gatilho de expansão.
 *
 * `details` não tem referências de origem no tipo -- nada a decidir
 * sobre Evidence Lineage aqui, o campo simplesmente não existe.
 */
export function MeasurementDetailsSection({ details }: MeasurementDetailsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const hasContent = details.body.trim().length > 0;

  return (
    <Card className="span-12 workspace-card" title="Detalhamento">
      {!hasContent ? (
        <p className="measurement-details-empty">Nenhum detalhamento adicional disponível.</p>
      ) : (
        <div className="measurement-details">
          <button
            aria-controls={contentId}
            aria-expanded={expanded}
            className="measurement-details__trigger"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            <span>{expanded ? "Ocultar detalhamento" : "Ver detalhamento"}</span>
            <ChevronDown aria-hidden="true" className="measurement-details__chevron" size={16} />
          </button>

          {expanded ? (
            <p className="measurement-details__body" id={contentId}>
              {details.body}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
