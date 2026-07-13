import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MeasurementImportsPage } from "@/components/measurement/measurement-imports-page";

export default function MedicoesPage() {
  return (
    <>
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">BBA Platform · Sistema Operacional de Decisão</span>
          <h1>Medições</h1>
          <p>Acompanhe os Boletins de Medição e acesse suas análises executivas.</p>
        </div>
        <Link className="bba-button bba-button--ghost bba-button--sm" href="/workspaces/engenharia">
          <ArrowLeft size={16} /> Voltar ao Workspace Engenharia
        </Link>
      </section>

      <section className="section-grid">
        <MeasurementImportsPage />
      </section>
    </>
  );
}
