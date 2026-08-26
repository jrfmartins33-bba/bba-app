"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileCheck2 } from "lucide-react";
import { Card, StatusBadge } from "@bba/ui";
import { useBbaStore } from "@bba/lib";
import { fetchMeasurementBulletinFormalStatus } from "./measurement-bulletin-formal-status-client";
import type { MeasurementBulletinFormalStatus } from "@/lib/bdos/measurement-bulletin-formal-status-service";
import {
  formatFormalBulletinCertificationLabel,
  formatFormalBulletinDatePtBr,
  formatFormalBulletinNumberLabel,
  formatFormalBulletinStatusLabel,
  formatFormalBulletinTotalBRL
} from "./measurement-bulletin-formal-status-view-model";

/**
 * Etapa 3C.2 (BM_08) — card somente-leitura do estado formal já
 * persistido do boletim (Etapa 3C.1C/3C.2: reference/header completos,
 * 15 linhas formais, 15 fontes relacionais, ciclo bulletin_generated).
 * Nunca oferece ação de certificação nesta rodada -- é puramente
 * informativo. A maioria dos boletins ainda não passou pela Etapa
 * 3C.2 (`not_formalized`), então o estado normal deste componente é
 * não renderizar nada -- nunca um erro, nunca um placeholder vazio.
 */

type FormalStatusCardState =
  | { readonly phase: "loading" }
  | { readonly phase: "hidden" }
  | { readonly phase: "ready"; readonly formalStatus: MeasurementBulletinFormalStatus };

export function MeasurementBulletinFormalStatusCard({ measurementBulletinImportId }: { measurementBulletinImportId: string }) {
  const hydrateSession = useBbaStore((state) => state.hydrateSession);
  const [state, setState] = useState<FormalStatusCardState>({ phase: "loading" });

  const load = useCallback(async () => {
    let outcome = await fetchMeasurementBulletinFormalStatus(measurementBulletinImportId);

    if (outcome.kind === "unauthenticated") {
      // Mesmo raciocínio de MeasurementImportsPage/MeasurementDecisionBriefPage:
      // reconfirma contra a sessão real antes de tratar como ausente --
      // este card nunca decide logout sozinho (essa decisão pertence
      // exclusivamente ao fluxo de autenticação do shell/página).
      const stillAuthenticated = await hydrateSession();
      if (stillAuthenticated) {
        outcome = await fetchMeasurementBulletinFormalStatus(measurementBulletinImportId);
      }
    }

    if (outcome.kind === "ok") {
      setState({ phase: "ready", formalStatus: outcome.formalStatus });
      return;
    }

    // not_formalized, not_found, unauthenticated (ainda assim), technical_error:
    // todos resultam em "não mostrar o card" -- este componente é
    // aditivo e nunca deve competir com o Relatório Executivo por
    // espaço de erro.
    setState({ phase: "hidden" });
  }, [hydrateSession, measurementBulletinImportId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase !== "ready") {
    return null;
  }

  const { formalStatus } = state;
  const formalizationDate = formatFormalBulletinDatePtBr(formalStatus.formalizationDate);

  return (
    <Card
      className="span-12 workspace-card measurement-formal-status-card"
      title={formatFormalBulletinNumberLabel(formalStatus)}
    >
      <div className="workspace-card__icon" aria-hidden="true">
        <FileCheck2 size={20} />
      </div>

      <dl className="workspace-fact-list">
        <div className="workspace-fact">
          <dt>Valor total</dt>
          <dd>{formatFormalBulletinTotalBRL(formalStatus.totalValueDecimal)}</dd>
        </div>
        <div className="workspace-fact">
          <dt>Boletim</dt>
          <dd>
            <StatusBadge status={formalStatus.status === "Finalized" ? "completed" : "in_progress"}>
              {formatFormalBulletinStatusLabel(formalStatus.status)}
            </StatusBadge>
          </dd>
        </div>
        <div className="workspace-fact">
          <dt>Itens medidos</dt>
          <dd>{formalStatus.lineCount} itens</dd>
        </div>
        <div className="workspace-fact">
          <dt>Fontes verificadas</dt>
          <dd>
            {formalStatus.sourceCount} fontes
            {formalStatus.sourceCount === formalStatus.lineCount ? (
              <CheckCircle2 size={14} className="measurement-formal-status-card__source-check" aria-hidden="true" />
            ) : null}
          </dd>
        </div>
        {formalStatus.technicalResponsibleName ? (
          <div className="workspace-fact">
            <dt>Responsável técnico</dt>
            <dd>{formalStatus.technicalResponsibleName}</dd>
          </div>
        ) : null}
        {formalizationDate ? (
          <div className="workspace-fact">
            <dt>Data de formalização</dt>
            <dd>{formalizationDate}</dd>
          </div>
        ) : null}
        <div className="workspace-fact">
          <dt>Certificação</dt>
          <dd>
            <StatusBadge status={formalStatus.certified ? "completed" : "pending"}>
              {formatFormalBulletinCertificationLabel(formalStatus.certified)}
            </StatusBadge>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
