import Link from "next/link";
import { Card } from "@bba/ui";

/**
 * Epic 21, Sprint 21.4B.1 — bloco destacado "Próxima decisão", fechando a
 * jornada da primeira experiência com duas ações honestas (nenhuma
 * simula um pipeline ou processamento que não existe nesta Sprint).
 */
export function BudgetNextDecisionSection() {
  return (
    <Card className="span-12 workspace-card workspace-card--highlight" title="Próxima decisão">
      <p className="workspace-card__description">
        Explore a comparação e entenda como o BDOS organiza o orçamento antes da criação da versão
        definitiva.
      </p>
      <div className="budget-next-decision__actions">
        <a className="bba-button bba-button--primary bba-button--sm" href="#comparacao">
          Explorar orçamento
        </a>
        <Link className="bba-button bba-button--ghost bba-button--sm" href="/workspaces/engenharia">
          Voltar ao Workspace Engenharia
        </Link>
      </div>
    </Card>
  );
}
