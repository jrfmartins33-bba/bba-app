import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import { BudgetEmptyState } from "@/components/budget/budget-empty-state";

/**
 * Epic 21, Sprint 21.4B.1 — entrada real (autenticada) da área de
 * Orçamento. Nenhuma rota/Server Action expõe `BudgetVersion` real em
 * `apps/web` ainda (ver
 * apps/web/lib/bdos/procurement-engineering-server-repository.ts,
 * "fluxo de servidor pretendido... a construir em Sprint futura") — por
 * isso esta página sempre apresenta o estado vazio real, com a
 * demonstração como única ação disponível hoje. Quando uma leitura real
 * existir, esta página passa a decidir entre o orçamento real e o
 * estado vazio, sem precisar de uma rota nova.
 */
export default function OrcamentosPage() {
  return (
    <>
      <BudgetPageHeader isDemonstration={false} />
      <section className="section-grid">
        <BudgetEmptyState />
      </section>
    </>
  );
}
