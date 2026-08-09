import { StatusBadge } from "@bba/ui";
import type { BudgetReconstructionLabRecord, LabRecordStatusTone } from "@/lib/budget/budget-reconstruction-lab-view-model";

const EMPTY_DISPLAY = "—";

const TONE_TO_BADGE_STATUS: Readonly<Record<LabRecordStatusTone, "completed" | "in_progress" | "cancelled" | "pending">> = {
  green: "completed",
  amber: "in_progress",
  red: "cancelled",
  neutral: "pending",
};

function numericDisplay(field: BudgetReconstructionLabRecord["quantity"]): string {
  return field?.rawText ?? EMPTY_DISPLAY;
}

// budget-worksheet-table__numeric sets white-space: nowrap, correct for a
// normal short currency value but not for a divergent-source-cells-v1
// rawText (the motor's own evidence can join two conflicting source texts
// into one string, e.g. "R$ 156,00 | 624,00" or "24,18% | BDI :", which is
// unbounded in length) -- so the class is used only for right-alignment,
// with wrapping restored via inline style.
const numericCellStyle = { whiteSpace: "normal", overflowWrap: "anywhere" } as const;

interface ReconstructionTableProps {
  readonly records: ReadonlyArray<BudgetReconstructionLabRecord>;
  readonly onSelectRecord: (recordId: string) => void;
}

// Planilha reconstruída: cada valor econômico exibido é `rawText`, a
// evidência textual literal já produzida pelo motor -- nunca um cálculo
// feito aqui. Uma célula com conflito de evidência (duas fontes
// discordando) é sinalizada visualmente, não silenciosamente escolhida.
// .budget-worksheet-table usa table-layout: fixed (ver bba-globals.css) --
// sem <colgroup> explícito as colunas ficam com largura igual, o que
// espreme o badge de status contra a coluna seguinte quando a descrição é
// longa; por isso a largura de cada coluna é declarada aqui.
export function ReconstructionTable({ records, onSelectRecord }: ReconstructionTableProps) {
  if (records.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>Nenhum registro corresponde aos filtros atuais.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="budget-worksheet-table">
        <colgroup>
          <col style={{ width: "13%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "9%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Status</th>
            <th>Tipo</th>
            <th>Item</th>
            <th>Descrição</th>
            <th>Unidade</th>
            <th className="budget-worksheet-table__numeric">Quantidade</th>
            <th className="budget-worksheet-table__numeric">Custo unitário</th>
            <th className="budget-worksheet-table__numeric">BDI</th>
            <th className="budget-worksheet-table__numeric">Preço unitário</th>
            <th className="budget-worksheet-table__numeric">Total</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.recordId}
              onClick={() => onSelectRecord(record.recordId)}
              style={{ cursor: "pointer" }}
              title="Ver detalhes"
            >
              <td data-label="Status">
                <StatusBadge status={TONE_TO_BADGE_STATUS[record.statusTone]}>{record.statusLabel}</StatusBadge>
                {record.hasNumericConflict ? (
                  <span style={{ display: "block", marginTop: "2px", fontSize: "11px", color: "var(--status-red, #ef4444)" }}>
                    conflito
                  </span>
                ) : null}
              </td>
              <td data-label="Tipo">{record.kindLabel}</td>
              <td data-label="Item">{record.itemCode ?? EMPTY_DISPLAY}</td>
              <td data-label="Descrição" className="budget-worksheet-table__description">
                {record.description ?? EMPTY_DISPLAY}
              </td>
              <td data-label="Unidade" style={{ overflowWrap: "anywhere" }}>
                {record.unit ?? EMPTY_DISPLAY}
              </td>
              <td data-label="Quantidade" className="budget-worksheet-table__numeric" style={numericCellStyle}>
                {numericDisplay(record.quantity)}
              </td>
              <td data-label="Custo unitário" className="budget-worksheet-table__numeric" style={numericCellStyle}>
                {numericDisplay(record.unitCost)}
              </td>
              <td data-label="BDI" className="budget-worksheet-table__numeric" style={numericCellStyle}>
                {numericDisplay(record.bdiRate)}
              </td>
              <td data-label="Preço unitário" className="budget-worksheet-table__numeric" style={numericCellStyle}>
                {numericDisplay(record.unitPrice)}
              </td>
              <td data-label="Total" className="budget-worksheet-table__numeric" style={numericCellStyle}>
                {numericDisplay(record.totalPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
