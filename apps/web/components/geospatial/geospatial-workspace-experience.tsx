"use client";

import { useState } from "react";
import { CheckSquare, Clock, Layers, Map as MapIcon, MapPin, Square } from "lucide-react";
import { Card, DecisionInsightCard, ProgressBar, type DecisionInsightCardSection } from "@bba/ui";
import { PlaceholderSpatialMapView } from "./geospatial-map-view";
import type { SpatialMapObjectViewModel } from "./map-adapter";
import { DEFAULT_ACTIVE_LAYER_IDS, SPATIAL_LAYERS, type SpatialLayerId } from "./spatial-layers";
import type {
  GeospatialFact,
  GeospatialStageViewModel
} from "./geospatial-view-types";

/**
 * EPIC 05 — Spatial Experience (Release 4.0). Único componente com
 * estado nesta tela — todo local (`useState`), nada global — que
 * conecta o mapa, o BBA Advisor, a Linha do Tempo, as Camadas, os KPIs
 * e o Painel Executivo em torno de um único snapshot já calculado por
 * estágio (recebido via `stages`, computado no Server Component
 * chamando `buildGeospatialProductSnapshot` — nunca aqui). Nenhuma
 * regra de decisão, fato de negócio ou recomendação nova é criada
 * neste arquivo: tudo já vem pronto da cadeia real (Sprints 9-17).
 */

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

function getFactStringMetadata(fact: GeospatialFact, key: string): string | null {
  const value = fact.metadata[key];
  return typeof value === "string" ? value : null;
}

function getFactWarningLabels(fact: GeospatialFact): string[] {
  const value = fact.metadata.spatialConfidenceWarningCodes;
  const codes = Array.isArray(value) ? (value as string[]) : [];
  return codes.map((code) => WARNING_CODE_LABELS[code] ?? code);
}

interface GeospatialWorkspaceExperienceProps {
  readonly stages: ReadonlyArray<GeospatialStageViewModel>;
}

