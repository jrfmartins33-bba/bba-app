import type { BudgetDocumentSignalId } from "../budget-document-signal-catalog.types";
import type {
  PhysicalDocumentPage,
  PhysicalDocumentTextExtractionAvailability,
} from "../physical-document-read.types";
import { normalizePageText } from "../physical-document-text-normalization";
import type {
  SignalNotEvaluableReasonCode,
  SignalObservationEvidenceReference,
  SignalObservationEvidenceRole,
} from "./signal-observation.types";

/**
 * Regras determinísticas e versionadas, cada uma com identidade estável
 * (`ruleId`/`ruleVersion`) referenciando o `signalId` real do catálogo.
 * Contém somente regras realmente implementadas e executáveis — nunca uma
 * regra vazia para um sinal sem capacidade aprovada (ver registro de
 * suporte, que declara os 15 sinais sem regra aqui).
 *
 * Casamento textual literal e determinístico apenas: sem correspondência
 * aproximada, sem distância de edição, sem sinônimos, sem IA. Limitações
 * conhecidas e deliberadamente não corrigidas nesta versão: uma expressão
 * quebrada entre dois itens de extração não é detectada; hifenização,
 * fragmentação da ordem técnica de extração e variação ortográfica também
 * não são tratadas.
 */

export type RuleOutcome =
  | { readonly kind: "observed"; readonly references: ReadonlyArray<SignalObservationEvidenceReference> }
  | { readonly kind: "not_observed" }
  | { readonly kind: "not_evaluable"; readonly reasonCode: SignalNotEvaluableReasonCode };

interface LocalSignalObservationRule {
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly signalId: BudgetDocumentSignalId;
  readonly evaluationScope: "single_page";
  readonly requiredInputs: ReadonlyArray<string>;
  readonly humanDescription: string;
  readonly evaluate: (page: PhysicalDocumentPage) => RuleOutcome;
}

/**
 * Regra dependente de página física vizinha — a única forma de
 * dependência multipágina usada nesta versão. Recebe explicitamente a
 * página anterior e a posterior (cada uma podendo ser `null` na borda do
 * documento); a ausência de vizinho não é falha técnica, é uma condição
 * de contexto que a própria regra decide como tratar. **Avaliável quando
 * existe ao menos uma página física vizinha com geometria utilizável** —
 * a primeira página do documento pode ser avaliada comparando-se com a
 * próxima, a última com a anterior; somente um documento de página única,
 * ou vizinhos existentes sem geometria própria disponível, produzem
 * `not_evaluable`. Não é verdade que toda borda de documento seja
 * automaticamente `not_evaluable`.
 */
interface AdjacentPageSignalObservationRule {
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly signalId: BudgetDocumentSignalId;
  readonly evaluationScope: "adjacent_pages";
  readonly requiredInputs: ReadonlyArray<string>;
  readonly humanDescription: string;
  readonly evaluate: (
    current: PhysicalDocumentPage,
    previous: PhysicalDocumentPage | null,
    next: PhysicalDocumentPage | null,
  ) => RuleOutcome;
}

export type SignalObservationRule = LocalSignalObservationRule | AdjacentPageSignalObservationRule;

// --- shared helpers -----------------------------------------------------------

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function containsLiteralPhrase(haystack: string, phrase: string): boolean {
  return collapseWhitespace(haystack).toLowerCase().includes(collapseWhitespace(phrase).toLowerCase());
}

/**
 * Constrói uma referência de evidência textual a partir de itens
 * individuais da página — nunca concatenados por um separador artificial.
 * Cada item preserva seu próprio índice, texto original verbatim e texto
 * normalizado apenas daquele item, permanecendo alinhado mesmo quando o
 * texto original contém caracteres que poderiam ser confundidos com um
 * delimitador (ex.: `|`).
 */
function buildTextReference(
  page: PhysicalDocumentPage,
  matchingIndices: ReadonlyArray<number>,
  roleInRule: SignalObservationEvidenceRole,
): SignalObservationEvidenceReference {
  const matchingItems = page.textItems.filter((item) => matchingIndices.includes(item.index));
  return {
    pageNumber: page.pageNumber,
    textItems: matchingItems.map((item) => ({
      textItemIndex: item.index,
      originalText: item.text,
      // Normalized per matched item individually (never the whole page's
      // joined normalizedText) — normalizePageText([x]) on a single item is
      // exactly that item's own normalized form, with no risk of the
      // item-alignment ambiguity a multi-item join would introduce.
      normalizedText: normalizePageText([item.text]),
    })),
    geometry: null,
    roleInRule,
  };
}

