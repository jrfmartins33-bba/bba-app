import { useState } from "react";
import { Button, Card, StatusBadge } from "@bba/ui";
import type { BudgetReconstructionLabRecord, LabNumericField, LabRecordStatusTone } from "@/lib/budget/budget-reconstruction-lab-view-model";
import { NUMERIC_FIELD_STATUS_LABELS } from "@/lib/budget/budget-reconstruction-lab-view-model";

const EMPTY_DISPLAY = "—";

const TONE_TO_BADGE_STATUS: Readonly<Record<LabRecordStatusTone, "completed" | "in_progress" | "cancelled" | "pending">> = {
  green: "completed",
  amber: "in_progress",
  red: "cancelled",
  neutral: "pending",
};

interface ReconstructionRecordDetailProps {
  readonly record: BudgetReconstructionLabRecord;
  readonly onClose: () => void;
}

function NumericFieldRow({ label, field }: { readonly label: string; readonly field: LabNumericField | null }) {
  if (field === null) {
    return (
      <div style={{ padding: "8px 0", borderBottom: "1px solid var(--app-divider)" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{label}</span>
        <p style={{ margin: "2px 0" }}>{EMPTY_DISPLAY}</p>
      </div>
    );
  }
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--app-divider)" }}>
      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{label}</span>
      <p style={{ margin: "2px 0" }}>
        {field.rawText}
        {field.status !== "resolved" ? (
          <span style={{ marginLeft: "8px" }}>
            <StatusBadge status={field.status === "ambiguous" ? "in_progress" : "cancelled"}>
              {NUMERIC_FIELD_STATUS_LABELS[field.status] ?? field.status}
            </StatusBadge>
          </span>
        ) : null}
      </p>
      {field.hasConflict ? (
        <p style={{ fontSize: "12px", color: "var(--status-amber, #f59e0b)", margin: "2px 0" }}>
          Há valores conflitantes no documento para este campo.
        </p>
      ) : null}
    </div>
  );
}

// Painel de detalhe: identidade e campos econômicos human-first primeiro;
// grammarId/sourceCellIds/sourceFragmentIds só sob "Detalhes técnicos" --
// nunca escolhe qual valor conflitante está correto, apenas mostra a
// evidência tal como o motor a preservou.
export function ReconstructionRecordDetail({ record, onClose }: ReconstructionRecordDetailProps) {
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <Card
      className="span-12"
      title="Detalhes do registro"
      action={
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "16px" }}>
        <div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Tipo</span>
          <p style={{ margin: "2px 0" }}>{record.kindLabel}</p>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Status</span>
          <p style={{ margin: "2px 0" }}>
            <StatusBadge status={TONE_TO_BADGE_STATUS[record.statusTone]}>{record.statusLabel}</StatusBadge>
          </p>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Página</span>
          <p style={{ margin: "2px 0" }}>{record.pageNumber}</p>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Código</span>
          <p style={{ margin: "2px 0" }}>{record.itemCode ?? EMPTY_DISPLAY}</p>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Unidade</span>
          <p style={{ margin: "2px 0" }}>{record.unit ?? EMPTY_DISPLAY}</p>
        </div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Descrição</span>
        <p style={{ margin: "2px 0" }}>{record.description ?? EMPTY_DISPLAY}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 24px" }}>
        <NumericFieldRow label="Quantidade" field={record.quantity} />
        <NumericFieldRow label="Custo unitário" field={record.unitCost} />
        <NumericFieldRow label="BDI" field={record.bdiRate} />
        <NumericFieldRow label="Preço unitário" field={record.unitPrice} />
        <NumericFieldRow label="Total" field={record.totalPrice} />
      </div>

      <div style={{ marginTop: "16px" }}>
        <Button variant="ghost" size="sm" onClick={() => setShowTechnical((current) => !current)}>
          {showTechnical ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}
        </Button>
        {showTechnical ? (
          <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
            <p>
              <strong>recordId:</strong> {record.recordId}
            </p>
            <p>
              <strong>parentRecordId:</strong> {record.parentRecordId ?? EMPTY_DISPLAY}
            </p>
            <p>
              <strong>documentOrder:</strong> {record.documentOrder}
            </p>
            <p>
              <strong>rowIds:</strong> {record.rowIds.join(", ") || EMPTY_DISPLAY}
            </p>
            {(
              [
                ["quantity", record.quantity],
                ["unitCost", record.unitCost],
                ["bdiRate", record.bdiRate],
                ["unitPrice", record.unitPrice],
                ["totalPrice", record.totalPrice],
              ] as const
            ).map(([fieldName, field]) =>
              field ? (
                <p key={fieldName}>
                  <strong>{fieldName}.grammarId:</strong> {field.grammarId} · <strong>sourceCellIds:</strong>{" "}
                  {field.sourceCellIds.join(", ") || EMPTY_DISPLAY} · <strong>sourceFragmentIds:</strong>{" "}
                  {field.sourceFragmentIds.join(", ") || EMPTY_DISPLAY}
                </p>
              ) : null,
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
