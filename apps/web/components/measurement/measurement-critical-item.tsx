"use client";

import { useId, useState } from "react";
import { AlertOctagon, AlertTriangle, ChevronDown } from "lucide-react";
import type { DecisionBriefCriticalItem } from "@bba/bdos-core/decision-brief";
import { groupSourceReferencesForDisplay, joinColumnsLabel, translateSeverity } from "./measurement-critical-item-view-model";

const SEVERITY_ICON: Record<DecisionBriefCriticalItem["severity"], typeof AlertOctagon> = {
  blocking: AlertOctagon,
  warning: AlertTriangle
};

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.4 — um item do Decision
 * Stack. Estado próprio (nunca compartilhado/elevado ao pai): cada
 * item recolhe/expande de forma independente, então mais de um pode
 * ficar aberto ao mesmo tempo -- nenhuma regra de "só um aberto por
 * vez" foi pedida ou aprovada para esta seção (diferente do accordion
 * de `packages/ui/src/decision/`). Começa sempre recolhido.
 *
 * Apresenta `item` exatamente como o Brief entrega -- nenhuma
 * consequência/relação é inventada aqui. A localização documental de
 * cada referência (planilha/linha/coluna) é só leitura nesta Sprint:
 * nenhuma navegação, nenhuma interação além de expandir/recolher.
 */
export function MeasurementCriticalItem({ item, index }: { readonly item: DecisionBriefCriticalItem; readonly index: number }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const presentation = translateSeverity(item.severity);
  const Icon = SEVERITY_ICON[item.severity];
  const hasConsequences = item.consequenceIfAddressed !== null || item.consequenceIfIgnored !== null;
  const referenceGroups = groupSourceReferencesForDisplay(item.evidenceReferences);

  return (
    <li className={`measurement-critical-item measurement-critical-item--${item.severity}`}>
      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        className="measurement-critical-item__trigger"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span aria-hidden="true" className="measurement-critical-item__index">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="measurement-critical-item__severity">
          <Icon aria-hidden="true" size={16} />
          {presentation.label}
        </span>
        <span className="measurement-critical-item__title">{item.title}</span>
        <ChevronDown aria-hidden="true" className="measurement-critical-item__chevron" size={16} />
      </button>

      {expanded ? (
        <div className="measurement-critical-item__content" id={contentId}>
          <div className="measurement-critical-item__block">
            <p className="measurement-critical-item__block-label">Fato identificado</p>
            <p className="measurement-critical-item__block-body">{item.body}</p>
          </div>

          {hasConsequences ? (
            <div className="measurement-critical-item__consequences">
              {item.consequenceIfAddressed !== null ? (
                <div className="measurement-critical-item__block">
                  <p className="measurement-critical-item__block-label">Se for tratado</p>
                  <p className="measurement-critical-item__block-body">{item.consequenceIfAddressed}</p>
                </div>
              ) : null}
              {item.consequenceIfIgnored !== null ? (
                <div className="measurement-critical-item__block">
                  <p className="measurement-critical-item__block-label">Se for ignorado</p>
                  <p className="measurement-critical-item__block-body">{item.consequenceIfIgnored}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {referenceGroups.length > 0 ? (
            <div className="measurement-critical-item__block">
              <p className="measurement-critical-item__block-label">Origem registrada</p>
              {referenceGroups.map((group, groupIndex) => (
                <p className="measurement-critical-item__origin-line" key={`${group.sheetName}-${group.row}-${groupIndex}`}>
                  Planilha: {group.sheetName} · Linha: {group.row}
                  {group.columns.length > 0
                    ? ` · ${group.columns.length === 1 ? "Coluna" : "Colunas"}: ${joinColumnsLabel(group.columns)}`
                    : ""}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
