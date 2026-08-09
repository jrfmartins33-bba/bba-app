import { useEffect, useRef } from "react";
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
//
// .budget-reconstruction-lab-table (classe adicional, só do Lab -- ver
// bba-globals.css) dá a Unidade/aos campos econômicos uma apresentação de
// uma linha só com reticências: o texto completo nunca é perdido (continua
// em `title` e no painel de detalhe), é só a linha da tabela que para de
// esticar quando a evidência bruta do motor vem incomumente longa ou
// conflitante.
//
// Cabeçalho fixo: `position: sticky` não gruda de forma confiável em
// <th>/<thead> dentro de <table> em nenhum motor de renderização testado
// (verificado nesta sprint -- funciona num <div> comum no mesmo
// container, mas não em elementos de tabela, mesmo com
// border-collapse: separate; forçar `display: table` no <thead> "resolve"
// a sticky mas desalinha as colunas do cabeçalho em relação ao corpo, o
// que é pior). Por isso o cabeçalho usa um reforço mínimo em JS: o mesmo
// <thead> (nunca um clone) recebe um `translateY` igual ao scroll do
// container, cancelando visualmente o scroll -- zero duplicação de
// marcação, alinhamento de coluna sempre correto porque é o thead real.
export function ReconstructionTable({ records, onSelectRecord }: ReconstructionTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const theadRef = useRef<HTMLTableSectionElement | null>(null);

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    const theadEl = theadRef.current;
    if (!scrollEl || !theadEl) return;

    let frame = 0;
    const syncHeaderPosition = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        theadEl.style.transform = `translateY(${scrollEl.scrollTop}px)`;
        frame = 0;
      });
    };

    scrollEl.addEventListener("scroll", syncHeaderPosition, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", syncHeaderPosition);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [records]);

  if (records.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>Nenhum registro corresponde aos filtros atuais.</p>;
  }

  return (
    <div ref={scrollContainerRef} style={{ overflow: "auto", maxHeight: "70vh" }}>
      <table className="budget-worksheet-table budget-reconstruction-lab-table">
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
        <thead ref={theadRef}>
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
              <td
                data-label="Unidade"
                className="budget-reconstruction-lab-table__unit"
                title={record.unit ?? undefined}
              >
                {record.unit ?? EMPTY_DISPLAY}
              </td>
              <td
                data-label="Quantidade"
                className="budget-worksheet-table__numeric budget-reconstruction-lab-table__numeric"
                title={record.quantity?.rawText}
              >
                {numericDisplay(record.quantity)}
              </td>
              <td
                data-label="Custo unitário"
                className="budget-worksheet-table__numeric budget-reconstruction-lab-table__numeric"
                title={record.unitCost?.rawText}
              >
                {numericDisplay(record.unitCost)}
              </td>
              <td
                data-label="BDI"
                className="budget-worksheet-table__numeric budget-reconstruction-lab-table__numeric"
                title={record.bdiRate?.rawText}
              >
                {numericDisplay(record.bdiRate)}
              </td>
              <td
                data-label="Preço unitário"
                className="budget-worksheet-table__numeric budget-reconstruction-lab-table__numeric"
                title={record.unitPrice?.rawText}
              >
                {numericDisplay(record.unitPrice)}
              </td>
              <td
                data-label="Total"
                className="budget-worksheet-table__numeric budget-reconstruction-lab-table__numeric"
                title={record.totalPrice?.rawText}
              >
                {numericDisplay(record.totalPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
