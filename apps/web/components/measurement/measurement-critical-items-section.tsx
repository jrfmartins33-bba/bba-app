"use client";

import { useState } from "react";
import { ChevronDown, CircleCheck } from "lucide-react";
import { Card } from "@bba/ui";
import type { DecisionBrief, DecisionBriefCriticalItem } from "@bba/bdos-core/decision-brief";
import { MeasurementCriticalItem } from "./measurement-critical-item";

export interface MeasurementCriticalItemsSectionProps {
  readonly criticalItems: DecisionBrief["criticalItems"];
}

// Sprint 20.1E.6 (protótipo validado) -- quantidade fixa de itens
// visíveis por padrão. Não é um limite de dado (o array inteiro já
// chegou do Brief, intacto); é só quantos ficam à mostra antes de
// "Ver mais" -- mesma disciplina de PRINCIPLE 003, um degrau a mais.
const VISIBLE_COUNT = 4;

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.4 (original) + 20.1E.6
 * (padrão visual human-first) + refinamento pós-3C.2 (materialidade)
 * — separa `criticalItems[]` em dois cards conforme `item.materiality`,
 * cada um com sua própria paginação "Ver mais". Nunca reordena,
 * funde, corta ou esconde nenhuma ocorrência -- os dois arrays juntos
 * somam exatamente `criticalItems.length`, sempre.
 *
 * "O que precisa de atenção" (material) nunca é omitido -- um array
 * vazio aqui tem significado positivo, mostra estado vazio explícito.
 * "Observações técnicas da leitura" (technical_observation) só
 * aparece quando existe pelo menos uma -- uma seção vazia ao lado da
 * de atenção pareceria quebrada, não intencional (mesma regra já
 * aplicada a Principais Decisões/Ações Recomendadas).
 */
export function MeasurementCriticalItemsSection({ criticalItems }: MeasurementCriticalItemsSectionProps) {
  const materialItems = criticalItems.filter((item) => item.materiality === "material");
  const technicalObservationItems = criticalItems.filter((item) => item.materiality === "technical_observation");

  return (
    <>
      <MeasurementCriticalItemsGroup
        emptyMessage="Nenhum item crítico identificado."
        items={materialItems}
        itemNoun={{ singular: "item", plural: "itens" }}
        title="O que precisa de atenção"
      />

      {technicalObservationItems.length > 0 ? (
        <MeasurementCriticalItemsGroup
          intro="Estas ocorrências foram identificadas durante a leitura da planilha, mas não alteram os valores, os itens medidos nem a rastreabilidade do boletim."
          items={technicalObservationItems}
          itemNoun={{ singular: "observação", plural: "observações" }}
          title="Observações técnicas da leitura"
        />
      ) : null}
    </>
  );
}

interface MeasurementCriticalItemsGroupProps {
  readonly title: string;
  readonly items: ReadonlyArray<DecisionBriefCriticalItem>;
  readonly itemNoun: { readonly singular: string; readonly plural: string };
  readonly intro?: string;
  readonly emptyMessage?: string;
}

function MeasurementCriticalItemsGroup({ title, items, itemNoun, intro, emptyMessage }: MeasurementCriticalItemsGroupProps) {
  const [showAll, setShowAll] = useState(false);
  const hasItems = items.length > 0;
  const hasMore = items.length > VISIBLE_COUNT;
  const visibleItems = showAll ? items : items.slice(0, VISIBLE_COUNT);
  const remainingCount = items.length - VISIBLE_COUNT;

  return (
    <Card
      action={hasItems ? <span className="measurement-section-count">{items.length} {items.length === 1 ? itemNoun.singular : itemNoun.plural}</span> : undefined}
      className="span-12 workspace-card"
      title={title}
    >
      {intro ? <p className="workspace-card__description">{intro}</p> : null}

      {hasItems ? (
        <>
          <ul className="measurement-critical-items-list">
            {visibleItems.map((item, index) => (
              <MeasurementCriticalItem index={index} item={item} key={item.id} />
            ))}
          </ul>

          {hasMore ? (
            <button
              aria-expanded={showAll}
              className="measurement-ver-mais"
              onClick={() => setShowAll((current) => !current)}
              type="button"
            >
              <ChevronDown aria-hidden="true" className="measurement-ver-mais__chevron" size={14} />
              {showAll ? "Mostrar menos" : `Ver mais ${remainingCount} ${remainingCount === 1 ? "ponto" : "pontos"}`}
            </button>
          ) : null}
        </>
      ) : emptyMessage ? (
        <div className="measurement-critical-items-empty">
          <CircleCheck aria-hidden="true" size={20} />
          <p>{emptyMessage}</p>
        </div>
      ) : null}
    </Card>
  );
}
