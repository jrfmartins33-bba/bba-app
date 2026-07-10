import Link from "next/link";
import { ArrowLeft, Building2, Filter, Plus, UploadCloud } from "lucide-react";
import { Card } from "@bba/ui";
import { buildGeospatialProductSnapshot } from "@bba/bdos-core/services/geospatial-product-integration";
import { GeospatialWorkspaceExperience } from "@/components/geospatial/geospatial-workspace-experience";
import { TIMELINE_STAGES } from "@/components/geospatial/timeline-stages";
import type { GeospatialStageViewModel } from "@/components/geospatial/geospatial-view-types";

// EPIC 05 (Spatial Experience, Release 4.0): cada estágio da Linha do
// Tempo pré-computa seu próprio snapshot real aqui, no Server
// Component — chamando a mesma `buildGeospatialProductSnapshot`
// inalterada desde a UI Sprint 17 — e passa tudo já calculado, como
// dado simples, para o único componente com estado desta tela
// (`GeospatialWorkspaceExperience`). Nenhum cálculo do BDOS acontece
// no cliente.
const STAGE_VIEW_MODELS: ReadonlyArray<GeospatialStageViewModel> = TIMELINE_STAGES.map((stage) => ({
  id: stage.id,
  label: stage.label,
  description: stage.description,
  asOf: stage.asOf,
  snapshot: buildGeospatialProductSnapshot({
    workPackages: stage.workPackages,
    tenantId: "tenant-2f-engenharia",
    organizationId: "org-lagoa-do-arroz",
    contractId: "contract-lagoa-do-arroz",
    projectId: "project-lagoa-do-arroz",
    capability: "geospatial-intelligence",
    generatedAt: "2026-07-06T09:40:00Z",
    correlationId: `geoespacial-page-snapshot-${stage.id}`,
    actor: "planning-engineer-marcos",
    occurredAt: "2026-07-05T09:00:00Z"
  })
}));

export default function GeoespacialPage() {
  return (
    <>
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">BBA Platform · Sistema Operacional de Decisão</span>
          <h1>Geo Studio</h1>
          <p>Mapa operacional da obra e evolução espacial.</p>
        </div>
        <Link className="bba-button bba-button--ghost bba-button--sm" href="/workspaces/engenharia">
          <ArrowLeft size={16} /> Voltar ao Dashboard
        </Link>
      </section>

      <section className="section-grid">
        <div className="span-12 workspace-toolbar">
          <button className="bba-button bba-button--primary bba-button--sm" type="button">
            <Plus size={16} /> Adicionar Camada
          </button>
          <button className="bba-button bba-button--secondary bba-button--sm" type="button">
            <UploadCloud size={16} /> Importar Dado Geoespacial
          </button>
          <button className="bba-button bba-button--ghost bba-button--sm" type="button">
            <Filter size={16} /> Filtrar
          </button>
        </div>

        <Card className="span-12 workspace-card" title="Contexto da Obra">
          <div className="workspace-card__icon" aria-hidden="true">
            <Building2 size={20} />
          </div>
          <dl className="workspace-fact-list">
            <div className="workspace-fact">
              <dt>Empresa</dt>
              <dd>2F Engenharia</dd>
            </div>
            <div className="workspace-fact">
              <dt>Projeto</dt>
              <dd>Recuperação e Modernização da Barragem Lagoa do Arroz – PB</dd>
            </div>
            <div className="workspace-fact">
              <dt>Contratante</dt>
              <dd>DNOCS</dd>
            </div>
            <div className="workspace-fact">
              <dt>Consórcio</dt>
              <dd>CONJASF – HIDROMEC</dd>
            </div>
            <div className="workspace-fact">
              <dt>Diretoria</dt>
              <dd>Diretoria de Infraestrutura Hídrica - DI</dd>
            </div>
          </dl>
        </Card>

        <GeospatialWorkspaceExperience stages={STAGE_VIEW_MODELS} />
      </section>
    </>
  );
}
