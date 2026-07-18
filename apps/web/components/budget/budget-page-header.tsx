import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Epic 21, Sprint 21.4B.1 — cabeçalho human-first da área de Orçamento.
 * `isDemonstration` controla apenas o badge/aviso "Demonstração": nunca
 * escondido em tooltip, sempre visível na primeira dobra (ver
 * HUMAN_FIRST_VISUAL_UX.md, honestidade de estado).
 */
export function BudgetPageHeader({ isDemonstration }: { readonly isDemonstration: boolean }) {
  return (
    <section className="page-header">
      <div>
        <span className="workspaces-eyebrow">BBA Platform · Sistema Operacional de Decisão</span>
        <div className="workspace-header-title">
          <h1>Orçamento da obra</h1>
          {isDemonstration ? <span className="status-badge status-badge--pending">Demonstração</span> : null}
        </div>
        <p>Entenda o orçamento oficial, compare a proposta e consulte como os itens estão organizados.</p>
        {isDemonstration ? (
          <p className="budget-demo-note">
            Esta é uma demonstração da experiência de orçamento. Nenhuma versão definitiva será
            criada sem revisão e confirmação.
          </p>
        ) : null}
      </div>
      <Link className="bba-button bba-button--ghost bba-button--sm" href="/workspaces/engenharia">
        <ArrowLeft size={16} /> Voltar ao Workspace Engenharia
      </Link>
    </section>
  );
}
