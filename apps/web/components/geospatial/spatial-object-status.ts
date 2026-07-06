/**
 * EPIC 06 — Operational Visual Intelligence (Release 5.0), Objetivo 4.
 * Única fonte de verdade para o status visual de um objeto espacial —
 * usada pelo mapa esquemático, pelo Advisor (via destaque de seleção)
 * e pelo Painel Executivo, para que os três nunca divirjam sobre o que
 * uma cor significa. A cor é sempre derivada de
 * `spatialConfidenceLevel` (o dado real calculado por
 * `evaluateSpatialConfidence` em `packages/bdos-core`) — nunca fixada
 * por id ou nome de objeto.
 */
export type SpatialObjectStatusLevel = "healthy" | "attention" | "risk" | "critical" | "unknown";

export interface SpatialObjectStatusMeta {
  readonly level: SpatialObjectStatusLevel;
  readonly emoji: string;
  readonly label: string;
  readonly cssVariable: string;
}

const STATUS_META: Record<SpatialObjectStatusLevel, SpatialObjectStatusMeta> = {
  healthy: { level: "healthy", emoji: "🟢", label: "Saudável", cssVariable: "--status-green" },
  attention: { level: "attention", emoji: "🟡", label: "Atenção", cssVariable: "--status-amber" },
  risk: { level: "risk", emoji: "🟠", label: "Risco", cssVariable: "--status-orange" },
  critical: { level: "critical", emoji: "🔴", label: "Crítico", cssVariable: "--status-red" },
  unknown: { level: "unknown", emoji: "⚪", label: "Sem informação", cssVariable: "--text-muted" }
};

export function getSpatialObjectStatusMeta(level: SpatialObjectStatusLevel): SpatialObjectStatusMeta {
  return STATUS_META[level];
}

/**
 * Mapeia o `spatialConfidenceLevel` real (Low/Medium/High/Verified —
 * ver `domain/spatial-object/spatial-confidence.ts`) para um dos 5
 * estados visuais. `null` (nenhum fato disponível para o objeto) vira
 * "unknown" — nunca inventamos uma confiança que não foi calculada.
 */
export function deriveSpatialObjectStatusLevel(confidenceLevel: string | null): SpatialObjectStatusLevel {
  switch (confidenceLevel) {
    case "Verified":
      return "healthy";
    case "High":
      return "attention";
    case "Medium":
      return "risk";
    case "Low":
      return "critical";
    default:
      return "unknown";
  }
}
