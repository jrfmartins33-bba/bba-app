import Link from "next/link";
import { Card } from "@bba/ui";

/**
 * Epic 21, Sprint 21.4B.2 (original) + 21.4B.3 (renomeado de "Próxima
 * decisão" para "Próximo passo"; virou faixa horizontal compacta no
 * desktop -- título e texto à esquerda, botões à direita, alinhamento
 * vertical central -- em vez de um bloco de largura total cuja única
 * ação real era voltar à planilha). Fecha a jornada da primeira
 * experiência com duas ações honestas (nenhuma simula um pipeline ou
 * processamento que não existe nesta Sprint).
 */
export function BudgetNextDecisionSection() {
  return (
    <Card className="span-12 workspace-card workspace-card--highlight budget-next-decision" title="Próximo passo">
      <div className="budget-next-decision__row">
        <p className="workspace-card__description budget-next-decision__text">
          Consulte os grupos e itens da amostra ou compare a proposta antes de criar uma versão
          definitiva.
        </p>
        <div className="budget-next-decision__actions">
          <a className="bba-button bba-button--primary bba-button--sm" href="#planilha-orcamentaria">
            Revisar planilha
          </a>
          <Link className="bba-button bba-button--ghost bba-button--sm" href="/workspaces/engenharia">
            Voltar ao Workspace Engenharia
          </Link>
        </div>
      </div>
    </Card>
  );
}
