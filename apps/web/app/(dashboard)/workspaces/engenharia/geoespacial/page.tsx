import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckSquare,
  Clock,
  Filter,
  Layers,
  Map,
  MapPin,
  Plus,
  Square,
  UploadCloud,
  type LucideIcon
} from "lucide-react";
import { Card, DecisionInsightCard, ProgressBar, type DecisionInsightCardSection } from "@bba/ui";
import {
  buildGeospatialProductSnapshot,
  WorkPackageType,
  type GeospatialWorkPackageInput
} from "@bba/bdos-core/services/geospatial-product-integration";

interface SpatialLayer {
  label: string;
  active: boolean;
}

// As 5 primeiras camadas já refletem dado produzido por Engines já
// implementados (Planning, Execution, Evidence, Measurement, Document);
// Drone, Sensores e Financeiro ainda não têm origem de dado conectada
// nesta fase do MVP — daí o checklist misto.
const SPATIAL_LAYERS: SpatialLayer[] = [
  { label: "Planejamento", active: true },
  { label: "Execução", active: true },
  { label: "Evidências", active: true },
  { label: "Medições", active: true },
  { label: "Documentos", active: true },
  { label: "Drone", active: false },
  { label: "Sensores", active: false },
  { label: "Financeiro", active: false }
];

const ACTIVE_LAYER_COUNT = SPATIAL_LAYERS.filter((layer) => layer.active).length;

const TEMPORAL_COVERAGE_PERCENT = 35;

// UI Sprint 17 (EPIC 04 / Release 3.1): as frentes de execução abaixo
// ainda são mock — não há Supabase/API alimentando esta tela ainda —
// mas, a partir daqui, o cálculo é 100% real: `buildGeospatialProductSnapshot`
// (@bba/bdos-core/services/geospatial-product-integration) executa a
// mesma cadeia SpatialObject → BusinessFact → Diagnosis → Decision →
// Recommendation já provada nas Sprints 9-16. Esta página nunca importa
// domain/spatial-object, engines/decision ou capabilities/geospatial-intelligence
// diretamente — só este serviço.
const WORK_PACKAGES: GeospatialWorkPackageInput[] = [
  {
    id: "wp-frente-a",
    code: "FR-A",
    name: "Frente A — Fundação da Comporta",
    type: WorkPackageType.ExecutionFront,
    sequence: 1
  }
];

const SNAPSHOT = buildGeospatialProductSnapshot({
  workPackages: WORK_PACKAGES,
  tenantId: "tenant-2f-engenharia",
  organizationId: "org-lagoa-do-arroz",
  contractId: "contract-lagoa-do-arroz",
  projectId: "project-lagoa-do-arroz",
  capability: "geospatial-intelligence",
  generatedAt: "2026-07-06T09:40:00Z",
  correlationId: "geoespacial-page-snapshot-001",
  actor: "planning-engineer-marcos",
  occurredAt: "2026-07-05T09:00:00Z"
});

const WORK_PACKAGE_NAMES: Record<string, string> = Object.fromEntries(
  WORK_PACKAGES.map((workPackage) => [`spatial-object:work-package:${workPackage.id}`, workPackage.name])
);

// Traduz os códigos determinísticos de `evaluateSpatialConfidence`
// (packages/bdos-core/src/domain/spatial-object/spatial-confidence.ts)
// para texto legível — nenhuma causa é inventada aqui, apenas os
// mesmos códigos reais recebem um rótulo em português.
const WARNING_CODE_LABELS: Record<string, string> = {
  no_current_geometry: "nenhuma geometria de campo registrada ainda",
  current_geometry_low_precision: "geometria atual com baixa precisão",
  single_geometry_version: "geometria nunca foi refinada por uma segunda medição",
  single_layer_attached: "apenas uma camada de dado anexada até agora",
  no_evidential_layer: "nenhuma evidência de campo anexada"
};

type GeospatialFact = (typeof SNAPSHOT)["facts"][number];

function getFactStringMetadata(fact: GeospatialFact, key: string): string | null {
  const value = fact.metadata[key];
  return typeof value === "string" ? value : null;
}

function getFactWarningLabels(fact: GeospatialFact): string[] {
  const value = fact.metadata.spatialConfidenceWarningCodes;
  const codes = Array.isArray(value) ? (value as string[]) : [];
  return codes.map((code) => WARNING_CODE_LABELS[code] ?? code);
}

const primaryFact = SNAPSHOT.facts[0] ?? null;
const primaryDecision = SNAPSHOT.decisions[0] ?? null;
const primaryRecommendation = SNAPSHOT.recommendations[0] ?? null;

const primaryPlaceName = primaryFact
  ? (WORK_PACKAGE_NAMES[primaryFact.sourceReference] ?? primaryFact.sourceReference)
  : null;
const primaryWarningLabels = primaryFact ? getFactWarningLabels(primaryFact) : [];
const primaryConfidenceLevel = primaryFact ? getFactStringMetadata(primaryFact, "spatialConfidenceLevel") : null;

const ADVISOR_STATUS = primaryDecision ? "🟡 Requer atenção" : "🟢 Sem pendências";

