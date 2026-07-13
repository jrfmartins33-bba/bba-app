"use client";

import { useId, useState } from "react";
import { AlertOctagon, AlertTriangle, ChevronDown, CircleCheck, MapPin, SearchCheck, ShieldAlert } from "lucide-react";
import type { DecisionBriefCriticalItem } from "@bba/bdos-core/decision-brief";
import { translateSeverity } from "./measurement-critical-item-view-model";
import { MeasurementCellReference } from "./measurement-cell-reference";

const SEVERITY_ICON: Record<DecisionBriefCriticalItem["severity"], typeof AlertOctagon> = {
  blocking: AlertOctagon,
  warning: AlertTriangle
};

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.4 (original) + 20.1E.6
 * (padrão visual human-first, PRINCIPLE 008 -- segunda iteração, após
 * protótipo validado com a fixture real do BM_08) — um item do
 * Decision Stack. Estado próprio (nunca compartilhado/elevado ao
 * pai): cada item recolhe/expande de forma independente, então mais
 * de um pode ficar aberto ao mesmo tempo -- nenhuma regra de "só um
 * aberto por vez" foi pedida ou aprovada para esta seção (diferente
 * do accordion de `packages/ui/src/decision/`). Começa sempre
 * recolhido.
 *
 * Apresenta `item` exatamente como o Brief entrega -- nenhuma
 * consequência/relação é inventada aqui. Quatro blocos possíveis (O
 * problema / Onde está / Se for ignorado / Ao corrigir) têm ícone e
 * tratamento visual próprios só para diferenciação de leitura -- a
 * distinção nunca depende só de cor. "Onde está" só existe quando
 * `evidenceReferences` não está vazio -- nenhum localizador fictício
 * quando o item não tem célula real associada (ex.: "Coluna residual
 * sem uso" no BM_08 real). A origem deixou de ser uma segunda camada
 * de expansão (`MeasurementOriginDisclosure`, aposentado nesta
 * iteração): agora é um bloco a mais, visível assim que o item já
 * está expandido -- validado no protótipo como redução real de
 * cliques, não decoração.
 */
export function MeasurementCriticalItem({ item, index }: { readonly item: DecisionBriefCriticalItem; readonly index: number }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const presentation = translateSeverity(item.severity);
  const Icon = SEVERITY_ICON[item.severity];
  const hasLocation = item.evidenceReferences.length > 0;
  const hasConsequences = item.consequenceIfAddressed !== null || item.consequenceIfIgnored !== null;

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
          <Icon aria-hidden="true" size={13} />
          {presentation.label}
        </span>
        <span className="measurement-critical-item__title">{item.title}</span>
        <MeasurementCellReference evidenceReferences={item.evidenceReferences} variant="compact" />
        <ChevronDown aria-hidden="true" className="measurement-critical-item__chevron" size={16} />
      </button>

      {expanded ? (
        <div className="measurement-critical-item__content" id={contentId}>
          <div className="measurement-critical-item__primary-grid">
            <div className="measurement-critical-item__block">
              <p className="measurement-critical-item__block-label">
                <SearchCheck aria-hidden="true" size={14} />O problema
              </p>
              <p className="measurement-critical-item__block-body">{item.body}</p>
            </div>

            {hasLocation ? (
              <div className="measurement-critical-item__block">
                <p className="measurement-critical-item__block-label">
                  <MapPin aria-hidden="true" size={14} />
                  Onde está
                </p>
                <MeasurementCellReference evidenceReferences={item.evidenceReferences} variant="full" />
              </div>
            ) : null}
          </div>

          {hasConsequences ? (
            <div className="measurement-critical-item__consequences">
              {item.consequenceIfIgnored !== null ? (
                <div className="measurement-critical-item__block measurement-critical-item__block--negative">
                  <p className="measurement-critical-item__block-label">
                    <ShieldAlert aria-hidden="true" size={14} />
                    Se for ignorado
                  </p>
                  <p className="measurement-critical-item__block-body">{item.consequenceIfIgnored}</p>
                </div>
              ) : null}
              {item.consequenceIfAddressed !== null ? (
                <div className="measurement-critical-item__block measurement-critical-item__block--positive">
                  <p className="measurement-critical-item__block-label">
                    <CircleCheck aria-hidden="true" size={14} />
                    Ao corrigir
                  </p>
                  <p className="measurement-critical-item__block-body">{item.consequenceIfAddressed}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
