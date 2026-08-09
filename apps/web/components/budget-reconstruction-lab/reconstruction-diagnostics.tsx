import { useState } from "react";
import { Button, Card } from "@bba/ui";
import type { BudgetReconstructionLabViewModel } from "@/lib/budget/budget-reconstruction-lab-view-model";
import { RECORD_STATUS_LABELS } from "@/lib/budget/budget-reconstruction-lab-view-model";

interface ReconstructionDiagnosticsProps {
  readonly viewModel: BudgetReconstructionLabViewModel;
}

const EMPTY_DISPLAY = "—";

// Diagnóstico do motor: identidade técnica, colunas por página, contagem
// de outcomes aritméticos e completude -- todos valores já fornecidos por
// result.*, nunca recalculados aqui (nenhum percentual arbitrário, nenhuma
// reinterpretação de outcome). Recolhível por padrão -- não é a primeira
// dobra da página.
export function ReconstructionDiagnostics({ viewModel }: ReconstructionDiagnosticsProps) {
  const [open, setOpen] = useState(false);
  const { summary, columnsByPage, arithmeticOutcomeCounts, completeness } = viewModel;

  return (
    <Card
      className="span-12"
      title="Diagnóstico do motor"
      action={
        <Button variant="ghost" size="sm" onClick={() => setOpen((current) => !current)}>
          {open ? "Recolher" : "Expandir"}
        </Button>
      }
    >
      {!open ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          Identidade técnica, colunas por página, aritmética e completude do resultado carregado.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "24px" }}>
          <div>
            <h3 style={{ fontSize: "13px", marginBottom: "8px" }}>Identidade técnica</h3>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "grid", gap: "4px" }}>
              <p>
                <strong>Motor:</strong> {summary.engineName} · {summary.engineVersion}
              </p>
              <p>
                <strong>Perfil:</strong> {summary.profileId} · v{summary.profileVersion}
              </p>
              <p>
                <strong>canonicalFingerprint:</strong> <span style={{ wordBreak: "break-all" }}>{summary.canonicalFingerprint}</span>
              </p>
              <p>
                <strong>sourceByteHash:</strong> <span style={{ wordBreak: "break-all" }}>{summary.sourceByteHash}</span>
              </p>
              <p>
                <strong>Páginas selecionadas:</strong> {summary.pageSelectionDisplay}
              </p>
              <p>
                <strong>Evidência bruta:</strong> {summary.textItemCount} text items · {summary.fragmentCount} fragmentos ·{" "}
                {summary.segmentCount} segmentos · {summary.cellCount} células
              </p>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "13px", marginBottom: "8px" }}>Colunas por página</h3>
            <div style={{ display: "grid", gap: "8px" }}>
              {columnsByPage.map(({ pageNumber, columns }) => (
                <div key={pageNumber} style={{ fontSize: "12px" }}>
                  <strong>Página {pageNumber}:</strong>{" "}
                  {columns.map((column, index) => (
                    <span key={`${pageNumber}-${index}`} style={{ marginRight: "8px", color: "var(--text-muted)" }}>
                      {column.role} ({RECORD_STATUS_LABELS[column.status] ?? column.status})
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "13px", marginBottom: "8px" }}>Aritmética</h3>
            <div style={{ display: "grid", gap: "4px", fontSize: "12px" }}>
              {arithmeticOutcomeCounts.map(({ outcome, outcomeLabel, count }) => (
                <p key={outcome}>
                  {outcomeLabel}: {count}
                </p>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "13px", marginBottom: "8px" }}>Completude</h3>
            <div style={{ display: "grid", gap: "4px", fontSize: "12px" }}>
              <p>Campos aplicáveis: {completeness.applicableFieldCount}</p>
              <p>Presentes: {completeness.presentFieldCount}</p>
              <p>Ausentes: {completeness.missingFieldCount}</p>
              <p>Divergentes: {completeness.divergentFieldCount}</p>
              <p>Ambíguos: {completeness.ambiguousFieldCount}</p>
              <p>
                Fração exata:{" "}
                {completeness.exactFraction
                  ? `${completeness.exactFraction.numerator}/${completeness.exactFraction.denominator}`
                  : EMPTY_DISPLAY}
              </p>
              <p>Status geral: {completeness.status}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