function buildFieldReference(page: PhysicalDocumentPage, roleInRule: SignalObservationEvidenceRole): SignalObservationEvidenceReference {
  return {
    pageNumber: page.pageNumber,
    textItems: [],
    geometry: null,
    roleInRule,
  };
}

/**
 * Regra genérica de presença literal de uma ou mais frases (qualquer uma
 * delas), item a item — nunca sobre o texto concatenado da página, para
 * que cada correspondência permaneça mapeada a um índice de item real.
 */
function evaluateLiteralPhrasePresence(page: PhysicalDocumentPage, phrases: ReadonlyArray<string>): RuleOutcome {
  if (page.extractionAvailability !== "text_available") {
    return { kind: "not_evaluable", reasonCode: "page_text_unavailable" };
  }

  const matchingIndices = page.textItems
    .filter((item) => phrases.some((phrase) => containsLiteralPhrase(item.text, phrase)))
    .map((item) => item.index);

  if (matchingIndices.length === 0) {
    return { kind: "not_observed" };
  }

  return { kind: "observed", references: [buildTextReference(page, matchingIndices, "primary")] };
}

// --- rule 1: referential-budget-spreadsheet-mention --------------------------

const REFERENTIAL_BUDGET_SPREADSHEET_MENTION_PHRASES = ["planilha orçamentária", "orçamento", "quadro orçamentário"];

function evaluateReferentialBudgetSpreadsheetMention(page: PhysicalDocumentPage): RuleOutcome {
  return evaluateLiteralPhrasePresence(page, REFERENTIAL_BUDGET_SPREADSHEET_MENTION_PHRASES);
}

// --- rule 2: structural-service-item-identification ---------------------------

const SERVICE_ITEM_IDENTIFICATION_PATTERNS: ReadonlyArray<RegExp> = [
  /^\d{1,3}(\.\d{1,3}){0,3}\s+\S/,
  /^[A-Z]{2,6}[-.]?\d{1,6}\s+\S/,
];

function evaluateStructuralServiceItemIdentification(page: PhysicalDocumentPage): RuleOutcome {
  if (page.extractionAvailability !== "text_available") {
    return { kind: "not_evaluable", reasonCode: "page_text_unavailable" };
  }

  const matchingIndices = page.textItems
    .filter((item) => {
      const trimmed = item.text.trim();
      return SERVICE_ITEM_IDENTIFICATION_PATTERNS.some((pattern) => pattern.test(trimmed));
    })
    .map((item) => item.index);

  if (matchingIndices.length === 0) {
    return { kind: "not_observed" };
  }

  return { kind: "observed", references: [buildTextReference(page, matchingIndices, "primary")] };
}

// --- rule 3: structural-bdi-documentary-mention (v2: token-bounded abbreviation) ---

function escapeRegExpLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A forma abreviada "BDI" precisa casar como token completo — não como
 * substring arbitrária dentro de outra palavra (ex.: "Subdiretoria"
 * contém a sequência de caracteres "bdi", mas não é uma menção
 * documental a BDI). `\b` (limite de palavra ASCII) garante que "BDI"
 * seja precedido e seguido por um caractere que não seja letra/dígito/
 * sublinhado, ou pelo início/fim da string.
 */
const STRUCTURAL_BDI_ABBREVIATION_PATTERN = /\bbdi\b/i;
const STRUCTURAL_BDI_FULL_PHRASE = "bonificação e despesas indiretas";

function evaluateStructuralBdiDocumentaryMention(page: PhysicalDocumentPage): RuleOutcome {
  if (page.extractionAvailability !== "text_available") {
    return { kind: "not_evaluable", reasonCode: "page_text_unavailable" };
  }

  const matchingIndices = page.textItems
    .filter(
      (item) => STRUCTURAL_BDI_ABBREVIATION_PATTERN.test(item.text) || containsLiteralPhrase(item.text, STRUCTURAL_BDI_FULL_PHRASE),
    )
    .map((item) => item.index);

  if (matchingIndices.length === 0) {
    return { kind: "not_observed" };
  }

  return { kind: "observed", references: [buildTextReference(page, matchingIndices, "primary")] };
}

// --- rule 4: closure-general-total-mention (v3: numeric token adjacent to the expression) ---

const CLOSURE_GENERAL_TOTAL_MENTION_PHRASES = ["total geral", "valor global", "total da proposta"];

/**
 * Exige um token numérico/monetário diretamente adjacente à expressão de
 * total — nunca apenas um dígito em qualquer posição do item, o que
 * também casaria falsamente em frases como "Total geral — ver página 12"
 * ou "Valor global conforme item 3.2". O separador permitido entre a
 * expressão e o número é deliberadamente estreito: espaço, dois-pontos,
 * hífen/travessão, e um marcador de moeda opcional ("R$") — nunca uma
 * palavra. Não interpreta, converte, valida ou compara o valor
 * encontrado; apenas comprova a associação lexical exigida pelo
 * catálogo ("... associada a um valor").
 */
