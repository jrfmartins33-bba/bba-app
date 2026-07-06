"use client";

import { AlertOctagon, AlertTriangle } from "lucide-react";
import type { BbaProjectPlanningActivity } from "./bba-project-view-types";

export interface RiskListItem {
  readonly activity: BbaProjectPlanningActivity;
  readonly confidenceLabel: string;
  readonly isCritical: boolean;
}

interface BbaProjectRiskListProps {
  readonly items: ReadonlyArray<RiskListItem>;
  readonly selectedActivityId: string | null;
  readonly onSelectActivity: (activityId: string) => void;
  readonly totalActivityCount: number;
}

/**
 * BBA Project Studio — Sprint 2, "Atividades em Risco" como lista
 * inteligente (EPIC 02, item 7): ícone de severidade, nome, nível de
 * confiança e impacto (caminho crítico ou não) — não mais um bloco de
 * texto corrido. Clicar sincroniza cronograma, Advisor e Modelo
 * Espacial, através do mesmo `onSelectActivity` já compartilhado.
 */
export function BbaProjectRiskList({ items, selectedActivityId, onSelectActivity, totalActivityCount }: BbaProjectRiskListProps) {
  return (
    <div className="bba-project-risk-list">
      {items.length === 0 ? (
        <p className="workspace-card__description">Nenhuma atividade em risco no momento.</p>
      ) : (
        items.map((item) => {
          const isSelected = item.activity.id === selectedActivityId;
          const Icon = item.isCritical ? AlertOctagon : AlertTriangle;

          return (
            <button
              className={`bba-project-risk-item${isSelected ? " bba-project-risk-item--selected" : ""}`}
              key={item.activity.id}
              onClick={() => onSelectActivity(item.activity.id)}
              type="button"
            >
              <Icon aria-hidden="true" className={item.isCritical ? "bba-project-risk-item__icon--critical" : "bba-project-risk-item__icon"} size={16} />
              <span className="bba-project-risk-item__name">
                {item.activity.code} — {item.activity.name}
              </span>
              <span className="bba-project-risk-item__confidence">{item.confidenceLabel}</span>
              {item.isCritical ? <span className="bba-project-wbs-badge bba-project-wbs-badge--critical">Caminho Crítico</span> : null}
            </button>
          );
        })
      )}
      <p className="workspace-card__note">
        {items.length} de {totalActivityCount} atividades sem verificação espacial ainda.
      </p>
    </div>
  );
}
