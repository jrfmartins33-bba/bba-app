import type { MeasurementItemEconomicInterpretation } from "@/lib/bdos/measurement-item-economic-comparison-service";
import type { MeasurementReviewPhysicalFinancialManagement, PhysicalFinancialSituation } from "./measurement-review-client";

/**
 * "Revisar medição" — formatação puramente textual, mesma disciplina
 * de measurement-bulletin-formal-status-view-model.ts: nunca passa uma
 * quantidade/valor decimal por `Number()` (perderia precisão).
 */

/**
 * Correção semântica pós-Preview: Orçamento Oficial × Proposta
 * Vencedora é DESÁGIO/REDUÇÃO NA CONTRATAÇÃO -- nunca um rótulo de
 * resultado de execução (esse conceito só fará sentido comparando a
 * Proposta Vencedora contra o custo real de execução, que o BDOS
 * ainda não integra por item/período -- ver "Resultado da execução"
 * em measurement-review-item-row.tsx). A sentença nomeia sempre a
 * referência (orçamento oficial) explicitamente, com o percentual
 * real embutido -- nunca um rótulo genérico solto.
 */
export function formatMeasurementEconomicInterpretationSentence(
  interpretation: MeasurementItemEconomicInterpretation,
  percentageDecimal: string | null
): string {
  if (interpretation === "no_variation") {
    return "Preço contratado sem variação frente ao orçamento oficial.";
  }
  const magnitude = formatMeasurementEconomicPercentage(absolutePercentage(percentageDecimal)) ?? "—";
  return interpretation === "contract_discount"
    ? `Preço contratado ${magnitude} abaixo do orçamento oficial.`
    : `Preço contratado ${magnitude} acima do orçamento oficial.`;
}

function absolutePercentage(percentageDecimal: string | null): string | null {
  if (percentageDecimal === null) return null;
  return percentageDecimal.startsWith("-") ? percentageDecimal.slice(1) : percentageDecimal;
}

/** "-1234" (percentual em texto, já formatado como "-12.34" pelo serviço) -> "-12,34%". Nunca refaz a matemática, só troca ponto por vírgula. */
export function formatMeasurementEconomicPercentage(percentageDecimal: string | null): string | null {
  if (percentageDecimal === null) return null;
  return `${percentageDecimal.replace(".", ",")}%`;
}

export const PLANNING_COMPARISON_UNAVAILABLE_MESSAGE = "Comparação com o planejamento ainda não disponível";

/** Rótulo compacto para a coluna Situação da tabela principal -- a frase completa fica em Ver análise → Planejamento físico-financeiro. */
export const PLANNING_UNAVAILABLE_COMPACT_LABEL = "Planejamento indisponível";

/** Nota fixa em qualquer bloco por item: a situação é do GRUPO do cronograma, nunca do item individual (o físico-financeiro não planeja item a item). */
export const GROUP_SITUATION_ITEM_NOTE =
  "Esta situação refere-se ao grupo do cronograma físico-financeiro, não ao item individual.";

const PHYSICAL_FINANCIAL_SITUATION_LABEL: Record<PhysicalFinancialSituation, string> = {
  above_planned: "Acima do previsto",
  on_planned: "No previsto",
  below_planned: "Abaixo do previsto",
  not_scheduled: "Sem programação até o período"
};

const PHYSICAL_FINANCIAL_SITUATION_BADGE: Record<PhysicalFinancialSituation, string> = {
  above_planned: "Grupo acima do previsto",
  on_planned: "Grupo no previsto",
  below_planned: "Grupo abaixo do previsto",
  not_scheduled: "Grupo sem programação"
};

/** "Acima do previsto" / "No previsto" / "Abaixo do previsto" / "Sem programação até o período". Vocabulário fixo, sem conotação temporal -- a fonte não traz datas/durações por grupo. */
export function formatPhysicalFinancialSituation(situation: PhysicalFinancialSituation): string {
  return PHYSICAL_FINANCIAL_SITUATION_LABEL[situation];
}

/** Badge compacto para a coluna Situação da tabela principal quando há grupo correlacionado. */
export function formatGroupSituationBadge(situation: PhysicalFinancialSituation): string {
  return PHYSICAL_FINANCIAL_SITUATION_BADGE[situation];
}

/**
 * Tom visual da situação (item 8): abaixo → atenção (amber); no previsto
 * e sem programação → neutro; acima → azul/informativo, NUNCA verde --
 * verde fica reservado a resultado econômico real e comprovado, e
 * execução acima do cronograma não é isso. Vermelho fora.
 */
export function physicalFinancialSituationTone(situation: PhysicalFinancialSituation): "info" | "neutral" | "caution" {
  if (situation === "above_planned") return "info";
  if (situation === "below_planned") return "caution";
  return "neutral";
}

