import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { Card } from "@bba/ui";

/**
 * Epic 21, Sprint 21.4B.1 (corrigido em 21.4B.2) — estado vazio de
 * Estado vazio da experiência real. A importação permanece sempre
 * descobrível; a demonstração continua disponível como apoio interno.
 */
export function BudgetEmptyState() {
  return (
    <Card className="span-12 workspace-card" title="Nenhum orçamento preparado">
      <div className="workspace-card__icon" aria-hidden="true">
        <FolderOpen size={20} />
      </div>
      <p className="workspace-card__description">
        Ainda não há um orçamento preparado para este projeto. Você pode importar a planilha oficial do orçamento ou abrir a demonstração.
      </p>
      <div className="budget-empty-state__actions" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <Link className="bba-button bba-button--primary bba-button--sm" href="/orcamentos/importar">
          Importar orçamento
        </Link>
        <Link className="bba-button bba-button--secondary bba-button--sm" href="/orcamentos/demonstracao">
          Ver demonstração
        </Link>
      </div>
    </Card>
  );
}
