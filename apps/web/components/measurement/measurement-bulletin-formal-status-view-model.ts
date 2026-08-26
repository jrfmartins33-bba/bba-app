import type {
  MeasurementBulletinFormalStatus,
  MeasurementBulletinFormalStatusValue
} from "@/lib/bdos/measurement-bulletin-formal-status-service";

/**
 * Etapa 3C.2 (BM_08) — tradução de apresentação para o card de estado
 * formal na tela do Relatório Executivo. Mesmo espírito de
 * measurement-imports-view-model.ts: puramente funcional, testável
 * sem DOM.
 *
 * Datas aqui ("2026-06-01", "2026-08-26" -- só a parte de data, sem
 * hora) nunca passam por `new Date(iso)`: o construtor interpreta uma
 * string YYYY-MM-DD como UTC meia-noite, e `.toLocaleDateString`
 * converte para o fuso local -- em UTC-3 isso desloca a data exibida
 * um dia para trás. Formatação puramente textual evita esse problema.
 */

const MONTH_NAMES_PT_BR = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

const FORMAL_STATUS_LABELS: Record<MeasurementBulletinFormalStatusValue, string> = {
  Draft: "Rascunho",
  Validated: "Validado",
  Finalized: "Finalizado",
  Cancelled: "Cancelado"
};

export function formatFormalBulletinStatusLabel(status: MeasurementBulletinFormalStatusValue): string {
  return FORMAL_STATUS_LABELS[status];
}

/** "2026-06-01" -> "Junho/2026". Devolve null se a data não estiver no formato esperado. */
export function formatFormalBulletinPeriodLabel(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate);
  if (!match) {
    return null;
  }
  const [, year, month] = match;
  const monthName = MONTH_NAMES_PT_BR[Number(month) - 1];
  if (!monthName) {
    return null;
  }
  return `${monthName}/${year}`;
}

/** "2026-08-26" -> "26/08/2026". Devolve null se ausente ou fora do formato esperado. */
export function formatFormalBulletinDatePtBr(isoDate: string | null): string | null {
  if (isoDate === null) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** "252654.78" -> "R$ 252.654,78". Nunca passa por Number() (perderia precisão decimal). */
export function formatFormalBulletinTotalBRL(decimalString: string): string {
  const negative = decimalString.startsWith("-");
  const unsigned = negative ? decimalString.slice(1) : decimalString;
  const [integerPart, fractionalPart = "00"] = unsigned.split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = fractionalPart.padEnd(2, "0").slice(0, 2);
  return `${negative ? "-" : ""}R$ ${groupedInteger},${cents}`;
}

export function formatFormalBulletinCertificationLabel(certified: boolean): string {
  return certified ? "Realizada" : "Ainda não realizada";
}

export function formatFormalBulletinNumberLabel(formalStatus: Pick<MeasurementBulletinFormalStatus, "bulletinNumber" | "periodStartDate">): string {
  const bulletinNumber = String(formalStatus.bulletinNumber).padStart(2, "0");
  const periodLabel = formatFormalBulletinPeriodLabel(formalStatus.periodStartDate);
  return periodLabel ? `BM nº ${bulletinNumber} — ${periodLabel}` : `BM nº ${bulletinNumber}`;
}