/** "2393467.02" -> "R$ 2,39 milhões" (>= 1 milhão) / "R$ 2.393.467,02" (abaixo). Puro string, determinístico -- nunca `Number()`. */
export function formatFriendlyBRL(decimal: string): string {
  const negative = decimal.startsWith("-");
  const [integerPart] = (negative ? decimal.slice(1) : decimal).split(".");
  if (integerPart.length >= 7) {
    const millions = integerPart.slice(0, integerPart.length - 6);
    const fraction = integerPart.slice(integerPart.length - 6, integerPart.length - 4).padEnd(2, "0");
    const groupedMillions = millions.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${negative ? "−" : ""}R$ ${groupedMillions},${fraction} milhões`;
  }
  return `${negative ? "−" : ""}${formatDeviationBRLUnsigned(decimal)}`;
}

function formatDeviationBRLUnsigned(decimal: string): string {
  const unsigned = decimal.startsWith("-") ? decimal.slice(1) : decimal;
  const [integerPart, fractionalPart = "00"] = unsigned.split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${groupedInteger},${fractionalPart.padEnd(2, "0").slice(0, 2)}`;
}

const HEADLINE_DIRECTION_PHRASE: Record<MeasurementReviewPhysicalFinancialManagement["headline"]["direction"], string> = {
  below: "abaixo do previsto",
  above: "acima do previsto",
  on: "sem desvio frente ao previsto"
};

/**
 * Leitura executiva do físico-financeiro da obra. Descreve DESVIO
 * físico-financeiro, nunca causa/responsabilidade operacional -- a fonte
 * comprova o desvio, não a causalidade.
 */
export function formatManagementHeadline(management: MeasurementReviewPhysicalFinancialManagement): string {
  const { direction, magnitudeValueDecimal } = management.headline;
  if (direction === "on") {
    return "Execução físico-financeira sem desvio frente ao previsto no acumulado do período.";
  }
  return `${formatFriendlyBRL(magnitudeValueDecimal)} ${HEADLINE_DIRECTION_PHRASE[direction]} no período acumulado.`;
}

/** "Planejado: 94,14% · Realizado: 62,70% · Desvio: −31,44 p.p." — só quando os percentuais existem. */
export function formatManagementHeadlineMetrics(management: MeasurementReviewPhysicalFinancialManagement): string | null {
  const { plannedPercent, actualPercent, deviationPercentPoints } = management.headline;
  const parts: string[] = [];
  if (plannedPercent !== null) parts.push(`Planejado: ${formatPercentPoints(plannedPercent)}`);
  if (actualPercent !== null) parts.push(`Realizado: ${formatPercentPoints(actualPercent)}`);
  if (deviationPercentPoints !== null) parts.push(`Desvio: ${formatPercentPoints(deviationPercentPoints, { asPoints: true })}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "4.0" -> "4"; "11.0" -> "11". Rótulo curto do grupo para frases gerenciais. */
export function shortGroupLabel(groupCode: string): string {
  return groupCode.replace(/\.0$/, "");
}

/** ["4.0","1.0","2.0"] -> "4, 1 e 2"; ["4.0","1.0"] -> "4 e 1"; ["4.0"] -> "4". */
function joinGroupLabels(groupCodes: ReadonlyArray<string>): string {
  const labels = groupCodes.map(shortGroupLabel);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

/**
 * "Os grupos 4, 1 e 2 equivalem a aproximadamente 88,2% do desvio
 * financeiro líquido atual da obra." Adapta naturalmente para 1 ou 2
 * grupos. null quando não há concentração calculável.
 */
export function formatManagementConcentration(management: MeasurementReviewPhysicalFinancialManagement): string | null {
  const concentration = management.concentration;
  if (concentration === null || concentration.groups.length === 0 || concentration.sharePercent === null) {
    return null;
  }
  const codes = concentration.groups.map((group) => group.groupCode);
  const share = formatPercentApprox(concentration.sharePercent);
  if (codes.length === 1) {
    return `O grupo ${joinGroupLabels(codes)} equivale a aproximadamente ${share} do desvio financeiro líquido atual da obra.`;
  }
  return `Os grupos ${joinGroupLabels(codes)} equivalem a aproximadamente ${share} do desvio financeiro líquido atual da obra.`;
}

/** "88.19" -> "88,2%". Uma casa, para leitura aproximada. */
function formatPercentApprox(decimal: string): string {
  const [intPart, fracPart = "0"] = decimal.split(".");
  const rounded = Math.round(Number.parseInt(fracPart.padEnd(2, "0").slice(0, 2), 10) / 10);
  const tenths = rounded === 10 ? "0" : String(rounded);
  const carry = rounded === 10 ? 1 : 0;
  return `${Number.parseInt(intPart, 10) + carry},${tenths}%`;
}

/** "94.14" -> "94,14%". "-31.44" -> "−31,44 p.p." quando `asPoints`. null passa direto. */
export function formatPercentPoints(decimal: string | null, options?: { readonly asPoints?: boolean }): string | null {
  if (decimal === null) return null;
  const negative = decimal.startsWith("-");
  const body = (negative ? decimal.slice(1) : decimal).replace(".", ",");
  const suffix = options?.asPoints ? " p.p." : "%";
  return `${negative ? "−" : ""}${body}${suffix}`;
}

/** Desvio monetário com sinal explícito: "+R$ 1.000,00" / "−R$ 1.000,00". */
export function formatDeviationBRL(decimal: string): string {
  const negative = decimal.startsWith("-");
  const unsigned = negative ? decimal.slice(1) : decimal;
  const [integerPart, fractionalPart = "00"] = unsigned.split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = fractionalPart.padEnd(2, "0").slice(0, 2);
  return `${negative ? "−" : "+"}R$ ${groupedInteger},${cents}`;
}

/** "125.5000" -> "125,5". Remove zeros à direita supérfluos, mantém a vírgula decimal pt-BR. */
export function formatMeasurementReviewQuantity(decimalString: string): string {
  const negative = decimalString.startsWith("-");
  const unsigned = negative ? decimalString.slice(1) : decimalString;
  const [integerPart, fractionalPart = ""] = unsigned.split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const trimmedFraction = fractionalPart.replace(/0+$/, "");
  return trimmedFraction.length > 0 ? `${negative ? "-" : ""}${groupedInteger},${trimmedFraction}` : `${negative ? "-" : ""}${groupedInteger}`;
}
