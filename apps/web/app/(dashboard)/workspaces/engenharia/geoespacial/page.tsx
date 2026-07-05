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

interface GeospatialKpi {
  icon: LucideIcon;
  value: string | number;
  label: string;
}

const KPIS: GeospatialKpi[] = [
  { icon: Map, value: "12,4 km²", label: "Área monitorada" },
  { icon: MapPin, value: 148, label: "Objetos espaciais" },
  { icon: Layers, value: ACTIVE_LAYER_COUNT, label: "Camadas ativas" },
  { icon: Clock, value: "05/07/2026 · 09:40", label: "Última atualização" }
];

// Nenhum Engine alimenta esta análise ainda — ver PRINCIPLE 001 (Full
// Traceability) em packages/bdos-core/docs/BDS_ARCHITECTURE_PRINCIPLES.md.
// Mesmos placeholders do padrão oficial (BBA Advisor UX Pattern) — nenhum
// dado ou conclusão inventada.
const DECISION_SECTIONS: DecisionInsightCardSection[] = [
  { title: "Onde está o desvio?", placeholder: "Aguardando identificação automática." },
  { title: "O que está causando?", placeholder: "Aguardando análise das causas." },
  { title: "Qual o impacto?", placeholder: "Aguardando cálculo de impacto." },
  {
    title: "Quais evidências suportam?",
    placeholder: "Aguardando integração com os módulos operacionais."
  },
  { title: "Qual a ação recomendada?", placeholder: "Será gerada automaticamente pelo BBA Advisor." },
  {
    title: "Nível de confiança",
    placeholder:
      "Será calculado automaticamente conforme a quantidade e qualidade das evidências disponíveis."
  }
];

const ADVISOR_MESSAGE = ["O mapa operacional está pronto para receber dados geoespaciais."];

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
          status="Informativo"
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
