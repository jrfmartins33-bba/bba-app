import type { ReliabilityIndexResult } from "@bba/bdos-core/decision-brief";
import { describeConfidence } from "./measurement-decision-hero-view-model";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.3 — nota discreta, fora
 * do foco principal do Hero. Nunca 0%, barra vazia ou ícone de risco
 * -- indisponibilidade é uma afirmação honesta, não um valor baixo.
 */
export function MeasurementConfidenceNote({ confidence }: { confidence: ReliabilityIndexResult }) {
  return (
    <div className="measurement-confidence-note">
      <span className="measurement-confidence-note__label">Confiança da Análise</span>
      <span className="measurement-confidence-note__value">{describeConfidence(confidence)}</span>
    </div>
  );
}
