"use client";

import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import { BudgetErrorState } from "@/components/budget/budget-error-state";

/**
 * Epic 21, Sprint 21.4B.2 — fronteira de erro real de `/orcamentos`.
 * Next.js aplica este `error.tsx` a este segmento e a todos os
 * segmentos aninhados (incluindo `/orcamentos/demonstracao`, que não
 * tem — e não precisa de — sua própria fronteira). Nunca exibe
 * `error.message`/`error.digest` nem qualquer detalhe bruto: o texto
 * sanitizado vem inteiramente de `BudgetErrorState`. Nenhum
 * `console.log`/`console.error` aqui — evita registrar dado sensível no
 * navegador; ferramentas de observabilidade do servidor já recebem o
 * erro antes deste boundary renderizar.
 */
export default function OrcamentosErrorBoundary({ reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  return (
    <>
      <BudgetPageHeader isDemonstration={false} />
      <section className="section-grid">
        <BudgetErrorState onRetry={reset} />
      </section>
    </>
  );
}
