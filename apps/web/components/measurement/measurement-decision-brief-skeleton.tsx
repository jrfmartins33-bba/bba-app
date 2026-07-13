import { SkeletonCard } from "@bba/ui";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.2 — reflete a estrutura
 * futura do Relatório Executivo (1 bloco de conclusão + 2 linhas de
 * decisões + 3 itens críticos) sem antecipar o conteúdo real dessas
 * seções -- reaproveita `SkeletonCard` (já existente em `@bba/ui`,
 * nunca usado até esta Sprint), nenhum shimmer/spinner novo.
 */
export function MeasurementDecisionBriefSkeleton() {
  return (
    <div aria-busy="true" className="span-12 measurement-decision-brief-skeleton">
      <SkeletonCard />
      <div className="measurement-decision-brief-skeleton__row">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="measurement-decision-brief-skeleton__row">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
