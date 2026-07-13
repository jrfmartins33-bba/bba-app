"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@bba/ui";
import type { DecisionBrief } from "@bba/bdos-core/decision-brief";
import { MeasurementRecommendedAction } from "./measurement-recommended-action";

export interface MeasurementRecommendedActionsSectionProps {
  readonly nextActions: DecisionBrief["nextActions"];
}

// Mesmo raciocínio de MeasurementCriticalItemsSection: quantidade de
// itens visíveis por padrão, não um corte do dado -- nextActions[]
// inteiro é sempre passado para `.map`, intacto.
const VISIBLE_COUNT = 3;

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.3 (original) + 20.1E.6
 * (padrão visual human-first, PRINCIPLE 008 -- segunda iteração) —
 * apresenta `nextActions[]` na ordem exata entregue pelo builder.
 * Puramente descritivo -- nenhum checkbox, nenhum botão que dispare a
 * ação, nem aggregate de execução. Cada ação com referências mostra
 * sua própria origem, dentro do próprio card
 * (`MeasurementRecommendedAction` → `MeasurementCellReference`) -- não
 * relacionada por título, posição ou similaridade a nenhum item
 * crítico (a fixture real do BM_08 confirma isso: a linha 352 tem
 * item crítico mas não tem ação correspondente).
 *
 * "Ver mais"/"Mostrar menos" só controla quantas ações já renderizadas
 * ficam visíveis -- nunca funde, reordena ou corta `nextActions[]`.
 *
 * Array vazio: seção omitida, mesma decisão de
 * MeasurementKeyDecisionsSection.
 */
export function MeasurementRecommendedActionsSection({ nextActions }: MeasurementRecommendedActionsSectionProps) {
  const [showAll, setShowAll] = useState(false);

  if (nextActions.length === 0) {
    return null;
  }

  const hasMore = nextActions.length > VISIBLE_COUNT;
  const visibleActions = showAll ? nextActions : nextActions.slice(0, VISIBLE_COUNT);
  const remainingCount = nextActions.length - VISIBLE_COUNT;

  return (
    <Card
      action={<span className="measurement-section-count">{nextActions.length} {nextActions.length === 1 ? "ação" : "ações"}</span>}
      className="span-12 workspace-card"
      title="Ações Recomendadas"
    >
      <ul className="measurement-recommended-actions-list">
        {visibleActions.map((action, index) => (
          <MeasurementRecommendedAction action={action} index={index} key={`${index}-${action.title}`} />
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
          {showAll ? "Mostrar menos" : `Ver mais ${remainingCount} ${remainingCount === 1 ? "ação" : "ações"}`}
        </button>
      ) : null}
    </Card>
  );
}
