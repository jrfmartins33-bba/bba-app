"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBbaStore } from "@bba/lib";
import type { DecisionBrief } from "@bba/bdos-core/decision-brief";
import { fetchMeasurementDecisionBrief } from "./measurement-decision-brief-client";
import { MeasurementDecisionBriefHeader } from "./measurement-decision-brief-header";
import { MeasurementDecisionBriefSkeleton } from "./measurement-decision-brief-skeleton";
import { MeasurementDecisionBriefErrorState, type MeasurementDecisionBriefErrorVariant } from "./measurement-decision-brief-error-state";
import { MeasurementDecisionHero } from "./measurement-decision-hero";
import { MeasurementDecisionFlowSection } from "./measurement-decision-flow-section";
import { MeasurementKeyDecisionsSection } from "./measurement-key-decisions-section";
import { MeasurementCriticalItemsSection } from "./measurement-critical-items-section";
import { MeasurementRecommendedActionsSection } from "./measurement-recommended-actions-section";
import { MeasurementSummarySection } from "./measurement-summary-section";
import { MeasurementDetailsSection } from "./measurement-details-section";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.2 (page shell/estados) +
 * 20.1E.3 (Decision Hero, Principais Decisões, Ações Recomendadas) +
 * 20.1E.4 (Itens Críticos) + 20.1E.5 (Medições, Detalhamento) +
 * 20.1E.6 (padrão visual human-first, PRINCIPLE 008 -- protótipo
 * validado com a fixture real do BM_08, aprovado antes desta
 * implementação). Ordem final: Hero, Como chegamos aqui, Caminho
 * recomendado, O que precisa de atenção (Itens Críticos), Ações
 * Recomendadas, Visão Executiva, Detalhamento -- Itens Críticos agora
 * precede Ações Recomendadas (invertido em relação às Sprints
 * anteriores), decisão do protótipo aprovado, não um ajuste
 * incidental. Carrega o `DecisionBrief` via
 * `GET /api/measurement/imports/[id]/decision-brief`, trata todos os
 * resultados HTTP e apresenta o Brief completo, campo a campo,
 * exatamente como entregue.
 */

type PageState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly brief: DecisionBrief }
  | { readonly status: MeasurementDecisionBriefErrorVariant };

export function MeasurementDecisionBriefPage({ measurementBulletinImportId }: { measurementBulletinImportId: string }) {
  const router = useRouter();
  const signOut = useBbaStore((state) => state.signOut);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const requestInFlight = useRef(false);

  const load = useCallback(async () => {
    if (requestInFlight.current) {
      return;
    }
    requestInFlight.current = true;
    setState({ status: "loading" });

    const outcome = await fetchMeasurementDecisionBrief(measurementBulletinImportId);
    requestInFlight.current = false;

    if (outcome.kind === "unauthenticated") {
      // Mesmo fluxo de BbaDashboardShell/MeasurementImportsPage quando a sessão não é mais válida.
      signOut();
      router.replace("/login");
      return;
    }

    if (outcome.kind === "ok") {
      setState({ status: "loaded", brief: outcome.brief });
      return;
    }

    setState({ status: outcome.kind });
  }, [measurementBulletinImportId, router, signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  const generatedAt = state.status === "loaded" ? state.brief.metadata.generatedAt : null;

  return (
    <>
      <MeasurementDecisionBriefHeader generatedAt={generatedAt} />

      <section className="section-grid">
        {state.status === "loading" ? <MeasurementDecisionBriefSkeleton /> : null}

        {state.status === "not_found" || state.status === "analysis_not_available" || state.status === "technical_error" ? (
          <MeasurementDecisionBriefErrorState onRetry={() => void load()} variant={state.status} />
        ) : null}

        {state.status === "loaded" ? (
          <>
            <MeasurementDecisionHero
              confidence={state.brief.confidence}
              criticalItems={state.brief.criticalItems}
              executiveConclusion={state.brief.executiveConclusion}
              nextActions={state.brief.nextActions}
              situation={state.brief.situation}
            />
            <MeasurementDecisionFlowSection
              criticalItems={state.brief.criticalItems}
              nextActions={state.brief.nextActions}
              readiness={state.brief.executiveConclusion.readiness}
            />
            <MeasurementKeyDecisionsSection keyDecisions={state.brief.keyDecisions} />
            <MeasurementCriticalItemsSection criticalItems={state.brief.criticalItems} />
            <MeasurementRecommendedActionsSection nextActions={state.brief.nextActions} />
            <MeasurementSummarySection keyMetrics={state.brief.keyMetrics} />
            <MeasurementDetailsSection details={state.brief.details} />
          </>
        ) : null}
      </section>
    </>
  );
}
