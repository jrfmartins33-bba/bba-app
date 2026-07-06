"use client";

import { Sparkles } from "lucide-react";
import type { HealthScoreResult } from "./bba-project-insights";
import type { HeroNarrative } from "./bba-project-insights";

interface BbaProjectHeroProps {
  readonly narrative: HeroNarrative;
  readonly healthScore: HealthScoreResult;
  readonly onViewAnalysis: () => void;
}

/**
 * BBA Project Studio — Sprint 2, Hero Executive (EPIC 02, item 1) +
 * Health Score (item 2). A primeira coisa que o usuário vê não é o
 * cronograma — é a conclusão do Advisor, em linguagem de copiloto
 * executivo, com o placar de saúde do planejamento ao lado.
 */
export function BbaProjectHero({ narrative, healthScore, onViewAnalysis }: BbaProjectHeroProps) {
  return (
    <>
      <div className="span-8 bba-project-hero">
        <div className="bba-project-hero__badge">
          <Sparkles aria-hidden="true" size={14} />
          <span>BBA Advisor</span>
        </div>
        <p className="bba-project-hero__greeting">{narrative.greeting}</p>
        <div className="bba-project-hero__body">
          {narrative.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <button className="bba-button bba-button--primary bba-button--sm" onClick={onViewAnalysis} type="button">
          Ver análise completa
        </button>
      </div>

      <div className="span-4 bba-project-health-score" data-level={healthScore.level}>
        <span className="bba-project-health-score__label">Health Score</span>
        <span className="bba-project-health-score__value">{healthScore.score}</span>
        <span className="bba-project-health-score__status">{healthScore.label}</span>
      </div>
    </>
  );
}
