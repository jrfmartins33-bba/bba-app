import { BbaProjectWorkspaceExperience } from "@/components/bba-project/bba-project-workspace-experience";

export default function BbaProjectPage() {
  return (
    <>
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">BBA Platform · Sistema Operacional de Decisão</span>
          <h1>Project Studio</h1>
          <p>O primeiro planejador de projetos orientado por decisões.</p>
        </div>
      </section>

      <section className="section-grid">
        <BbaProjectWorkspaceExperience />
      </section>
    </>
  );
}
