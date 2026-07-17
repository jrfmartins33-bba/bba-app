import { Layers, Scale, SlidersHorizontal } from "lucide-react";
import { Card } from "@bba/ui";

/**
 * Epic 21, Sprint 21.4B.1 — "O que você pode fazer aqui". "Simular outro
 * cenário" só fica habilitado quando existir, no código, um serviço
 * determinístico aprovado de simulação/transformação de desconto — hoje
 * não existe (ver ADR-003 §T.8, `packages/bdos-core`), então o card fica
 * honesto: sem botão funcional, sem cálculo inventado na interface.
 */
export function BudgetActionCards({ simulationServiceAvailable }: { readonly simulationServiceAvailable: boolean }) {
  return (
    <>
      <Card className="span-4 workspace-card" title="Revisar o orçamento">
        <div className="workspace-card__icon" aria-hidden="true">
          <Layers size={20} />
        </div>
        <p className="workspace-card__description">Consulte a estrutura por grupos, subgrupos e itens.</p>
      </Card>

      <Card className="span-4 workspace-card" title="Comparar a proposta">
        <div className="workspace-card__icon" aria-hidden="true">
          <Scale size={20} />
        </div>
        <p className="workspace-card__description">
          Veja a diferença entre o orçamento oficial e o valor apresentado.
        </p>
      </Card>

      <Card
        action={
          simulationServiceAvailable ? null : (
            <span className="status-badge status-badge--pending">Próximo passo</span>
          )
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
            : "Esta simulação ainda depende de um serviço de cálculo dedicado, que será construído em uma próxima etapa."}
        </p>
      </Card>
    </>
  );
}
