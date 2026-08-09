import { StatusBadge } from "@bba/ui";
import {
  RECORD_STATUS_EXPLANATIONS,
  RECORD_STATUS_LEGEND_ORDER,
  RECORD_STATUS_LABELS,
} from "@/lib/budget/budget-reconstruction-lab-view-model";
import type { LabRecordStatusTone } from "@/lib/budget/budget-reconstruction-lab-view-model";

const STATUS_TONE: Readonly<Record<(typeof RECORD_STATUS_LEGEND_ORDER)[number], LabRecordStatusTone>> = {
  resolved: "green",
  ambiguous: "amber",
  insufficient_evidence: "red",
};

const TONE_TO_BADGE_STATUS: Readonly<Record<LabRecordStatusTone, "completed" | "in_progress" | "cancelled" | "pending">> = {
  green: "completed",
  amber: "in_progress",
  red: "cancelled",
  neutral: "pending",
};

// Legenda discreta, Admin-only: explica em uma linha por status o que o
// badge da planilha significa, para que "Precisa de revisão"/"Evidência
// insuficiente" sejam diagnóstico útil e não apenas um rótulo técnico.
export function ReconstructionStatusLegend() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px 24px",
        alignItems: "center",
        padding: "8px 0 16px",
        fontSize: "12px",
        color: "var(--text-secondary)",
      }}
    >
      {RECORD_STATUS_LEGEND_ORDER.map((status) => (
        <span key={status} style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <StatusBadge status={TONE_TO_BADGE_STATUS[STATUS_TONE[status]]}>{RECORD_STATUS_LABELS[status]}</StatusBadge>
          <span>{RECORD_STATUS_EXPLANATIONS[status]}</span>
        </span>
      ))}
    </div>
  );
}
