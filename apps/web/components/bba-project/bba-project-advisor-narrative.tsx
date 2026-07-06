"use client";

import { useState } from "react";
import { HelpCircle, Sparkles, X } from "lucide-react";
import type { AdvisorNarrative } from "./bba-project-insights";
import type { BbaProjectDecision, BbaProjectFact, BbaProjectRecommendation } from "./bba-project-view-types";

interface BbaProjectAdvisorNarrativeProps {
  readonly status: string;
  readonly narrative: AdvisorNarrative;
  readonly fact: BbaProjectFact | undefined;
  readonly decision: BbaProjectDecision | undefined;
  readonly recommendation: BbaProjectRecommendation | undefined;
}

/**
 * BBA Project Studio — Sprint 2, Advisor em narrativa (EPIC 02, item
 * 4) + Explicabilidade (item 9). O mesmo dado que alimentava o
 * accordion técnico do `DecisionInsightCard` (Sprint 1) agora vira
 * texto corrido — Situação/Motivo/Impacto/Recomendação — com um
 * painel de detalhes técnicos disponível sob demanda, nunca aberto por
 * padrão (PRINCIPLE 003 — Progressive Disclosure).
 */
export function BbaProjectAdvisorNarrative({ status, narrative, fact, decision, recommendation }: BbaProjectAdvisorNarrativeProps) {
  const [explainOpen, setExplainOpen] = useState(false);

  return (
    <div className="span-12 bba-project-advisor">
      <div className="bba-project-advisor__header">
        <div className="bba-project-advisor__identity">
          <Sparkles aria-hidden="true" size={16} />
          <span>BBA Advisor</span>
        </div>
        <span className="status-badge status-badge--active">{status}</span>
      </div>

      <div className="bba-project-advisor__narrative">
        <NarrativeBlock section={narrative.situacao} />
        <NarrativeBlock section={narrative.motivo} />
        <NarrativeBlock section={narrative.impacto} />
        <NarrativeBlock section={narrative.recomendacao} highlight />
      </div>

      <button className="bba-project-explain-trigger" onClick={() => setExplainOpen(true)} type="button">
        <HelpCircle aria-hidden="true" size={14} />
        Por que estou vendo este alerta?
      </button>

      {explainOpen ? (
        <ExplainabilityDrawer decision={decision} fact={fact} onClose={() => setExplainOpen(false)} recommendation={recommendation} />
      ) : null}
    </div>
  );
}

function NarrativeBlock({ section, highlight }: { readonly section: { title: string; body: string }; readonly highlight?: boolean }) {
  return (
    <div className={`bba-project-advisor__block${highlight ? " bba-project-advisor__block--highlight" : ""}`}>
      <span className="bba-project-advisor__block-title">{section.title}</span>
      <p className="bba-project-advisor__block-body">{section.body}</p>
    </div>
  );
}

interface ExplainabilityDrawerProps {
  readonly fact: BbaProjectFact | undefined;
  readonly decision: BbaProjectDecision | undefined;
  readonly recommendation: BbaProjectRecommendation | undefined;
  readonly onClose: () => void;
}

function ExplainabilityDrawer({ fact, decision, recommendation, onClose }: ExplainabilityDrawerProps) {
  const confidenceLevel = fact ? String(fact.metadata.spatialConfidenceLevel ?? "—") : "—";

  return (
    <div className="bba-project-drawer-overlay" onClick={onClose} role="presentation">
      <div className="bba-project-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Explicabilidade da decisão">
        <div className="bba-project-drawer__header">
          <span>Por que estou vendo este alerta?</span>
          <button aria-label="Fechar" className="bba-project-drawer__close" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>

        <div className="bba-project-drawer__section">
          <h4>Dados utilizados</h4>
          <dl className="workspace-fact-list">
            <div className="workspace-fact">
              <dt>Fonte do fato</dt>
              <dd>{fact?.source ?? "—"}</dd>
            </div>
            <div className="workspace-fact">
              <dt>Score de confiança</dt>
              <dd>{fact ? `${fact.value}/100` : "—"}</dd>
            </div>
            <div className="workspace-fact">
              <dt>Nível de confiança</dt>
              <dd>{confidenceLevel}</dd>
            </div>
          </dl>
        </div>

        <div className="bba-project-drawer__section">
          <h4>Regras aplicadas</h4>
          {recommendation && recommendation.traceability.capabilities.length > 0 ? (
            <ul>
              {recommendation.traceability.capabilities.map((capability) => (
                <li key={capability}>{capability}</li>
              ))}
            </ul>
          ) : (
            <p className="workspace-card__description">Nenhuma regra aplicada ainda para esta seleção.</p>
          )}
        </div>

        <div className="bba-project-drawer__section">
          <h4>Evidências</h4>
          <p className="workspace-card__description">
            {recommendation
              ? `${recommendation.traceability.evidenceReferences.length} referência(s) de evidência, ${recommendation.traceability.businessFactIds.length} fato(s) de negócio.`
              : "Nenhuma evidência associada ainda."}
          </p>
        </div>

        <div className="bba-project-drawer__section">
          <h4>Decisão</h4>
          <p className="workspace-card__description">{decision?.summary ?? "Nenhuma decisão aberta para esta atividade."}</p>
        </div>

        <div className="bba-project-drawer__section">
          <h4>Recomendação</h4>
          <p className="workspace-card__description">{recommendation?.summary ?? "Nenhuma recomendação pendente."}</p>
          {recommendation && recommendation.options.length > 0 ? (
            <ul className="bba-project-drawer__options">
              {recommendation.options.map((option) => (
                <li key={option.id}>
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
