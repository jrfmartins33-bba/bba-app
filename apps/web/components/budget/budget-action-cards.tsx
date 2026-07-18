import { Layers, Scale, SlidersHorizontal } from "lucide-react";
import { Card } from "@bba/ui";

/**
 * Epic 21, Sprint 21.4B.1 (original) + 21.4B.3 (ação real nos dois
 * primeiros cards -- antes pareciam ações mas não levavam a lugar
 * nenhum). "Revisar o orçamento" e "Comparar a proposta" agora navegam
 * para seções reais da própria página (`#planilha-orcamentaria`/
 * `#comparacao`); o botão fica no rodapé do card
 * (`.budget-action-card__footer`, `margin-top: auto` sobre a coluna
 * flex que `.workspace-card` já é) para que os três cards fiquem com
 * altura visual equilibrada sem depender de padding vazio.
 *
 * "Simular outro cenário" só fica habilitado quando existir, no
 * código, um serviço determinístico aprovado de simulação/transformação
 * de desconto — hoje não existe (ver ADR-003 §T.8, `packages/bdos-core`),
 * então o card fica honesto: badge "Em breve", sem botão funcional, sem
 * cálculo inventado na interface, sem linguagem de implementação.
 */
export function BudgetActionCards({ simulationServiceAvailable }: { readonly simulationServiceAvailable: boolean }) {
  return (
    <>
      <Card className="span-4 workspace-card" title="Revisar o orçamento">
        <div className="workspace-card__icon" aria-hidden="true">
          <Layers size={20} />
        </div>
        <p className="workspace-card__description">Consulte a estrutura por grupos, subgrupos e itens.</p>
        <div className="budget-action-card__footer">
          <a className="bba-button bba-button--secondary bba-button--sm" href="#planilha-orcamentaria">
            Abrir planilha
          </a>
        </div>
      </Card>

      <Card className="span-4 workspace-card" title="Comparar a proposta">
        <div className="workspace-card__icon" aria-hidden="true">
          <Scale size={20} />
        </div>
        <p className="workspace-card__description">
          Veja a diferença entre o orçamento oficial e o valor apresentado.
        </p>
        <div className="budget-action-card__footer">
          <a className="bba-button bba-button--secondary bba-button--sm" href="#comparacao">
            Ver comparação
          </a>
        </div>
      </Card>

      <Card
        action={
          simulationServiceAvailable ? null : <span className="status-badge status-badge--pending">Em breve</span>
        }
        className="span-4 workspace-card"
        title="Simular outro cenário"
      >
        <div className="workspace-card__icon" aria-hidden="true">
          <SlidersHorizontal size={20} />
        </div>
        <p className="workspace-card__description">
          {simulationServiceAvailable
            ? "Explore um novo cenário de desconto antes de confirmar uma decisão."
            : "A simulação de novos cenários será disponibilizada em uma próxima etapa."}
        </p>
      </Card>
    </>
  );
}
