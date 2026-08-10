import { Card } from "@bba/ui";
import type { BudgetReconstructionLabSummary } from "@/lib/budget/budget-reconstruction-lab-view-model";

interface ReconstructionSummaryProps {
  readonly summary: BudgetReconstructionLabSummary;
  readonly fileName: string;
}

const TONE_COLORS = {
  green: "var(--status-green, #22c55e)",
  amber: "var(--status-amber, #f59e0b)",
  red: "var(--status-red, #ef4444)",
  neutral: "var(--text-muted)",
} as const;

function StatTile({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <div>
      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{label}</span>
      <p style={{ fontSize: "24px", margin: "2px 0" }}>{value}</p>
    </div>
  );
}

// Human-first: a primeira dobra responde status/problema/impacto antes de
// qualquer identificador técnico (fingerprint/hash ficam no Diagnóstico do
// motor, seção recolhível separada).
export function ReconstructionSummary({ summary, fileName }: ReconstructionSummaryProps) {
  return (
    <Card className="span-12" title="Resumo">
      <p style={{ marginBottom: "16px", color: "var(--text-muted)" }}>
        Arquivo carregado: <strong>{fileName}</strong> · {summary.pageCount}{" "}
        {summary.pageCount === 1 ? "página reconstruída" : "páginas reconstruídas"} ({summary.pageSelectionDisplay})
      </p>
      <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
        <StatTile label="Registros reconstruídos" value={summary.totalRecordCount} />
        <StatTile label="Itens de Serviço" value={summary.serviceItemCount} />
        <StatTile label="Resolvidos" value={summary.resolvedServiceItemCount} />
        <StatTile label="Precisam de revisão" value={summary.needsReviewServiceItemCount} />
        <StatTile label="Evidência insuficiente" value={summary.insufficientEvidenceServiceItemCount} />
      </div>
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginTop: "20px" }}>
        <p style={{ fontSize: "13px", color: summary.investedEvidenceCount === 0 ? "var(--status-green, #22c55e)" : "var(--status-red, #ef4444)" }}>
          {summary.investedEvidenceCount === 0
            ? "Nenhuma evidência inventada"
            : `${summary.investedEvidenceCount} evidência(s) inventada(s) — inspecione o Diagnóstico do motor`}
        </p>
        <p style={{ fontSize: "13px", color: summary.structuralIssueCount === 0 ? "var(--status-green, #22c55e)" : "var(--status-red, #ef4444)" }}>
          {summary.structuralIssueCount === 0
            ? "Nenhuma violação de invariante interna"
            : `${summary.structuralIssueCount} violação(ões) de invariante interna — veja o Diagnóstico do motor`}
        </p>
      </div>
      {/*
        Completude ≠ ausência de violações internas. A ausência de violações
        diz apenas que o motor não se contradisse; ela nunca pode ser exibida
        como sinônimo de "a planilha que entrou saiu". O veredito abaixo vem
        pronto do Motor (result.schemaCompleteness) e é apenas traduzido.
      */}
      <div style={{ marginTop: "12px" }}>
        <p style={{ fontSize: "13px", color: TONE_COLORS[summary.schemaCompletenessTone] }}>
          {summary.schemaCompletenessLabel}
        </p>
        {summary.pagesWithUnresolvedExpectedRoles.length > 0 ? (
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Colunas esperadas não recuperadas:{" "}
            {summary.pagesWithUnresolvedExpectedRoles
              .map((page) => `pág. ${page.pageNumber} (${page.unresolvedExpectedRoles.join(", ")})`)
              .join(" · ")}
          </p>
        ) : null}
        {summary.resolvedRecordsMissingExpectedRoleCount > 0 ? (
          <p style={{ fontSize: "12px", color: "var(--status-red, #ef4444)", marginTop: "4px" }}>
            {summary.resolvedRecordsMissingExpectedRoleCount} registro(s) marcados como resolvidos
            estão sem um campo esperado pelo esquema da planilha.
          </p>
        ) : null}
      </div>
      {summary.unclassifiedCount > 0 ? (
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "8px" }}>
          Abra uma linha para ver onde está o conflito. {summary.unclassifiedCount} linha(s) não classificada(s) ficam
          ocultas por padrão na planilha reconstruída abaixo.
        </p>
      ) : null}
    </Card>
  );
}
