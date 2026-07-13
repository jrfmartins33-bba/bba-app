import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Card } from "@bba/ui";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.2 — os três estados de
 * erro sanitizados do Relatório Executivo. Nenhum expõe status
 * interno, tenant de outra empresa ou mensagem crua da API. `401` não
 * é uma variante aqui -- aciona o fluxo de sessão antes de qualquer
 * render (ver measurement-decision-brief-page.tsx).
 */
export type MeasurementDecisionBriefErrorVariant = "not_found" | "analysis_not_available" | "technical_error";

interface ErrorContent {
  readonly title: string;
  readonly body: string | null;
  readonly retryLabel: string | null;
}

const ERROR_CONTENT: Record<MeasurementDecisionBriefErrorVariant, ErrorContent> = {
  not_found: {
    title: "Boletim de Medição não encontrado",
    body: "Não foi possível localizar este boletim.",
    retryLabel: null
  },
  analysis_not_available: {
    title: "A análise ainda não está disponível",
    body: "Este boletim existe, mas ainda não há uma análise disponível.",
    retryLabel: "Verificar novamente"
  },
  technical_error: {
    title: "Não foi possível carregar o Relatório Executivo.",
    body: null,
    retryLabel: "Tentar novamente"
  }
};

export function MeasurementDecisionBriefErrorState({
  variant,
  onRetry
}: {
  readonly variant: MeasurementDecisionBriefErrorVariant;
  readonly onRetry: () => void;
}) {
  const content = ERROR_CONTENT[variant];

  return (
    <Card className="span-12 workspace-card" title={content.title}>
      {content.body ? <p className="workspace-card__description">{content.body}</p> : null}
      <div className="measurement-decision-brief-error-actions">
        {content.retryLabel ? (
          <button className="bba-button bba-button--secondary bba-button--sm" onClick={onRetry} type="button">
            <RotateCw size={16} /> {content.retryLabel}
          </button>
        ) : null}
        <Link className="bba-button bba-button--ghost bba-button--sm" href="/medicoes">
          Voltar para Medições
        </Link>
      </div>
    </Card>
  );
}
