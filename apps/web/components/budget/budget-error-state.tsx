import { RotateCw } from "lucide-react";
import { Card } from "@bba/ui";

/**
 * Epic 21, Sprint 21.4B.1 — estado de erro controlado da área de
 * Orçamento, mesmo padrão sanitizado de
 * measurement-decision-brief-error-state.tsx: nenhum stack trace, código
 * interno ou mensagem crua de banco é exibido.
 */
export function BudgetErrorState({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <Card className="span-12 workspace-card" title="Não foi possível abrir o orçamento">
      <p className="workspace-card__description">
        Ocorreu um problema ao carregar esta análise. Tente novamente em instantes.
      </p>
      <button className="bba-button bba-button--secondary bba-button--sm" onClick={onRetry} type="button">
        <RotateCw size={16} /> Tentar novamente
      </button>
    </Card>
  );
}
