export type SpatialLayerId =
  | "planejamento"
  | "execucao"
  | "evidencias"
  | "medicoes"
  | "documentos"
  | "drone"
  | "sensores"
  | "financeiro";

export interface SpatialLayerDefinition {
  readonly id: SpatialLayerId;
  readonly label: string;
  /** Se esta camada já afeta o mapa/Advisor/KPIs de alguma forma real e simulada. */
  readonly wired: boolean;
}

/**
 * EPIC 05, Objetivo 5 — Camadas Interativas. `wired: true` marca as
 * camadas que já têm efeito real e simulado sobre o Advisor, o mapa e
 * os KPIs (ver `deriveGeospatialViewState` em
 * `geospatial-workspace-experience.tsx`). `wired: false` (Drone,
 * Sensores, Financeiro) só afeta o contador de "Camadas ativas" — não
 * há nenhum dado real por trás delas ainda, e simular um efeito
 * fingido seria inventar dado.
 */
export const SPATIAL_LAYERS: ReadonlyArray<SpatialLayerDefinition> = [
  { id: "planejamento", label: "Planejamento", wired: true },
  { id: "execucao", label: "Execução", wired: true },
  { id: "evidencias", label: "Evidências", wired: true },
  { id: "medicoes", label: "Medições", wired: true },
  { id: "documentos", label: "Documentos", wired: true },
  { id: "drone", label: "Drone", wired: false },
  { id: "sensores", label: "Sensores", wired: false },
  { id: "financeiro", label: "Financeiro", wired: false }
];

export const DEFAULT_ACTIVE_LAYER_IDS: ReadonlyArray<SpatialLayerId> = [
  "planejamento",
  "execucao",
  "evidencias",
  "medicoes",
  "documentos"
];
