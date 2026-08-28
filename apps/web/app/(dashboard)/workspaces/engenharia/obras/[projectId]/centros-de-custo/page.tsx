import { Suspense } from "react";
import { ProjectCostCentersPage } from "@/components/engenharia/project-cost-centers-page";

export default function ObraCentrosDeCustoPage({
  params,
}: {
  params: { projectId: string };
}) {
  return (
    <Suspense
      fallback={
        <section className="section-grid">
          <p>Carregando Centros de Custo da obra…</p>
        </section>
      }
    >
      <ProjectCostCentersPage projectId={params.projectId} />
    </Suspense>
  );
}
