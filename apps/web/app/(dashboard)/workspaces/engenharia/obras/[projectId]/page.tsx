import { Suspense } from "react";
import { ProjectExecutiveOverviewPage } from "@/components/engenharia/project-executive-overview-page";

export default function ObraExecutivePage({
  params,
}: {
  params: { projectId: string };
}) {
  return (
    <Suspense
      fallback={
        <section className="section-grid">
          <p>Carregando visão executiva da obra…</p>
        </section>
      }
    >
      <ProjectExecutiveOverviewPage projectId={params.projectId} />
    </Suspense>
  );
}
