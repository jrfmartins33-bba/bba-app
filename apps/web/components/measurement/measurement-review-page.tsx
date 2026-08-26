"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, FileCheck2 } from "lucide-react";
import { Card, StatusBadge } from "@bba/ui";
import { useBbaStore } from "@bba/lib";
import { fetchMeasurementBulletinReview, type MeasurementReviewFetchOutcome } from "./measurement-review-client";
import { MeasurementReviewItemRow } from "./measurement-review-item-row";
import { MeasurementCriticalItem } from "./measurement-critical-item";
import { MeasurementCertificationConfirmDialog } from "./measurement-certification-confirm-dialog";
import { MeasurementRefusalDialog } from "./measurement-refusal-dialog";
import {
  formatFormalBulletinCertificationLabel,
  formatFormalBulletinNumberLabel,
  formatFormalBulletinStatusLabel,
  formatFormalBulletinTotalBRL
} from "./measurement-bulletin-formal-status-view-model";
import { PLANNING_COMPARISON_UNAVAILABLE_MESSAGE } from "./measurement-review-view-model";

type PageState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly review: Extract<MeasurementReviewFetchOutcome, { kind: "ok" }>["review"] }
  | { readonly status: "not_found" }
  | { readonly status: "not_formalized" }
  | { readonly status: "technical_error" };

type DialogState = { readonly kind: "none" } | { readonly kind: "certify" } | { readonly kind: "refuse" };

/**
 * "Revisar medição" — Relatório Executivo → Revisar medição → Ver
 * itens medidos → Certificar ou Recusar. Tela dedicada ao boletim
 * formal, human-first, sem aparência de ERP (item 3/12 da
 * especificação). Nunca recalcula nada no cliente -- total, prévia de
 * certificação e classificação material/observação técnica vêm todos
 * do backend, já decididos.
 */
