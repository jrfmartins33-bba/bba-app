import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { Card } from "@bba/ui";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.1B — placeholder honesto
 * para evitar um link quebrado (404) a partir de `/medicoes` antes da
 * página real do Relatório Executivo (Sprint 20.1E.2). Nenhum fetch,
 * nenhuma leitura de `analysisResult`, nenhuma chamada ao Decision
 * Brief builder -- este arquivo será substituído, não estendido, na
 * Sprint 20.1E.2.
 */
export default function MedicaoDetailPlaceholderPage() {
  return (
    <>
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">BBA Platform · Sistema Operacional de Decisão</span>
          <h1>Relatório Executivo</h1>
        </div>
        <Link className="bba-button bba-button--ghost bba-button--sm" href="/medicoes">
          <ArrowLeft size={16} /> Voltar às Medições
        </Link>
      </section>

      <section className="section-grid">
        <Card className="span-12 workspace-card" title="Relatório Executivo em construção">
          <div className="workspace-card__icon" aria-hidden="true">
            <Construction size={20} />
          </div>
          <p className="workspace-card__description">
            O Relatório Executivo da Análise do Boletim de Medição ainda está em construção para este item.
          </p>
        </Card>
      </section>
    </>
  );
}
