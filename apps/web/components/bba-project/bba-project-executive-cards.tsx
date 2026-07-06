"use client";

import type { CSSProperties } from "react";
import { AlertTriangle, CalendarClock, Gauge, ListChecks, ShieldAlert, TrendingUp } from "lucide-react";

export interface ExecutiveCardsData {
  readonly durationDays: number | null;
  readonly activityCount: number;
  readonly riskCount: number;
  readonly plannedPercent: number | null;
  readonly actualPercent: number | null;
  readonly confidenceLabel: string | null;
}

/**
 * BBA Project Studio — Sprint 2, Executive Cards (EPIC 02, item 3).
 * Seis números executivos, todos derivados do snapshot já calculado —
 * nenhum valor é hardcoded ou recalculado aqui.
 */
export function BbaProjectExecutiveCards({ data }: { readonly data: ExecutiveCardsData }) {
  const cards = [
    { icon: CalendarClock, label: "Prazo", value: data.durationDays !== null ? `${data.durationDays} dias` : "—" },
    { icon: ListChecks, label: "Atividades", value: String(data.activityCount) },
    { icon: AlertTriangle, label: "Em risco", value: String(data.riskCount) },
    { icon: TrendingUp, label: "Curva S", value: data.plannedPercent !== null ? `${data.plannedPercent}%` : "—" },
    { icon: Gauge, label: "Executado", value: data.actualPercent !== null ? `${data.actualPercent}%` : "—" },
    { icon: ShieldAlert, label: "Confiança", value: data.confidenceLabel ?? "—" }
  ];

  return (
    <div className="span-12 bba-project-executive-cards">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            className="bba-project-executive-card"
            key={card.label}
            style={{ "--stagger": index } as CSSProperties}
          >
            <Icon aria-hidden="true" className="bba-project-executive-card__icon" size={16} />
            <span className="bba-project-executive-card__value">{card.value}</span>
            <span className="bba-project-executive-card__label">{card.label}</span>
          </div>
        );
      })}
    </div>
  );
}
