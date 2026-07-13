"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@bba/ui";
import { useBbaStore } from "@bba/lib";
import type { DecisionBrief } from "@bba/bdos-core/decision-brief";
import { fetchMeasurementDecisionBrief } from "./measurement-decision-brief-client";
import { MeasurementDecisionBriefHeader } from "./measurement-decision-brief-header";
import { MeasurementDecisionBriefSkeleton } from "./measurement-decision-brief-skeleton";
import { MeasurementDecisionBriefErrorState, type MeasurementDecisionBriefErrorVariant } from "./measurement-decision-brief-error-state";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.2 — page shell do
 * Relatório Executivo. Carrega o `DecisionBrief` via
 * `GET /api/measurement/imports/[id]/decision-brief` e trata todos os
 * resultados HTTP -- ainda não apresenta Conclusão Executiva,
 * Principais Decisões, Itens Críticos, métricas ou evidências (Sprints
 * seguintes). Nenhum outro campo do Brief carregado é lido aqui além
 * de `metadata.generatedAt`, usado só no cabeçalho.
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
          <Card className="span-12 workspace-card" title="Relatório Executivo">
            <p className="workspace-card__description">Relatório carregado com sucesso.</p>
          </Card>
        ) : null}
      </section>
    </>
  );
}
