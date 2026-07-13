"use client";

import { useState } from "react";
import { ChevronDown, CircleCheck } from "lucide-react";
import { Card } from "@bba/ui";
import type { DecisionBrief } from "@bba/bdos-core/decision-brief";
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
 * (padrão visual human-first, PRINCIPLE 008 -- segunda iteração) —
 * apresenta `criticalItems[]` na ordem exata entregue pelo builder.
 * Diferente de Principais Decisões/Ações Recomendadas, um array vazio
 * aqui tem significado positivo e por isso a seção nunca é omitida --
 * mostra um estado vazio explícito em vez de desaparecer.
 *
 * "Ver mais"/"Mostrar menos" só controla quantos itens já renderizados
 * ficam visíveis -- nunca corta, funde ou reordena `criticalItems[]`;
 * o array inteiro é sempre passado para `.map`, intacto.
 */
export function MeasurementCriticalItemsSection({ criticalItems }: MeasurementCriticalItemsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const hasItems = criticalItems.length > 0;
  const hasMore = criticalItems.length > VISIBLE_COUNT;
  const visibleItems = showAll ? criticalItems : criticalItems.slice(0, VISIBLE_COUNT);
  const remainingCount = criticalItems.length - VISIBLE_COUNT;

  return (
    <Card
      action={hasItems ? <span className="measurement-section-count">{criticalItems.length} {criticalItems.length === 1 ? "item" : "itens"}</span> : undefined}
      className="span-12 workspace-card"
      title="O que precisa de atenção"
    >
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
      ) : (
        <div className="measurement-critical-items-empty">
          <CircleCheck aria-hidden="true" size={20} />
          <p>Nenhum item crítico identificado.</p>
        </div>
      )}
    </Card>
  );
}
