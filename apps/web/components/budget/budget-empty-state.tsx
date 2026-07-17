import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { Card } from "@bba/ui";

/**
 * Epic 21, Sprint 21.4B.1 — estado vazio de `/orcamentos`: nenhuma
 * leitura real de orçamento está disponível ainda (não existe rota de
 * servidor para `BudgetVersion` em `apps/web`), então a única ação real
 * hoje é abrir a demonstração.
 */
export function BudgetEmptyState() {
  return (
    <Card className="span-12 workspace-card" title="Nenhum orçamento disponível">
      <div className="workspace-card__icon" aria-hidden="true">
        <FolderOpen size={20} />
      </div>
      <p className="workspace-card__description">Envie ou selecione um orçamento para começar a análise.</p>
      <div className="budget-empty-state__actions">
        <Link className="bba-button bba-button--primary bba-button--sm" href="/orcamentos/demonstracao">
          Ver demonstração
        </Link>
      </div>
    </Card>
  );
}