const CLOSURE_TOTAL_VALUE_SEPARATOR = String.raw`[\s:\-–—]*(?:R\$)?[\s:\-–—]*`;
const CLOSURE_TOTAL_VALUE_NUMBER = String.raw`\d`;

const CLOSURE_TOTAL_VALUE_ADJACENCY_PATTERNS: ReadonlyArray<RegExp> = CLOSURE_GENERAL_TOTAL_MENTION_PHRASES.map(
  (phrase) => new RegExp(`${escapeRegExpLiteral(phrase)}${CLOSURE_TOTAL_VALUE_SEPARATOR}${CLOSURE_TOTAL_VALUE_NUMBER}`, "i"),
);

function evaluateClosureGeneralTotalMention(page: PhysicalDocumentPage): RuleOutcome {
  if (page.extractionAvailability !== "text_available") {
    return { kind: "not_evaluable", reasonCode: "page_text_unavailable" };
  }

  const matchingIndices = page.textItems
    .filter((item) => CLOSURE_TOTAL_VALUE_ADJACENCY_PATTERNS.some((pattern) => pattern.test(collapseWhitespace(item.text))))
    .map((item) => item.index);

  if (matchingIndices.length === 0) {
    return { kind: "not_observed" };
  }

  return { kind: "observed", references: [buildTextReference(page, matchingIndices, "primary")] };
}

// --- rules 5-7: extraction condition availability field mapping ---------------

function evaluateExtractionAvailabilityField(
  page: PhysicalDocumentPage,
  target: PhysicalDocumentTextExtractionAvailability,
): RuleOutcome {
  if (page.extractionAvailability === target) {
    return { kind: "observed", references: [buildFieldReference(page, "extraction_availability_field")] };
  }
  return { kind: "not_observed" };
}

function evaluateExtractionTextAvailable(page: PhysicalDocumentPage): RuleOutcome {
  return evaluateExtractionAvailabilityField(page, "text_available");
}

function evaluateExtractionNoExtractableText(page: PhysicalDocumentPage): RuleOutcome {
  return evaluateExtractionAvailabilityField(page, "no_extractable_text");
}

function evaluateExtractionError(page: PhysicalDocumentPage): RuleOutcome {
  return evaluateExtractionAvailabilityField(page, "extraction_failed");
}

// --- rule 8: continuity-stable-geometry (adjacent pages) -----------------------

function hasUsableGeometry(page: PhysicalDocumentPage): boolean {
  return page.widthPoints !== null && page.heightPoints !== null;
}

function geometryMatches(a: PhysicalDocumentPage, b: PhysicalDocumentPage): boolean {
  return a.widthPoints === b.widthPoints && a.heightPoints === b.heightPoints && a.orientation === b.orientation;
}

/**
 * Avaliável quando existe ao menos uma página física vizinha (anterior
 * ou posterior) com geometria utilizável — a primeira página do
 * documento é avaliada contra a próxima, a última contra a anterior.
 * `not_evaluable` somente quando não há vizinho algum (documento de
 * página única) ou quando os vizinhos existentes não têm geometria
 * própria disponível. Nunca trata borda de documento como erro.
 */
function evaluateContinuityStableGeometry(
  current: PhysicalDocumentPage,
  previous: PhysicalDocumentPage | null,
  next: PhysicalDocumentPage | null,
): RuleOutcome {
  if (!hasUsableGeometry(current)) {
    return { kind: "not_evaluable", reasonCode: "page_geometry_unavailable" };
  }

  const neighbors: ReadonlyArray<{ page: PhysicalDocumentPage; role: SignalObservationEvidenceRole }> = [
    ...(previous !== null ? [{ page: previous, role: "earlier_page" as const }] : []),
    ...(next !== null ? [{ page: next, role: "later_page" as const }] : []),
  ];

  if (neighbors.length === 0) {
    return { kind: "not_evaluable", reasonCode: "adjacent_page_unavailable" };
  }

  const usableNeighbors = neighbors.filter((neighbor) => hasUsableGeometry(neighbor.page));

  if (usableNeighbors.length === 0) {
    return { kind: "not_evaluable", reasonCode: "adjacent_page_unavailable" };
  }

  const matching = usableNeighbors.filter((neighbor) => geometryMatches(current, neighbor.page));

  if (matching.length === 0) {
    return { kind: "not_observed" };
  }

  const geometryOf = (page: PhysicalDocumentPage) => ({
    widthPoints: page.widthPoints,
    heightPoints: page.heightPoints,
    orientation: page.orientation,
  });

  const references: SignalObservationEvidenceReference[] = [
    {
      pageNumber: current.pageNumber,
      textItems: [],
      geometry: geometryOf(current),
      roleInRule: "reference_page",
    },
    ...matching.map((neighbor) => ({
      pageNumber: neighbor.page.pageNumber,
      textItems: [],
      geometry: geometryOf(neighbor.page),
      roleInRule: neighbor.role,
    })),
  ];

  return { kind: "observed", references };
}