export function MeasurementReviewPage({ measurementBulletinImportId }: { measurementBulletinImportId: string }) {
  const router = useRouter();
  const signOut = useBbaStore((state) => state.signOut);
  const hydrateSession = useBbaStore((state) => state.hydrateSession);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [observationsExpanded, setObservationsExpanded] = useState(false);
  const [certifyBusy, setCertifyBusy] = useState(false);
  const [certifyError, setCertifyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    let outcome = await fetchMeasurementBulletinReview(measurementBulletinImportId);

    if (outcome.kind === "unauthenticated") {
      const stillAuthenticated = await hydrateSession();
      if (stillAuthenticated) {
        outcome = await fetchMeasurementBulletinReview(measurementBulletinImportId);
      }
    }

    if (outcome.kind === "unauthenticated") {
      signOut();
      router.replace("/login");
      return;
    }

    if (outcome.kind === "ok") {
      setState({ status: "loaded", review: outcome.review });
      return;
    }

    setState({ status: outcome.kind });
  }, [hydrateSession, measurementBulletinImportId, router, signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleConfirmCertification() {
    setCertifyBusy(true);
    setCertifyError(null);
    try {
      const response = await fetch(`/api/measurement/imports/${measurementBulletinImportId}/certify`, { method: "POST" });
      if (response.ok) {
        setDialog({ kind: "none" });
        void load();
        return;
      }
      setCertifyError("Não foi possível concluir a certificação agora. Nenhuma alteração foi realizada.");
    } catch {
      setCertifyError("Não foi possível concluir a certificação agora. Nenhuma alteração foi realizada.");
    } finally {
      setCertifyBusy(false);
    }
  }

  return (
    <section className="section-grid measurement-review-page">
      {state.status === "loading" ? (
        <Card className="span-12 workspace-card" title="Revisar medição">
          <p className="workspace-card__description">Carregando revisão da medição...</p>
        </Card>
      ) : null}

      {state.status === "not_found" || state.status === "technical_error" ? (
        <Card className="span-12 workspace-card" title="Revisar medição">
          <p className="workspace-card__description">Não foi possível carregar esta medição agora.</p>
        </Card>
      ) : null}

      {state.status === "not_formalized" ? (
        <Card className="span-12 workspace-card" title="Revisar medição">
          <p className="workspace-card__description">Esta medição ainda não tem um boletim formal para revisar.</p>
        </Card>
      ) : null}

      {state.status === "loaded" ? (
        <>
          <Card className="span-12 workspace-card measurement-review-header" title={formatFormalBulletinNumberLabel(state.review)}>
            <div className="workspace-card__icon" aria-hidden="true">
              <FileCheck2 size={20} />
            </div>
            <dl className="workspace-fact-list">
              <div className="workspace-fact">
                <dt>Valor total da medição</dt>
                <dd>{formatFormalBulletinTotalBRL(state.review.totalValueDecimal)}</dd>
              </div>
              <div className="workspace-fact">
                <dt>Itens medidos</dt>
                <dd>{state.review.itemCount} itens</dd>
              </div>
              <div className="workspace-fact">
                <dt>Fontes verificadas</dt>
                <dd>{state.review.sourceCount} fontes</dd>
              </div>
              <div className="workspace-fact">
                <dt>Divergências materiais</dt>
                <dd>{state.review.materialDivergenceCount}</dd>
              </div>
              <div className="workspace-fact">
                <dt>Observações técnicas</dt>
                <dd>{state.review.technicalObservationCount}</dd>
              </div>
              {state.review.economicSummary ? (
                <div className="workspace-fact">
                  <dt>Economia frente ao Orçamento Oficial</dt>
                  <dd>
                    {formatFormalBulletinTotalBRL(state.review.economicSummary.economyDecimal)}
                    <span className="measurement-review-header__economic-coverage">
                      {" "}
                      · comparação disponível para {state.review.economicSummary.matchedItemCount} de {state.review.economicSummary.totalItemCount} itens
                    </span>
                  </dd>
                </div>
              ) : null}
              {state.review.technicalResponsibleName ? (
                <div className="workspace-fact">
                  <dt>Responsável técnico</dt>
                  <dd>{state.review.technicalResponsibleName}</dd>
                </div>
              ) : null}
              <div className="workspace-fact">
                <dt>Estado do boletim</dt>
                <dd>
                  <StatusBadge status={state.review.status === "Finalized" ? "completed" : "in_progress"}>
                    {formatFormalBulletinStatusLabel(state.review.status)}
                  </StatusBadge>
                </dd>
              </div>
              <div className="workspace-fact">
                <dt>Certificação</dt>
                <dd>
                  <StatusBadge status={state.review.certified ? "completed" : "pending"}>
                    {formatFormalBulletinCertificationLabel(state.review.certified)}
                  </StatusBadge>
                </dd>
              </div>
            </dl>
            <p className="measurement-review-header__planning-note">{PLANNING_COMPARISON_UNAVAILABLE_MESSAGE}.</p>
          </Card>

          <Card
            action={<span className="measurement-section-count">{state.review.items.length} {state.review.items.length === 1 ? "item" : "itens"}</span>}
            className="span-12 workspace-card"
            title="Itens medidos"
          >
            <ul className="measurement-review-items-list">
              <li className="measurement-review-item measurement-review-item--head" aria-hidden="true">
                <span className="measurement-review-item__code">Código</span>
                <span className="measurement-review-item__description">Serviço</span>
                <span className="measurement-review-item__unit">Unidade</span>
                <span className="measurement-review-item__quantity">Quantidade medida</span>
                <span className="measurement-review-item__unit-value">Preço unitário contratado</span>
                <span className="measurement-review-item__value">Valor medido</span>
                <span className="measurement-review-item__situation">Situação</span>
                <span className="measurement-review-item__analysis-toggle" />
              </li>
              {state.review.items.map((item) => (
                <MeasurementReviewItemRow item={item} key={item.id} />
              ))}
            </ul>

            <div className="measurement-review-total">
              <span>Total desta medição</span>
              <strong>{formatFormalBulletinTotalBRL(state.review.totalValueDecimal)}</strong>
            </div>
          </Card>

          {state.review.technicalObservationCount > 0 ? (
            <Card className="span-12 workspace-card measurement-review-observations" title="Observações técnicas">
              <p className="measurement-decision-hero__technical-observations">
                <CheckCircle2 aria-hidden="true" size={14} />
                {state.review.technicalObservationCount}{" "}
                {state.review.technicalObservationCount === 1 ? "observação técnica" : "observações técnicas"} — sem impacto no valor ou na
                rastreabilidade
              </p>
              <button
                aria-expanded={observationsExpanded}
                className="measurement-ver-mais"
                onClick={() => setObservationsExpanded((current) => !current)}
                type="button"
              >
                {observationsExpanded ? "Ocultar detalhes" : "Ver detalhes"}
              </button>
              {observationsExpanded ? (
                <ul className="measurement-critical-items-list">
                  {state.review.technicalObservations.map((item, index) => (
                    <MeasurementCriticalItem index={index} item={item} key={item.id} />
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}

          <Card className="span-12 workspace-card measurement-review-decision" title="Decisão sobre a medição">
            {state.review.certified ? (
              <p className="workspace-card__description">Esta medição já foi certificada.</p>
            ) : (
              <div className="measurement-review-decision__actions">
                <button className="measurement-review-decision__certify" onClick={() => setDialog({ kind: "certify" })} type="button">
                  <ClipboardCheck aria-hidden="true" size={18} />
                  Certificar medição
                </button>
                <button className="measurement-review-decision__refuse" onClick={() => setDialog({ kind: "refuse" })} type="button">
                  Recusar / devolver para correção
                </button>
              </div>
            )}
          </Card>
        </>
      ) : null}

      {dialog.kind === "certify" && state.status === "loaded" ? (
        <MeasurementCertificationConfirmDialog
          bulletinNumber={state.review.bulletinNumber}
          busy={certifyBusy}
          errorMessage={certifyError}
          measurementBulletinImportId={measurementBulletinImportId}
          onClose={() => {
            setDialog({ kind: "none" });
            setCertifyError(null);
          }}
          onConfirm={() => void handleConfirmCertification()}
        />
      ) : null}

      {dialog.kind === "refuse" ? <MeasurementRefusalDialog onClose={() => setDialog({ kind: "none" })} /> : null}
    </section>
  );
}