const ADVISOR_MESSAGE = primaryDecision
  ? [
      "Analisei a base espacial das frentes de execução.",
      `Encontrei ${SNAPSHOT.decisions.length} ponto${SNAPSHOT.decisions.length > 1 ? "s" : ""} que merece${SNAPSHOT.decisions.length > 1 ? "m" : ""} sua atenção.`
    ]
  : ["Analisei a base espacial das frentes de execução.", "Nenhum ponto crítico foi identificado no momento."];

const DECISION_SECTIONS: DecisionInsightCardSection[] = [
  {
    title: "Onde está o desvio?",
    placeholder: primaryPlaceName ?? "Aguardando identificação automática."
  },
  {
    title: "O que está causando?",
    placeholder:
      primaryWarningLabels.length > 0
        ? `${primaryWarningLabels.join("; ")}.`
        : "Aguardando análise das causas."
  },
  {
    title: "Qual o impacto?",
    placeholder: primaryDecision
      ? `Impacto categórico: ${primaryDecision.impact} (ainda não quantificado em prazo ou custo).`
      : "Aguardando cálculo de impacto."
  },
  {
    title: "Quais evidências suportam?",
    placeholder: primaryFact
      ? `Confiança espacial avaliada em ${primaryFact.value}/100, a partir da fonte "${primaryFact.source}".`
      : "Aguardando integração com os módulos operacionais."
  },
  {
    title: "Qual a ação recomendada?",
    placeholder: primaryRecommendation?.summary ?? "Será gerada automaticamente pelo BBA Advisor."
  },
  {
    title: "Nível de confiança",
    placeholder:
      primaryConfidenceLevel && primaryFact
        ? `${primaryConfidenceLevel} (score ${primaryFact.value}/100).`
        : "Será calculado automaticamente conforme a quantidade e qualidade das evidências disponíveis."
  }
];

interface GeospatialKpi {
  icon: LucideIcon;
  value: string | number;
  label: string;
}

const KPIS: GeospatialKpi[] = [
  { icon: Map, value: "12,4 km²", label: "Área monitorada" },
  { icon: MapPin, value: SNAPSHOT.spatialObjects.length, label: "Objetos espaciais" },
  { icon: Layers, value: ACTIVE_LAYER_COUNT, label: "Camadas ativas" },
  { icon: Clock, value: "05/07/2026 · 09:40", label: "Última atualização" }
];

export default function GeoespacialPage() {
  return (
    <>
      <section className="page-header">
        <div>
          <span className="workspaces-eyebrow">BBA Platform · Operational Decision Platform</span>
          <h1>Geoespacial</h1>
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

        <Card className="span-8 workspace-card" title="Mapa da Obra">
          <div className="workspace-map-placeholder">
            <div className="workspace-map-placeholder__icon" aria-hidden="true">
              <Map size={22} />
            </div>
            <p className="workspace-map-placeholder__text">Mapa geoespacial será carregado aqui.</p>
            <p className="workspace-map-placeholder__caption">
              Espaço reservado para integração futura com Google Maps, Mapbox, CesiumJS ou OpenLayers.
            </p>
          </div>
        </Card>

        <Card className="span-4 workspace-card" title="Camadas">
          <div className="workspace-layer-list">
            {SPATIAL_LAYERS.map((layer) => (
              <div
                className={layer.active ? "workspace-layer workspace-layer--active" : "workspace-layer"}
                key={layer.label}
              >
                {layer.active ? (
                  <CheckSquare aria-hidden="true" className="workspace-layer__icon" size={16} />
                ) : (
                  <Square aria-hidden="true" className="workspace-layer__icon" size={16} />
                )}
                {layer.label}
              </div>
            ))}
          </div>
          <p className="workspace-card__note">
            {ACTIVE_LAYER_COUNT} de {SPATIAL_LAYERS.length} camadas disponíveis nesta fase do MVP.
          </p>
        </Card>

        <Card className="span-12 workspace-card" title="Linha do Tempo">
          <p className="workspace-section-label">Cobertura Temporal</p>
          <ProgressBar
            animated
            color="gold"
            label={`${TEMPORAL_COVERAGE_PERCENT}% do período da obra com registro espacial`}
            value={TEMPORAL_COVERAGE_PERCENT}
          />
          <dl className="workspace-fact-list">
            <div className="workspace-fact">
              <dt>Primeiro registro espacial</dt>
              <dd>03/07/2026</dd>
            </div>
            <div className="workspace-fact">
              <dt>Registro mais recente</dt>
              <dd>05/07/2026</dd>
            </div>
          </dl>
        </Card>

        <DecisionInsightCard
          className="span-12"
          engineLabel="Geospatial Engine"
          message={ADVISOR_MESSAGE}
          sections={DECISION_SECTIONS}
          status={ADVISOR_STATUS}
        />

        {KPIS.map((item) => {
          const Icon = item.icon;

          return (
            <Card className="span-3" key={item.label}>
              <div className="metric">
                <span className="metric__icon">
                  <Icon size={20} />
                </span>
                <div>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </section>
    </>
  );
}