// --- registry -------------------------------------------------------------------

export const SIGNAL_OBSERVATION_RULE_REGISTRY: ReadonlyArray<SignalObservationRule> = [
  {
    ruleId: "referential-budget-spreadsheet-mention-literal-phrase-v1",
    ruleVersion: 1,
    signalId: "referential-budget-spreadsheet-mention",
    evaluationScope: "single_page",
    requiredInputs: ["extractionAvailability", "textItems"],
    humanDescription: "Presença literal de \"planilha orçamentária\", \"orçamento\" ou \"quadro orçamentário\" em algum item textual da página.",
    evaluate: evaluateReferentialBudgetSpreadsheetMention,
  },
  {
    ruleId: "structural-service-item-identification-line-start-pattern-v1",
    ruleVersion: 1,
    signalId: "structural-service-item-identification",
    evaluationScope: "single_page",
    requiredInputs: ["extractionAvailability", "textItems"],
    humanDescription: "Item textual iniciando com numeração hierárquica (ex.: \"1.2\") ou código alfanumérico curto (ex.: \"SV-001\") seguido de conteúdo.",
    evaluate: evaluateStructuralServiceItemIdentification,
  },
  {
    ruleId: "structural-bdi-documentary-mention-token-boundary-v2",
    ruleVersion: 2,
    signalId: "structural-bdi-documentary-mention",
    evaluationScope: "single_page",
    requiredInputs: ["extractionAvailability", "textItems"],
    humanDescription:
      "\"BDI\" como token completo delimitado (nunca substring de outra palavra, ex.: \"Subdiretoria\") ou a forma literal por extenso \"bonificação e despesas indiretas\", em algum item textual da página.",
    evaluate: evaluateStructuralBdiDocumentaryMention,
  },
  {
    ruleId: "closure-general-total-mention-adjacent-numeric-token-v3",
    ruleVersion: 3,
    signalId: "closure-general-total-mention",
    evaluationScope: "single_page",
    requiredInputs: ["extractionAvailability", "textItems"],
    humanDescription:
      "O mesmo item textual contém \"total geral\"/\"valor global\"/\"total da proposta\" imediatamente seguida (separador controlado: espaço, dois-pontos, hífen/travessão, marcador de moeda opcional) por um token numérico — comprova associação lexical ao valor exigida pelo catálogo, sem interpretar o valor. Um dígito em qualquer outra posição do item não satisfaz a regra.",
    evaluate: evaluateClosureGeneralTotalMention,
  },
  {
    ruleId: "extraction-text-available-field-v1",
    ruleVersion: 1,
    signalId: "extraction-text-available",
    evaluationScope: "single_page",
    requiredInputs: ["extractionAvailability"],
    humanDescription: "Mapeamento direto de `extractionAvailability === \"text_available\"`.",
    evaluate: evaluateExtractionTextAvailable,
  },
  {
    ruleId: "extraction-no-extractable-text-field-v1",
    ruleVersion: 1,
    signalId: "extraction-no-extractable-text",
    evaluationScope: "single_page",
    requiredInputs: ["extractionAvailability"],
    humanDescription: "Mapeamento direto de `extractionAvailability === \"no_extractable_text\"`.",
    evaluate: evaluateExtractionNoExtractableText,
  },
  {
    ruleId: "extraction-error-field-v1",
    ruleVersion: 1,
    signalId: "extraction-error",
    evaluationScope: "single_page",
    requiredInputs: ["extractionAvailability"],
    humanDescription: "Mapeamento direto de `extractionAvailability === \"extraction_failed\"`.",
    evaluate: evaluateExtractionError,
  },
  {
    ruleId: "continuity-stable-geometry-adjacent-match-v1",
    ruleVersion: 1,
    signalId: "continuity-stable-geometry",
    evaluationScope: "adjacent_pages",
    requiredInputs: ["widthPoints", "heightPoints", "orientation", "adjacentPage"],
    humanDescription: "Largura, altura e orientação da página coincidem exatamente com as da página anterior ou da posterior.",
    evaluate: evaluateContinuityStableGeometry,
  },
];

export function getRuleById(ruleId: string): SignalObservationRule | null {
  return SIGNAL_OBSERVATION_RULE_REGISTRY.find((rule) => rule.ruleId === ruleId) ?? null;
}