export function GeospatialWorkspaceExperience({ stages }: GeospatialWorkspaceExperienceProps) {
  const [selectedStageId, setSelectedStageId] = useState<string>(stages[0]?.id ?? "");
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activeLayerIds, setActiveLayerIds] = useState<ReadonlySet<SpatialLayerId>>(
    () => new Set(DEFAULT_ACTIVE_LAYER_IDS)
  );

  const stageIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.id === selectedStageId)
  );
  const currentStage = stages[stageIndex] ?? null;

  const planningActive = activeLayerIds.has("planejamento");
  const executionActive = activeLayerIds.has("execucao");
  const evidenceActive = activeLayerIds.has("evidencias");
  const measurementActive = activeLayerIds.has("medicoes");
  const documentsActive = activeLayerIds.has("documentos");

  // Objetivo 5: desligar a camada de Planejamento remove o único dado
  // real que a cadeia produz hoje — uma simulação honesta, não uma
  // camada inventada.
  const visibleSpatialObjects = planningActive ? currentStage?.snapshot.spatialObjects ?? [] : [];
  const visibleFacts = planningActive ? currentStage?.snapshot.facts ?? [] : [];
  const visibleDecisions = planningActive ? currentStage?.snapshot.decisions ?? [] : [];
  const visibleRecommendations = planningActive ? currentStage?.snapshot.recommendations ?? [] : [];

  // Sempre uma dezena de objetos no máximo — recomputar a cada render
  // é mais barato do que manter dependências de useMemo estáveis para
  // arrays derivados condicionalmente.
  const mapObjects: SpatialMapObjectViewModel[] = visibleSpatialObjects.map((spatialObject) => ({
    id: spatialObject.id,
    label: spatialObject.label,
    kind: spatialObject.kind,
    riskLevel: visibleDecisions.some((decision) => decision.evidence[0]?.sourceReference === spatialObject.id)
      ? ("attention" as const)
      : ("none" as const)
  }));

  // Objetivo 2: o mapa comanda o Advisor. Sem seleção — ou uma seleção
  // que não existe mais neste estágio/camada — cai no primeiro objeto
  // disponível, nunca em um estado inconsistente.
  const effectiveSelectedId =
    selectedObjectId !== null && mapObjects.some((object) => object.id === selectedObjectId)
      ? selectedObjectId
      : mapObjects[0]?.id ?? null;

  const selectedSpatialObject =
    visibleSpatialObjects.find((spatialObject) => spatialObject.id === effectiveSelectedId) ?? null;
  const selectedFact = visibleFacts.find((fact) => fact.sourceReference === effectiveSelectedId) ?? null;
  const selectedDecision =
    visibleDecisions.find((decision) => decision.evidence[0]?.sourceReference === effectiveSelectedId) ?? null;
  const selectedRecommendation =
    visibleRecommendations.find((recommendation) => recommendation.decisionId === selectedDecision?.id) ?? null;

  const warningLabels = selectedFact ? getFactWarningLabels(selectedFact) : [];
  const confidenceLevel = selectedFact ? getFactStringMetadata(selectedFact, "spatialConfidenceLevel") : null;

  const advisorStatus = visibleDecisions.length > 0 ? "🟡 Requer atenção" : "🟢 Sem pendências";

  const advisorMessage: string[] = !planningActive
    ? ["A camada de Planejamento está desativada.", "Nenhum dado espacial disponível no momento."]
    : visibleDecisions.length > 0
      ? [
          `Analisei a base espacial de ${currentStage?.label ?? "obra"}.`,
          `Encontrei ${visibleDecisions.length} ponto${visibleDecisions.length > 1 ? "s" : ""} que merece${
            visibleDecisions.length > 1 ? "m" : ""
          } sua atenção.`
        ]
      : ["Analisei a base espacial das frentes de execução.", "Nenhum ponto crítico foi identificado no momento."];

  const sections: DecisionInsightCardSection[] = [
    {
      title: "Onde está o desvio?",
      placeholder: selectedSpatialObject?.label ?? "Nenhum objeto espacial selecionado."
    },
    {
      title: "O que está causando?",
      placeholder: !executionActive
        ? "Camada de Execução desativada — motivo indisponível."
        : warningLabels.length > 0
          ? `${warningLabels.join("; ")}.`
          : "Aguardando análise das causas."
    },
    {
      title: "Qual o impacto?",
      placeholder: !measurementActive
        ? "Camada de Medições desativada — impacto indisponível."
        : selectedDecision
          ? `Impacto categórico: ${selectedDecision.impact} (ainda não quantificado em prazo ou custo).`
          : "Aguardando cálculo de impacto."
    },
    {
      title: "Quais evidências suportam?",
      placeholder: !evidenceActive
        ? "Camada de Evidências desativada."
        : selectedFact
          ? `Confiança espacial avaliada em ${selectedFact.value}/100, a partir da fonte "${selectedFact.source}".`
          : "Aguardando integração com os módulos operacionais."
    },
    {
      title: "Qual a ação recomendada?",
      placeholder: !documentsActive
        ? "Camada de Documentos desativada — recomendação indisponível."
        : (selectedRecommendation?.summary ?? "Será gerada automaticamente pelo BBA Advisor.")
    },
    {
      title: "Nível de confiança",
      placeholder:
        confidenceLevel && selectedFact
          ? `${confidenceLevel} (score ${selectedFact.value}/100).`
          : "Será calculado automaticamente conforme a quantidade e qualidade das evidências disponíveis."
    }
  ];

  const activeLayersCount = SPATIAL_LAYERS.filter((layer) => activeLayerIds.has(layer.id)).length;
  // Estimativa ilustrativa proporcional à contagem de objetos — ainda
  // não há geometria real por trás desta métrica (ver Capítulo 1 do
  // GDR / GEOSPATIAL_ENGINE.md), mas ela já reage ao estado real.
  const areaMonitoradaKm2 = (visibleSpatialObjects.length * 3.1).toFixed(1);

  const kpis = [
    { icon: MapIcon, value: `${areaMonitoradaKm2} km²`, label: "Área monitorada" },
    { icon: MapPin, value: visibleSpatialObjects.length, label: "Objetos espaciais" },
    { icon: Layers, value: activeLayersCount, label: "Camadas ativas" },
    { icon: Clock, value: currentStage?.asOf ?? "—", label: "Última atualização" }
  ];

  function selectStage(stageId: string) {
    setSelectedStageId(stageId);
    setSelectedObjectId(null);
  }

  function toggleLayer(layerId: SpatialLayerId) {
    setActiveLayerIds((current) => {
      const next = new Set(current);

      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }

      return next;
    });
  }

  return (
    <>
      <Card className="span-8 workspace-card" title="Mapa da Obra">
        <PlaceholderSpatialMapView
          objects={mapObjects}
          onSelectObject={setSelectedObjectId}
          selectedObjectId={effectiveSelectedId}
        />
      </Card>

      <Card className="span-4 workspace-card" title="Camadas">
        <div className="workspace-layer-list">
          {SPATIAL_LAYERS.map((layer) => {
            const active = activeLayerIds.has(layer.id);

            return (
              <button
                className={
                  active
                    ? "workspace-layer workspace-layer--active workspace-layer--interactive"
                    : "workspace-layer workspace-layer--interactive"
                }
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                type="button"
              >
                {active ? (
                  <CheckSquare aria-hidden="true" className="workspace-layer__icon" size={16} />
                ) : (
                  <Square aria-hidden="true" className="workspace-layer__icon" size={16} />
                )}
                {layer.label}
                {!layer.wired ? <span className="workspace-layer__badge">sem fonte real</span> : null}
              </button>
            );
          })}
        </div>
        <p className="workspace-card__note">
          {activeLayersCount} de {SPATIAL_LAYERS.length} camadas ativas — desative &ldquo;Planejamento&rdquo; para
          ver o mapa e o Advisor esvaziarem.
        </p>
      </Card>

      <Card className="span-12 workspace-card" title="Linha do Tempo">
        <div className="timeline-stage-list">
          {stages.map((stage, index) => (
            <button
              className={stage.id === currentStage?.id ? "timeline-stage timeline-stage--active" : "timeline-stage"}
              key={stage.id}
              onClick={() => selectStage(stage.id)}
              type="button"
            >
              <span className="timeline-stage__index">{index + 1}</span>
              <span className="timeline-stage__label">{stage.label}</span>
            </button>
          ))}
        </div>
        <p className="workspace-card__note">{currentStage?.description}</p>
        <ProgressBar
          animated
          color="gold"
          label={`Estágio ${stageIndex + 1} de ${stages.length}`}
          value={((stageIndex + 1) / stages.length) * 100}
        />
        <dl className="workspace-fact-list">
          <div className="workspace-fact">
            <dt>Estágio atual</dt>
            <dd>{currentStage?.label}</dd>
          </div>
          <div className="workspace-fact">
            <dt>Última atualização</dt>
            <dd>{currentStage?.asOf}</dd>
          </div>
        </dl>
      </Card>

      <DecisionInsightCard
        className="span-12"
        engineLabel="Geospatial Engine"
        message={advisorMessage}
        sections={sections}
        status={advisorStatus}
      />

      <Card className="span-12 workspace-card" title="Painel Executivo">
        {visibleDecisions.length === 0 ? (
          <p className="workspace-card__description">Não há riscos espaciais relevantes neste momento.</p>
        ) : (
          <dl className="workspace-fact-list">
            <div className="workspace-fact">
              <dt>Status</dt>
              <dd>{advisorStatus}</dd>
            </div>
            <div className="workspace-fact">
              <dt>Quantidade de riscos</dt>
              <dd>{visibleDecisions.length}</dd>
            </div>
            <div className="workspace-fact">
              <dt>Objeto selecionado</dt>
              <dd>{selectedSpatialObject?.label ?? "Nenhum"}</dd>
            </div>
            <div className="workspace-fact">
              <dt>Confiança</dt>
              <dd>{confidenceLevel ?? "—"}</dd>
            </div>
            <div className="workspace-fact">
              <dt>Ação prioritária</dt>
              <dd>{selectedRecommendation?.summary ?? "—"}</dd>
            </div>
          </dl>
        )}
      </Card>

      {kpis.map((item) => {
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
    </>
  );
}
