import type { GeospatialProductIntegrationResult } from "@bba/bdos-core/services/geospatial-product-integration";

/**
 * Aliases derivadas do tipo de retorno real de `buildGeospatialProductSnapshot`
 * — nunca um import direto de `domain/spatial-object`, `domain/business-fact`
 * etc., que `apps/web` não pode alcançar (ver `package.json`/`tsconfig.base.json`
 * do `@bba/bdos-core`). O mesmo padrão já usado em
 * `app/(dashboard)/geoespacial/page.tsx` (Geo Studio) desde a UI Sprint 17.
 */
export type GeospatialSnapshot = GeospatialProductIntegrationResult;
export type GeospatialSpatialObject = GeospatialSnapshot["spatialObjects"][number];
export type GeospatialFact = GeospatialSnapshot["facts"][number];
export type GeospatialDecision = GeospatialSnapshot["decisions"][number];
export type GeospatialRecommendation = GeospatialSnapshot["recommendations"][number];

/**
 * Um "estágio" da Linha do Tempo (EPIC 05, Objetivo 3) — um snapshot já
 * calculado (chamando a `buildGeospatialProductSnapshot` real, no
 * Server Component) para um roster diferente de `WorkPackage`s,
 * simulando um momento diferente da obra.
 */
export interface GeospatialStageViewModel {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly asOf: string;
  readonly snapshot: GeospatialSnapshot;
}
