"use client";

import { ChevronRight } from "lucide-react";
import type { ReasoningStep } from "./bba-project-insights";

/**
 * BBA Project Studio — Sprint 2, "Linha de raciocínio" (EPIC 02, item
 * 8). Mostra visualmente a cadeia real que o BDOS já executa —
 * Planejamento → Objeto Espacial → Business Facts → Diagnosis →
 * Decision → Recommendation — com a contagem real de cada estágio.
 * Esta é a explicação mais direta do porquê um concorrente como o MS
 * Project não consegue replicar esta experiência: não existe uma
 * cadeia de decisão por trás do cronograma deles.
 */
export function BbaProjectReasoningChain({ steps }: { readonly steps: ReadonlyArray<ReasoningStep> }) {
  return (
    <div className="span-12 bba-project-reasoning-chain">
      <p className="workspace-section-label">Como cheguei nesta conclusão?</p>
      <div className="bba-project-reasoning-chain__track">
        {steps.map((step, index) => (
          <div className="bba-project-reasoning-chain__step-wrap" key={step.label}>
            <div className="bba-project-reasoning-chain__step">
              <span className="bba-project-reasoning-chain__count">{step.count}</span>
              <span className="bba-project-reasoning-chain__label">{step.label}</span>
              <span className="bba-project-reasoning-chain__description">{step.description}</span>
            </div>
            {index < steps.length - 1 ? (
              <ChevronRight aria-hidden="true" className="bba-project-reasoning-chain__arrow" size={16} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
