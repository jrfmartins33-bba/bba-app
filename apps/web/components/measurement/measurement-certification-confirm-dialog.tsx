"use client";

import { useEffect, useState } from "react";
import { Button } from "@bba/ui";
import { fetchMeasurementCertificationPreview, type MeasurementCertificationPreviewFetchOutcome } from "./measurement-certification-preview-client";
import { formatFormalBulletinPeriodLabel, formatFormalBulletinTotalBRL } from "./measurement-bulletin-formal-status-view-model";

export interface MeasurementCertificationConfirmDialogProps {
  readonly measurementBulletinImportId: string;
  readonly bulletinNumber: number;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly busy: boolean;
  readonly errorMessage: string | null;
}

type PreviewState =
  | { readonly phase: "loading" }
  | { readonly phase: "error" }
  | { readonly phase: "ready"; readonly outcome: Extract<MeasurementCertificationPreviewFetchOutcome, { kind: "ok" }> };

/**
 * "Certificar medição" nunca certifica no clique -- abre esta
 * confirmação final primeiro (item 7 da especificação). BDOS calcula
 * (acumulado antes/desta medição/depois, saldo contratual depois) via
 * `GET .../certification-preview`; este componente só apresenta --
 * nenhuma soma/subtração de dinheiro acontece aqui.
 */
export function MeasurementCertificationConfirmDialog({
  measurementBulletinImportId,
  bulletinNumber,
  onClose,
  onConfirm,
  busy,
  errorMessage
}: MeasurementCertificationConfirmDialogProps) {
  const [state, setState] = useState<PreviewState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    void fetchMeasurementCertificationPreview(measurementBulletinImportId).then((outcome) => {
      if (cancelled) return;
      if (outcome.kind === "ok") {
        setState({ phase: "ready", outcome });
      } else {
        setState({ phase: "error" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [measurementBulletinImportId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  return (
    <div aria-modal="true" className="measurement-dialog-overlay" role="dialog">
      <div className="measurement-dialog measurement-dialog--certify">
        <div className="measurement-dialog__header">
          <h3>Confirmar certificação</h3>
          <p>O usuário precisa entender exatamente o efeito desta decisão antes de confirmar.</p>
        </div>

        {state.phase === "loading" ? <p className="measurement-dialog__loading">Calculando prévia da certificação...</p> : null}

        {state.phase === "error" ? (
          <p className="measurement-dialog__error">Não foi possível calcular a prévia de certificação agora. Tente novamente.</p>
        ) : null}

        {state.phase === "ready" ? (
          <dl className="measurement-dialog__facts">
            <div className="measurement-dialog__fact">
              <dt>Boletim</dt>
              <dd>
                BM nº {String(bulletinNumber).padStart(2, "0")}
                {formatFormalBulletinPeriodLabel(state.outcome.preview.periodStartDate) ? ` — ${formatFormalBulletinPeriodLabel(state.outcome.preview.periodStartDate)}` : ""}
              </dd>
            </div>
            <div className="measurement-dialog__fact">
              <dt>Itens medidos</dt>
              <dd>{state.outcome.preview.itemCount} itens</dd>
            </div>
            <div className="measurement-dialog__fact">
              <dt>Valor desta medição</dt>
              <dd>{formatFormalBulletinTotalBRL(state.outcome.preview.measurementValueDecimal)}</dd>
            </div>
            <div className="measurement-dialog__fact">
              <dt>Acumulado certificado antes</dt>
              <dd>{formatFormalBulletinTotalBRL(state.outcome.preview.accumulatedBeforeDecimal)}</dd>
            </div>
            <div className="measurement-dialog__fact measurement-dialog__fact--emphasis">
              <dt>Acumulado certificado depois</dt>
              <dd>{formatFormalBulletinTotalBRL(state.outcome.preview.accumulatedAfterDecimal)}</dd>
            </div>
            <div className="measurement-dialog__fact">
              <dt>Saldo contratual depois</dt>
              <dd>{formatFormalBulletinTotalBRL(state.outcome.preview.contractBalanceAfterDecimal)}</dd>
            </div>
            {state.outcome.preview.technicalResponsibleName ? (
              <div className="measurement-dialog__fact">
                <dt>Responsável técnico</dt>
                <dd>{state.outcome.preview.technicalResponsibleName}</dd>
              </div>
            ) : null}
            <div className="measurement-dialog__fact">
              <dt>Divergências materiais</dt>
              <dd>{state.outcome.preview.materialDivergenceCount}</dd>
            </div>
            <div className="measurement-dialog__fact">
              <dt>Fontes verificadas</dt>
              <dd>{state.outcome.preview.sourceCount} de {state.outcome.preview.itemCount}</dd>
            </div>
          </dl>
        ) : null}

        {errorMessage ? <p className="measurement-dialog__error">{errorMessage}</p> : null}

        <div className="measurement-dialog__actions">
          <Button disabled={busy} onClick={onClose} variant="secondary">
            Voltar à revisão
          </Button>
          <Button disabled={busy || state.phase !== "ready"} onClick={onConfirm}>
            {busy ? "Certificando..." : "Confirmar certificação"}
          </Button>
        </div>
      </div>
    </div>
  );
}
