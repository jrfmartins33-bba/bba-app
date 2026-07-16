import { BUDGET_DOCUMENT_SIGNAL_CATALOG } from "../budget-document-signal-catalog";
import {
  SYNTHETIC_FIXTURE_CLASSIFICATION,
  SYNTHETIC_REFERENCE_SUITE_SCHEMA_VERSION,
  SYNTHETIC_REFERENCE_SUITE_VERSION,
  SyntheticFixtureGovernance,
  SyntheticPageComposition,
  SyntheticPageDocumentaryRole,
  SyntheticPageExtractionAvailability,
  SyntheticPageExtractionQuality,
  SyntheticPageGeometry,
  SyntheticPageReference,
  SyntheticPageReferenceDecision,
  SyntheticReferenceDocument,
  SyntheticReferenceDocumentCategory,
  SyntheticReferenceSuite,
  SyntheticReferenceSuiteIssue,
  SyntheticSignalOccurrence,
} from "./synthetic-reference-suite.types";

/**
 * Every document below is authored by hand, entirely independent of any
 * real tender/budget document. Organizations, works, item descriptions,
 * codes and values are fictional and deliberately generic. See governance
 * section of EPIC_21_SPRINT_4A2B_SIGNAL_CATALOG_AND_SYNTHETIC_REFERENCE_SUITE.md
 * — none of this is inspired by, derived from, or a paraphrase of any
 * client document. Do not add a fixture derived from a real document
 * without explicit, documented, traceable authorization.
 */

const FIXTURE_VERSION = 1;

const GOVERNANCE: SyntheticFixtureGovernance = {
  classification: SYNTHETIC_FIXTURE_CLASSIFICATION,
  createdManually: true,
  independentFromClientDocuments: true,
  noTranscription: true,
  noAutomaticDerivation: true,
  noRealValues: true,
  noRealCodes: true,
  noRealNames: true,
  noIdentifiableClientStructure: true,
  authorizedForInternalRegression: true,
};

const PORTRAIT_A4: SyntheticPageGeometry = { widthPoints: 595.28, heightPoints: 841.89, orientation: "Portrait" };
const LANDSCAPE_WIDE: SyntheticPageGeometry = { widthPoints: 1190.55, heightPoints: 841.89, orientation: "Landscape" };
const LANDSCAPE_A4: SyntheticPageGeometry = { widthPoints: 841.89, heightPoints: 595.28, orientation: "Landscape" };

function signal(signalId: string, observedForm: string): SyntheticSignalOccurrence {
  return { signalId, observedForm };
}

interface PageOverrides {
  readonly pageId: string;
  readonly syntheticPhysicalPageNumber: number;
  readonly documentaryRoles: ReadonlyArray<SyntheticPageDocumentaryRole>;
  readonly expectedSignals?: ReadonlyArray<SyntheticSignalOccurrence>;
  readonly explicitlyAbsentSignalIds?: ReadonlyArray<string>;
  readonly referenceDecision: SyntheticPageReferenceDecision;
  readonly continuityGroupId?: string | null;
  readonly expectedGaps?: ReadonlyArray<string>;
  readonly humanRationale: string;
  readonly geometry: SyntheticPageGeometry;
  readonly extractionAvailability?: SyntheticPageExtractionAvailability;
  readonly extractionQuality?: SyntheticPageExtractionQuality;
  readonly composition?: SyntheticPageComposition;
}

function page(overrides: PageOverrides): SyntheticPageReference {
  return {
    pageId: overrides.pageId,
    syntheticPhysicalPageNumber: overrides.syntheticPhysicalPageNumber,
    documentaryRoles: overrides.documentaryRoles,
    expectedSignals: overrides.expectedSignals ?? [],
    explicitlyAbsentSignalIds: overrides.explicitlyAbsentSignalIds ?? [],
    referenceDecision: overrides.referenceDecision,
    continuityGroupId: overrides.continuityGroupId ?? null,
    expectedGaps: overrides.expectedGaps ?? [],
    humanRationale: overrides.humanRationale,
    geometry: overrides.geometry,
    extractionAvailability: overrides.extractionAvailability ?? SyntheticPageExtractionAvailability.TextAvailable,
    extractionQuality: overrides.extractionQuality ?? SyntheticPageExtractionQuality.Acceptable,
    composition: overrides.composition ?? SyntheticPageComposition.PredominantlyTextual,
    fixtureVersion: FIXTURE_VERSION,
  };
}

// ---------------------------------------------------------------------------
// 1. Positive structure A — fictitious "Vale Verde" drainage works
// ---------------------------------------------------------------------------
function buildPositiveStructureA(): SyntheticReferenceDocument {
  const group = "structure-a-detail-block";
  return {
    documentId: "fixture-positive-structure-a",
    category: SyntheticReferenceDocumentCategory.PositiveStructureA,
    humanName: "Estrutura positiva sintética A — obras de drenagem fictícias \"Vale Verde\"",
    description:
      "Documento inteiramente fictício com capa, resumo, quatro páginas detalhadas em paisagem com cabeçalho e estrutura de linha repetidos, a última também servindo de fechamento, seguida de uma página descartada não relacionada.",
    governance: GOVERNANCE,
    fixtureVersion: FIXTURE_VERSION,
    pages: [
      page({
        pageId: "structure-a-p1-cover",
        syntheticPhysicalPageNumber: 1,
        documentaryRoles: [SyntheticPageDocumentaryRole.CoverContext],
        expectedSignals: [signal("referential-annex-listing", "Página de capa nomeia um \"Anexo de Preços Estimados\" fictício sem reproduzir seu conteúdo")],
        explicitlyAbsentSignalIds: ["structural-service-item-identification", "structural-unit-quantity-price-block"],
        referenceDecision: SyntheticPageReferenceDecision.Contextual,
        humanRationale: "Capa fictícia que apenas anuncia o anexo — não contém estrutura, portanto não é candidata.",
        geometry: PORTRAIT_A4,
      }),
      page({
        pageId: "structure-a-p2-summary",
        syntheticPhysicalPageNumber: 2,
        documentaryRoles: [SyntheticPageDocumentaryRole.Summary],
        expectedSignals: [signal("structural-total-value-column", "Tabela de subtotais fictícios por categoria de serviço, sem linhas de item individual")],
        explicitlyAbsentSignalIds: ["structural-tabular-row-repetition"],
        referenceDecision: SyntheticPageReferenceDecision.Contextual,
        humanRationale: "Resumo com subtotais por categoria, sem repetição de linha de item — densidade estrutural insuficiente para candidata.",
        geometry: PORTRAIT_A4,
      }),
      page({
        pageId: "structure-a-p3-detail",
        syntheticPhysicalPageNumber: 3,
        documentaryRoles: [SyntheticPageDocumentaryRole.DetailedStructure],
        expectedSignals: [
          signal("continuity-repeated-header", "Cabeçalho fictício \"Código | Descrição | Unidade | Quantidade | Valor Unitário | BDI | Valor Total\" no topo"),
          signal("structural-service-item-identification", "Códigos sequenciais fictícios VV-001, VV-002, ..."),
          signal("structural-unit-quantity-price-block", "Colunas de unidade, quantidade e valor unitário fictícios preenchidas em cada linha"),
          signal("structural-total-value-column", "Coluna de valor total fictício ao final de cada linha"),
          signal("structural-bdi-documentary-mention", "Coluna rotulada \"BDI\" com percentual fictício"),
          signal("structural-tabular-row-repetition", "Mesmo padrão de campos repetido em oito linhas fictícias"),
          signal("continuity-stable-geometry", "Página em paisagem, mesma geometria das páginas 4-6"),
        ],
        referenceDecision: SyntheticPageReferenceDecision.Candidate,
        continuityGroupId: group,
        humanRationale: "Estrutura tabular completa e coerente com serviços fictícios de drenagem.",
        geometry: LANDSCAPE_WIDE,
      }),
      page({
        pageId: "structure-a-p4-detail",
        syntheticPhysicalPageNumber: 4,
        documentaryRoles: [SyntheticPageDocumentaryRole.DetailedStructure, SyntheticPageDocumentaryRole.Continuity],
        expectedSignals: [
          signal("continuity-repeated-header", "Mesmo cabeçalho fictício da página 3"),
          signal("structural-service-item-identification", "Códigos sequenciais fictícios VV-009 a VV-016"),
          signal("structural-unit-quantity-price-block", "Colunas preenchidas, mesmo padrão da página 3"),
          signal("structural-total-value-column", "Coluna de valor total presente"),
          signal("structural-bdi-documentary-mention", "Coluna \"BDI\" presente"),
          signal("structural-tabular-row-repetition", "Mesmo padrão de campos repetido"),
          signal("continuity-stable-geometry", "Mesma geometria da página anterior"),
          signal("continuity-repeated-row-pattern", "Padrão de linha da página 3 continua na página 4"),
        ],
        referenceDecision: SyntheticPageReferenceDecision.Candidate,
        continuityGroupId: group,
        humanRationale: "Continuação direta do bloco iniciado na página 3, mesmo cabeçalho e padrão de linha.",
        geometry: LANDSCAPE_WIDE,
      }),
      page({
        pageId: "structure-a-p5-detail",
        syntheticPhysicalPageNumber: 5,
        documentaryRoles: [SyntheticPageDocumentaryRole.DetailedStructure, SyntheticPageDocumentaryRole.Continuity],
        expectedSignals: [
          signal("continuity-repeated-header", "Mesmo cabeçalho fictício"),
          signal("structural-service-item-identification", "Códigos sequenciais fictícios VV-017 a VV-024"),
          signal("structural-unit-quantity-price-block", "Colunas preenchidas"),
          signal("structural-total-value-column", "Coluna de valor total presente"),
          signal("structural-tabular-row-repetition", "Padrão de linha mantido"),
          signal("continuity-stable-geometry", "Geometria mantida"),
          signal("continuity-repeated-row-pattern", "Padrão de linha continua"),
        ],
        explicitlyAbsentSignalIds: ["structural-bdi-documentary-mention"],
        referenceDecision: SyntheticPageReferenceDecision.Candidate,
        continuityGroupId: group,
        humanRationale: "BDI fictício deliberadamente ausente nesta página — o catálogo exige que a ausência não descarte a página, pois os demais sinais estruturais sustentam a candidatura.",
        geometry: LANDSCAPE_WIDE,
      }),
      page({
        pageId: "structure-a-p6-detail-and-closure",
        syntheticPhysicalPageNumber: 6,
        documentaryRoles: [SyntheticPageDocumentaryRole.DetailedStructure, SyntheticPageDocumentaryRole.Closure],
        expectedSignals: [
          signal("continuity-repeated-header", "Mesmo cabeçalho fictício, últimas linhas de item"),
          signal("structural-service-item-identification", "Códigos sequenciais fictícios VV-025 a VV-028"),
          signal("structural-unit-quantity-price-block", "Colunas preenchidas nas últimas linhas"),
          signal("structural-tabular-row-repetition", "Padrão de linha mantido nas últimas linhas"),
          signal("continuity-stable-geometry", "Geometria mantida"),
          signal("closure-general-total-mention", "Linha final \"Total Geral Fictício\" com valor fictício"),
          signal("closure-density-drop", "Apenas quatro linhas de item nesta página, contra oito nas anteriores"),
        ],
        referenceDecision: SyntheticPageReferenceDecision.Candidate,
        continuityGroupId: group,
        humanRationale: "Página com papel duplo: ainda contém linhas de item (detalhe) e também encerra o bloco com total geral fictício (fechamento) — exemplo obrigatório de múltiplos papéis documentais.",
        geometry: LANDSCAPE_WIDE,
      }),
      page({
        pageId: "structure-a-p7-unrelated",
        syntheticPhysicalPageNumber: 7,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        explicitlyAbsentSignalIds: ["structural-tabular-row-repetition", "closure-general-total-mention"],
        referenceDecision: SyntheticPageReferenceDecision.Discarded,
        humanRationale: "Página de texto corrido fictício sem qualquer relação com o bloco orçamentário — demonstra que a continuidade não se estende além do fechamento.",
        geometry: PORTRAIT_A4,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// 2. Positive structure B — fictitious "Serra Alta" road paving works,
//    materially distinct from A (portrait geometry, different field order
//    and vocabulary, BDI documented separately, no exact "Planilha
//    Orçamentária" phrase anywhere in the document).
// ---------------------------------------------------------------------------
function buildPositiveStructureB(): SyntheticReferenceDocument {
  const group = "structure-b-detail-block";
  return {
    documentId: "fixture-positive-structure-b",
    category: SyntheticReferenceDocumentCategory.PositiveStructureB,
    humanName: "Estrutura positiva sintética B — pavimentação fictícia \"Serra Alta\"",
    description:
      "Documento fictício materialmente distinto de A: geometria retrato (não paisagem), vocabulário e ordem de campos diferentes, BDI fictício documentado à parte, e nunca usa a expressão exata \"Planilha Orçamentária\".",
    governance: GOVERNANCE,
    fixtureVersion: FIXTURE_VERSION,
    pages: [
      page({
        pageId: "structure-b-p1-cover-and-reference",
        syntheticPhysicalPageNumber: 1,
        documentaryRoles: [SyntheticPageDocumentaryRole.CoverContext, SyntheticPageDocumentaryRole.ReferenceIndex],
        expectedSignals: [signal("referential-annex-listing", "Capa fictícia remete a um \"Quadro de Composição de Custos\", vocabulário próprio e distinto de outras convenções documentais")],
        explicitlyAbsentSignalIds: ["referential-budget-spreadsheet-mention", "structural-service-item-identification"],
        referenceDecision: SyntheticPageReferenceDecision.Contextual,
        humanRationale: "Página combina capa e menção referencial (segundo exemplo obrigatório de múltiplos papéis), com vocabulário deliberadamente diferente do documento A.",
        geometry: PORTRAIT_A4,
      }),
      page({
        pageId: "structure-b-p2-summary",
        syntheticPhysicalPageNumber: 2,
        documentaryRoles: [SyntheticPageDocumentaryRole.Summary],
        expectedSignals: [signal("structural-total-value-column", "Pequena tabela fictícia de valores consolidados por frente de serviço")],
        explicitlyAbsentSignalIds: ["structural-tabular-row-repetition"],
        referenceDecision: SyntheticPageReferenceDecision.Contextual,
        humanRationale: "Resumo consolidado sem repetição de linha de item.",
        geometry: PORTRAIT_A4,
      }),
      page({
        pageId: "structure-b-p3-detail",
        syntheticPhysicalPageNumber: 3,
        documentaryRoles: [SyntheticPageDocumentaryRole.DetailedStructure],
        expectedSignals: [
          signal("continuity-repeated-header", "Cabeçalho fictício \"Item | Unidade | Quant. | Preço Unit. Sem Encargos | Descrição do Serviço | Total do Item\" — ordem diferente da estrutura A"),
          signal("structural-service-item-identification", "Numeração sequencial fictícia 01, 02, 03, ..."),
          signal("structural-unit-quantity-price-block", "Colunas de unidade/quantidade/preço preenchidas, em ordem distinta da estrutura A"),
          signal("structural-total-value-column", "Coluna \"Total do Item\" preenchida"),
          signal("structural-tabular-row-repetition", "Padrão de linha repetido em seis linhas fictícias"),
          signal("continuity-stable-geometry", "Página retrato, mesma geometria das páginas 4-6"),
        ],
        explicitlyAbsentSignalIds: ["structural-bdi-documentary-mention", "referential-budget-spreadsheet-mention"],
        referenceDecision: SyntheticPageReferenceDecision.Candidate,
        continuityGroupId: group,
        humanRationale: "Estrutura completa sem menção a BDI nesta página e sem a expressão exata \"Planilha Orçamentária\" em nenhuma página do documento — verdade de referência deve reconhecer a estrutura mesmo assim.",
        geometry: PORTRAIT_A4,
      }),
      page({
        pageId: "structure-b-p4-detail",
        syntheticPhysicalPageNumber: 4,
        documentaryRoles: [SyntheticPageDocumentaryRole.DetailedStructure, SyntheticPageDocumentaryRole.Continuity],
        expectedSignals: [
          signal("continuity-repeated-header", "Mesmo cabeçalho fictício da página 3"),
          signal("structural-service-item-identification", "Numeração sequencial fictícia 07 a 12"),
          signal("structural-unit-quantity-price-block", "Colunas preenchidas"),
          signal("structural-total-value-column", "Coluna presente"),
          signal("structural-tabular-row-repetition", "Padrão mantido"),
          signal("continuity-stable-geometry", "Geometria mantida"),
          signal("continuity-repeated-row-pattern", "Padrão de linha continua da página 3"),
        ],
        explicitlyAbsentSignalIds: ["structural-bdi-documentary-mention"],
        referenceDecision: SyntheticPageReferenceDecision.Candidate,
        continuityGroupId: group,
        humanRationale: "Continuação direta do bloco, BDI ainda ausente nesta página.",
        geometry: PORTRAIT_A4,
      }),
      page({
        pageId: "structure-b-p5-detail-with-bdi-note",
        syntheticPhysicalPageNumber: 5,
        documentaryRoles: [SyntheticPageDocumentaryRole.DetailedStructure, SyntheticPageDocumentaryRole.Continuity],
        expectedSignals: [
          signal("continuity-repeated-header", "Mesmo cabeçalho fictício"),
          signal("structural-service-item-identification", "Numeração sequencial fictícia 13 a 18"),
          signal("structural-unit-quantity-price-block", "Colunas preenchidas"),
          signal("structural-tabular-row-repetition", "Padrão mantido"),
          signal("continuity-stable-geometry", "Geometria mantida"),
          signal(
            "structural-bdi-documentary-mention",
            "Nota de rodapé fictícia isolada informando \"Bonificação e Despesas Indiretas aplicada conforme anexo\" — forma documental diferente de uma coluna dedicada",
          ),
        ],
        referenceDecision: SyntheticPageReferenceDecision.Candidate,
        continuityGroupId: group,
        humanRationale: "BDI documentado apenas nesta página, como nota de rodapé em vez de coluna — forma documental deliberadamente diferente da estrutura A.",
        geometry: PORTRAIT_A4,
      }),
      page({
        pageId: "structure-b-p6-closure",
        syntheticPhysicalPageNumber: 6,
        documentaryRoles: [SyntheticPageDocumentaryRole.Closure],
        expectedSignals: [
          signal("closure-general-total-mention", "Bloco fictício \"Valor Global da Proposta\" — grafia de fechamento diferente da estrutura A"),
          signal("closure-density-drop", "Nenhuma linha de item nesta página, apenas o bloco de fechamento"),
          signal("closure-structural-break", "Ausência total do padrão de linha repetido das páginas 3-5"),
        ],
        explicitlyAbsentSignalIds: ["structural-tabular-row-repetition"],
        referenceDecision: SyntheticPageReferenceDecision.Candidate,
        continuityGroupId: group,
        humanRationale: "Página de fechamento isolada do bloco de detalhe, com grafia diferente da estrutura A — ainda pertence ao grupo de continuidade por ser sua conclusão direta.",
        geometry: PORTRAIT_A4,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// 3. False positive — index/annex listing (referential without structure)
// ---------------------------------------------------------------------------
function buildFalsePositiveIndexListing(): SyntheticReferenceDocument {
  return {
    documentId: "fixture-false-positive-index-listing",
    category: SyntheticReferenceDocumentCategory.FalsePositiveIndexListing,
    humanName: "Falso positivo — sumário fictício de anexos",
    description: "Sumário fictício que menciona explicitamente \"Planilha Orçamentária\", \"Orçamento\" e \"BDI\", sem qualquer estrutura de linhas de serviço.",
    governance: GOVERNANCE,
    fixtureVersion: FIXTURE_VERSION,
    pages: [
      page({
        pageId: "index-listing-p1",
        syntheticPhysicalPageNumber: 1,
        documentaryRoles: [SyntheticPageDocumentaryRole.ReferenceIndex],
        expectedSignals: [
          signal("referential-budget-spreadsheet-mention", "Entrada de sumário fictícia: \"Anexo IV — Planilha Orçamentária\""),
          signal("referential-annex-listing", "Lista fictícia de anexos nomeando \"Anexo IV\" como orçamento, com menção lateral a BDI e preços"),
        ],
        explicitlyAbsentSignalIds: [
          "structural-service-item-identification",
          "structural-unit-quantity-price-block",
          "structural-total-value-column",
          "structural-tabular-row-repetition",
        ],
        referenceDecision: SyntheticPageReferenceDecision.Contextual,
        humanRationale:
          "Caso dedicado à regra obrigatória: menção referencial explícita a \"Planilha Orçamentária\" não é presença estrutural — não inicia continuidade, não é candidata.",
        geometry: PORTRAIT_A4,
      }),
      page({
        pageId: "index-listing-p2-unrelated",
        syntheticPhysicalPageNumber: 2,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        referenceDecision: SyntheticPageReferenceDecision.Discarded,
        humanRationale: "Página de texto corrido fictício subsequente, sem qualquer sinal relevante.",
        geometry: PORTRAIT_A4,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// 4. False positive — non-budget financial statement
// ---------------------------------------------------------------------------
function buildFalsePositiveFinancialStatement(): SyntheticReferenceDocument {
  return {
    documentId: "fixture-false-positive-financial-statement",
    category: SyntheticReferenceDocumentCategory.FalsePositiveFinancialStatement,
    humanName: "Falso positivo — demonstrativo financeiro fictício",
    description: "Demonstrativo fictício de fluxo de caixa com valores, totais e percentuais, sem estrutura de itens de serviço de obra.",
    governance: GOVERNANCE,
    fixtureVersion: FIXTURE_VERSION,
    pages: [
      page({
        pageId: "financial-statement-p1",
        syntheticPhysicalPageNumber: 1,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        expectedSignals: [signal("closure-general-total-mention", "Linha fictícia \"Total do Período\" em demonstrativo de desembolso")],
        explicitlyAbsentSignalIds: ["structural-service-item-identification", "structural-unit-quantity-price-block", "structural-tabular-row-repetition"],
        referenceDecision: SyntheticPageReferenceDecision.Discarded,
        humanRationale: "Demonstrativo financeiro fictício com totais, mas sem qualquer linha de serviço/obra — sinal de fechamento presente não é suficiente para candidatar.",
        geometry: PORTRAIT_A4,
      }),
      page({
        pageId: "financial-statement-p2",
        syntheticPhysicalPageNumber: 2,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        explicitlyAbsentSignalIds: ["structural-service-item-identification", "structural-tabular-row-repetition"],
        referenceDecision: SyntheticPageReferenceDecision.Discarded,
        humanRationale: "Continuação fictícia do demonstrativo de receitas por período, sem estrutura de item de serviço.",
        geometry: PORTRAIT_A4,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// 5. False positive — physical-financial schedule
// ---------------------------------------------------------------------------
function buildFalsePositivePhysicalFinancialSchedule(): SyntheticReferenceDocument {
  return {
    documentId: "fixture-false-positive-physical-financial-schedule",
    category: SyntheticReferenceDocumentCategory.FalsePositivePhysicalFinancialSchedule,
    humanName: "Falso positivo — cronograma físico-financeiro fictício",
    description: "Cronograma fictício com atividades, percentuais de execução por período e totais, sem estrutura linha a linha de planilha orçamentária.",
    governance: GOVERNANCE,
    fixtureVersion: FIXTURE_VERSION,
    pages: [
      page({
        pageId: "schedule-p1",
        syntheticPhysicalPageNumber: 1,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        expectedSignals: [signal("closure-general-total-mention", "Coluna fictícia de total de percentual executado ao final do cronograma")],
        explicitlyAbsentSignalIds: ["structural-unit-quantity-price-block", "structural-tabular-row-repetition"],
        referenceDecision: SyntheticPageReferenceDecision.Discarded,
        humanRationale: "Cronograma fictício por atividade e período, sem colunas de unidade/quantidade/valor unitário de serviço.",
        geometry: LANDSCAPE_A4,
      }),
      page({
        pageId: "schedule-p2",
        syntheticPhysicalPageNumber: 2,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        referenceDecision: SyntheticPageReferenceDecision.Discarded,
        humanRationale: "Continuação fictícia do cronograma, mesma ausência de estrutura orçamentária.",
        geometry: LANDSCAPE_A4,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// 6. Adversarial false positive — many lexical signals, no coherent structure
// ---------------------------------------------------------------------------
function buildFalsePositiveAdversarial(): SyntheticReferenceDocument {
  return {
    documentId: "fixture-false-positive-adversarial",
    category: SyntheticReferenceDocumentCategory.FalsePositiveAdversarial,
    humanName: "Falso positivo adversarial — sinais lexicais abundantes sem estrutura coerente",
    description:
      "Documento fictício deliberadamente construído para conter a expressão \"Planilha Orçamentária\", código, unidade, quantidade, BDI, valor unitário e total geral — mas sem repetição coerente de linha, sem continuidade entre páginas e sem associação estável entre campos.",
    governance: GOVERNANCE,
    fixtureVersion: FIXTURE_VERSION,
    pages: [
      page({
        pageId: "adversarial-p1",
        syntheticPhysicalPageNumber: 1,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        expectedSignals: [
          signal("referential-budget-spreadsheet-mention", "Título fictício em destaque: \"Planilha Orçamentária Referencial\""),
          signal("structural-service-item-identification", "Um único código fictício isolado, sem repetição"),
          signal("structural-unit-quantity-price-block", "Um único bloco de unidade/quantidade/valor, sem outras linhas semelhantes"),
          signal("structural-bdi-documentary-mention", "Menção isolada a \"BDI\" em parágrafo explicativo, não em coluna"),
          signal("closure-general-total-mention", "Um valor rotulado \"total\" solto no meio do texto, sem relação com bloco anterior"),
        ],
        explicitlyAbsentSignalIds: ["structural-tabular-row-repetition", "continuity-repeated-header", "continuity-repeated-row-pattern"],
        referenceDecision: SyntheticPageReferenceDecision.Ambiguous,
        humanRationale:
          "Contém a expressão exata \"Planilha Orçamentária\" e vários sinais lexicais/estruturais isolados, mas nenhuma repetição coerente de linha de serviço e nenhuma continuidade — prova que contagem de palavras-chave não basta. Página permanece ambígua, nunca candidata.",
        geometry: LANDSCAPE_WIDE,
      }),
      page({
        pageId: "adversarial-p2",
        syntheticPhysicalPageNumber: 2,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        expectedSignals: [
          signal("structural-service-item-identification", "Outro código fictício isolado, sem relação de campo com a página anterior"),
          signal("structural-total-value-column", "Outro valor total fictício isolado"),
        ],
        explicitlyAbsentSignalIds: ["continuity-repeated-header", "structural-tabular-row-repetition"],
        referenceDecision: SyntheticPageReferenceDecision.Ambiguous,
        humanRationale: "Repete alguns sinais lexicais da página 1, mas sem cabeçalho repetido nem padrão de linha — não forma grupo de continuidade com a página 1.",
        geometry: LANDSCAPE_WIDE,
      }),
      page({
        pageId: "adversarial-p3",
        syntheticPhysicalPageNumber: 3,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        expectedSignals: [signal("structural-unit-quantity-price-block", "Bloco de unidade/quantidade/valor com rótulos diferentes das páginas 1 e 2")],
        explicitlyAbsentSignalIds: ["continuity-repeated-header", "structural-tabular-row-repetition", "continuity-stable-geometry"],
        referenceDecision: SyntheticPageReferenceDecision.Ambiguous,
        humanRationale: "Terceira página com vocabulário ainda diferente das anteriores — reforça a ausência de estrutura documental estável ao longo do documento.",
        geometry: PORTRAIT_A4,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// 7. False positive — geometry alone (technical drawing / site plan)
// ---------------------------------------------------------------------------
function buildFalsePositiveGeometryWithoutBudget(): SyntheticReferenceDocument {
  const group = "geometry-only-group";
  return {
    documentId: "fixture-false-positive-geometry-without-budget",
    category: SyntheticReferenceDocumentCategory.FalsePositiveGeometryWithoutBudget,
    humanName: "Falso positivo — desenho técnico fictício com geometria estável",
    description:
      "Três páginas fictícias de um desenho técnico/planta de situação, todas em paisagem com a mesma geometria de um bloco orçamentário candidato — mas sem qualquer sinal estrutural. Prova dedicada de que geometria estável nunca é suficiente isoladamente.",
    governance: GOVERNANCE,
    fixtureVersion: FIXTURE_VERSION,
    pages: [
      page({
        pageId: "geometry-drawing-p1",
        syntheticPhysicalPageNumber: 1,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        expectedSignals: [signal("continuity-stable-geometry", "Página em paisagem larga, idêntica geometria de um bloco orçamentário candidato típico")],
        explicitlyAbsentSignalIds: [
          "structural-service-item-identification",
          "structural-unit-quantity-price-block",
          "structural-tabular-row-repetition",
          "continuity-repeated-header",
        ],
        referenceDecision: SyntheticPageReferenceDecision.Discarded,
        continuityGroupId: group,
        humanRationale: "Planta de situação fictícia — geometria idêntica à de páginas orçamentárias candidatas, mas sem nenhum sinal estrutural.",
        geometry: LANDSCAPE_WIDE,
        composition: SyntheticPageComposition.GraphicOrImage,
        extractionAvailability: SyntheticPageExtractionAvailability.NoExtractableText,
        extractionQuality: SyntheticPageExtractionQuality.Indeterminate,
      }),
      page({
        pageId: "geometry-drawing-p2",
        syntheticPhysicalPageNumber: 2,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        expectedSignals: [signal("continuity-stable-geometry", "Mesma geometria da página anterior")],
        explicitlyAbsentSignalIds: ["structural-tabular-row-repetition", "continuity-repeated-header"],
        referenceDecision: SyntheticPageReferenceDecision.Discarded,
        continuityGroupId: group,
        humanRationale: "Segunda folha fictícia do mesmo desenho técnico — geometria estável mantida, ainda sem estrutura.",
        geometry: LANDSCAPE_WIDE,
        composition: SyntheticPageComposition.GraphicOrImage,
        extractionAvailability: SyntheticPageExtractionAvailability.NoExtractableText,
        extractionQuality: SyntheticPageExtractionQuality.Indeterminate,
      }),
      page({
        pageId: "geometry-drawing-p3",
        syntheticPhysicalPageNumber: 3,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        expectedSignals: [signal("continuity-stable-geometry", "Terceira folha, mesma geometria")],
        explicitlyAbsentSignalIds: ["structural-tabular-row-repetition", "continuity-repeated-header"],
        referenceDecision: SyntheticPageReferenceDecision.Discarded,
        continuityGroupId: group,
        humanRationale: "Três páginas com geometria idêntica formam um grupo apenas geométrico, que nunca é promovido a candidato — a prova exigida pela Sprint anterior (§21).",
        geometry: LANDSCAPE_WIDE,
        composition: SyntheticPageComposition.GraphicOrImage,
        extractionAvailability: SyntheticPageExtractionAvailability.NoExtractableText,
        extractionQuality: SyntheticPageExtractionQuality.Indeterminate,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// 8. Documentary condition cases
// ---------------------------------------------------------------------------
function buildDocumentaryConditionCases(): SyntheticReferenceDocument {
  return {
    documentId: "fixture-documentary-condition-cases",
    category: SyntheticReferenceDocumentCategory.DocumentaryConditionCases,
    humanName: "Casos de condição documental",
    description:
      "Sete páginas isoladas, cada uma demonstrando uma condição documental distinta: vazia, sem texto extraível, erro de extração, qualidade degradada, qualidade indeterminada, estrutura parcial com lacuna e fechamento sem bloco anterior.",
    governance: GOVERNANCE,
    fixtureVersion: FIXTURE_VERSION,
    pages: [
      page({
        pageId: "condition-p1-empty",
        syntheticPhysicalPageNumber: 1,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        referenceDecision: SyntheticPageReferenceDecision.Discarded,
        humanRationale: "Página fisicamente em branco, sem qualquer conteúdo — não gera conteúdo inventado.",
        geometry: PORTRAIT_A4,
        composition: SyntheticPageComposition.NotDeterminable,
        extractionAvailability: SyntheticPageExtractionAvailability.NoExtractableText,
        extractionQuality: SyntheticPageExtractionQuality.Indeterminate,
      }),
      page({
        pageId: "condition-p2-no-extractable-text",
        syntheticPhysicalPageNumber: 2,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        referenceDecision: SyntheticPageReferenceDecision.Discarded,
        humanRationale: "Página com conteúdo visual (imagem fictícia), mas zero itens textuais úteis — distinta de uma página vazia.",
        geometry: PORTRAIT_A4,
        composition: SyntheticPageComposition.GraphicOrImage,
        extractionAvailability: SyntheticPageExtractionAvailability.NoExtractableText,
        extractionQuality: SyntheticPageExtractionQuality.Indeterminate,
      }),
      page({
        pageId: "condition-p3-extraction-error",
        syntheticPhysicalPageNumber: 3,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        referenceDecision: SyntheticPageReferenceDecision.Discarded,
        humanRationale: "Falha técnica representada do extrator ao processar a página — distinta de página vazia ou de imagem.",
        geometry: PORTRAIT_A4,
        composition: SyntheticPageComposition.NotDeterminable,
        extractionAvailability: SyntheticPageExtractionAvailability.ExtractionError,
        extractionQuality: SyntheticPageExtractionQuality.Indeterminate,
      }),
      page({
        pageId: "condition-p4-degraded",
        syntheticPhysicalPageNumber: 4,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        expectedSignals: [signal("extraction-degraded-quality", "Texto fictício representado com alta proporção conceitual de caracteres de substituição/controle")],
        referenceDecision: SyntheticPageReferenceDecision.Ambiguous,
        humanRationale: "Texto disponível mas degradado — insuficiente para ler sinais lexicais/estruturais com confiança, portanto ambígua, nunca descartada por invenção de conteúdo.",
        geometry: PORTRAIT_A4,
        composition: SyntheticPageComposition.PredominantlyTextual,
        extractionAvailability: SyntheticPageExtractionAvailability.TextAvailable,
        extractionQuality: SyntheticPageExtractionQuality.Degraded,
      }),
      page({
        pageId: "condition-p5-indeterminate",
        syntheticPhysicalPageNumber: 5,
        documentaryRoles: [SyntheticPageDocumentaryRole.Unrelated],
        expectedSignals: [signal("extraction-indeterminate-quality", "Métricas de qualidade conceitualmente inconclusivas para esta página")],
        referenceDecision: SyntheticPageReferenceDecision.Ambiguous,
        humanRationale: "Composição mista e qualidade indeterminada — reconhece honestamente o limite do que pode ser afirmado, sem forçar classificação binária.",
        geometry: PORTRAIT_A4,
        composition: SyntheticPageComposition.Mixed,
        extractionAvailability: SyntheticPageExtractionAvailability.TextAvailable,
        extractionQuality: SyntheticPageExtractionQuality.Indeterminate,
      }),
      page({
        pageId: "condition-p6-partial-structure-with-gap",
        syntheticPhysicalPageNumber: 6,
        documentaryRoles: [SyntheticPageDocumentaryRole.DetailedStructure],
        expectedSignals: [
          signal("structural-service-item-identification", "Códigos fictícios presentes"),
          signal("structural-unit-quantity-price-block", "Colunas preenchidas"),
          signal("structural-tabular-row-repetition", "Padrão de linha presente nesta página"),
        ],
        referenceDecision: SyntheticPageReferenceDecision.Candidate,
        continuityGroupId: "partial-structure-with-gap-group",
        humanRationale: "Primeira página estruturalmente candidata de um grupo de continuidade real de duas páginas, cuja sequência é interrompida logo em seguida.",
        geometry: LANDSCAPE_WIDE,
      }),
      page({
        pageId: "condition-p7-partial-structure-continuation",
        syntheticPhysicalPageNumber: 7,
        documentaryRoles: [SyntheticPageDocumentaryRole.DetailedStructure, SyntheticPageDocumentaryRole.Continuity],
        expectedSignals: [
          signal("continuity-repeated-header", "Mesmo cabeçalho fictício da página anterior"),
          signal("structural-service-item-identification", "Códigos fictícios continuam"),
          signal("structural-tabular-row-repetition", "Padrão de linha continua"),
          signal("continuity-repeated-row-pattern", "Padrão de linha da página anterior continua"),
        ],
        referenceDecision: SyntheticPageReferenceDecision.Candidate,
        continuityGroupId: "partial-structure-with-gap-group",
        expectedGaps: [
          "A sequência estrutural é interrompida logo após esta página: a página física seguinte esperada para este grupo está ausente do conjunto sintético, representando uma lacuna documental antes de qualquer fechamento — processamento do grupo deve ser sinalizado como parcial, nunca completado por invenção de conteúdo.",
        ],
        humanRationale: "Segunda página do mesmo grupo de continuidade, após a qual a sequência é deliberadamente interrompida — testa reconhecimento de lacuna sem inventar conteúdo para completá-la.",
        geometry: LANDSCAPE_WIDE,
      }),
      page({
        pageId: "condition-p8-closure-without-antecedent",
        syntheticPhysicalPageNumber: 8,
        documentaryRoles: [SyntheticPageDocumentaryRole.Closure],
        expectedSignals: [signal("closure-general-total-mention", "Bloco fictício \"Total Geral\" isolado, sem nenhuma página estrutural anterior neste documento")],
        explicitlyAbsentSignalIds: ["structural-tabular-row-repetition", "closure-density-drop", "closure-structural-break"],
        referenceDecision: SyntheticPageReferenceDecision.Ambiguous,
        humanRationale:
          "Sinal de fechamento isolado, sem qualquer sequência estrutural antecedente no documento — caso dedicado à regra obrigatória de que fechamento isolado nunca comprova que houve orçamento antes dele.",
        geometry: PORTRAIT_A4,
      }),
    ],
  };
}

export function buildSyntheticReferenceSuite(): SyntheticReferenceSuite {
  return {
    schemaVersion: SYNTHETIC_REFERENCE_SUITE_SCHEMA_VERSION,
    suiteVersion: SYNTHETIC_REFERENCE_SUITE_VERSION,
    documents: [
      buildPositiveStructureA(),
      buildPositiveStructureB(),
      buildFalsePositiveIndexListing(),
      buildFalsePositiveFinancialStatement(),
      buildFalsePositivePhysicalFinancialSchedule(),
      buildFalsePositiveAdversarial(),
      buildFalsePositiveGeometryWithoutBudget(),
      buildDocumentaryConditionCases(),
    ],
  };
}

const POSITIVE_CATEGORIES: ReadonlyArray<SyntheticReferenceDocumentCategory> = [
  SyntheticReferenceDocumentCategory.PositiveStructureA,
  SyntheticReferenceDocumentCategory.PositiveStructureB,
];

const FALSE_POSITIVE_CATEGORIES: ReadonlyArray<SyntheticReferenceDocumentCategory> = [
  SyntheticReferenceDocumentCategory.FalsePositiveIndexListing,
  SyntheticReferenceDocumentCategory.FalsePositiveFinancialStatement,
  SyntheticReferenceDocumentCategory.FalsePositivePhysicalFinancialSchedule,
  SyntheticReferenceDocumentCategory.FalsePositiveAdversarial,
  SyntheticReferenceDocumentCategory.FalsePositiveGeometryWithoutBudget,
];

function detailedStructurePages(document: SyntheticReferenceDocument): ReadonlyArray<SyntheticPageReference> {
  return document.pages.filter((p) => p.documentaryRoles.includes(SyntheticPageDocumentaryRole.DetailedStructure));
}

function signalIdSet(pages: ReadonlyArray<SyntheticPageReference>): Set<string> {
  const ids = new Set<string>();
  pages.forEach((p) => p.expectedSignals.forEach((s) => ids.add(s.signalId)));
  return ids;
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function containsExactPhrase(document: SyntheticReferenceDocument, phrase: string): boolean {
  return document.pages.some((p) => p.expectedSignals.some((s) => s.observedForm.includes(phrase)));
}

/**
 * Structural validation of the synthetic reference suite itself — never a
 * decision about real pages. Enforces the coverage and governance
 * invariants required before any future decision mechanism can be
 * measured against this suite.
 */
export function validateSyntheticReferenceSuite(suite: SyntheticReferenceSuite): ReadonlyArray<SyntheticReferenceSuiteIssue> {
  const issues: SyntheticReferenceSuiteIssue[] = [];
  const knownSignalIds = new Set(BUDGET_DOCUMENT_SIGNAL_CATALOG.map((s) => s.id));

  const positiveDocs = suite.documents.filter((d) => POSITIVE_CATEGORIES.includes(d.category));
  const falsePositiveDocs = suite.documents.filter((d) => FALSE_POSITIVE_CATEGORIES.includes(d.category));

  if (positiveDocs.length < 2) {
    issues.push({ code: "insufficient_positive_documents", documentId: null, pageId: null, message: `esperado ao menos 2 documentos positivos, encontrado ${positiveDocs.length}` });
  }
  if (falsePositiveDocs.length < 3) {
    issues.push({ code: "insufficient_false_positive_documents", documentId: null, pageId: null, message: `esperado ao menos 3 falsos positivos, encontrado ${falsePositiveDocs.length}` });
  }
  if (!suite.documents.some((d) => d.category === SyntheticReferenceDocumentCategory.FalsePositiveAdversarial)) {
    issues.push({ code: "missing_adversarial_document", documentId: null, pageId: null, message: "nenhum documento adversarial encontrado" });
  }
  if (!suite.documents.some((d) => d.category === SyntheticReferenceDocumentCategory.FalsePositiveGeometryWithoutBudget)) {
    issues.push({ code: "missing_geometry_only_false_positive", documentId: null, pageId: null, message: "nenhum falso positivo de geometria sem orçamento encontrado" });
  }
  if (!suite.documents.some((d) => d.category === SyntheticReferenceDocumentCategory.DocumentaryConditionCases)) {
    issues.push({ code: "missing_documentary_condition_case", documentId: null, pageId: null, message: "nenhum documento de condição documental encontrado" });
  }

  if (positiveDocs.length >= 2) {
    const [first, second] = positiveDocs;
    const firstDetail = detailedStructurePages(first);
    const secondDetail = detailedStructurePages(second);
    const orientationsDiffer = firstDetail.some((p) => secondDetail.every((q) => q.geometry.orientation !== p.geometry.orientation))
      || secondDetail.some((p) => firstDetail.every((q) => q.geometry.orientation !== p.geometry.orientation));
    const signalSetsDiffer = !setsEqual(signalIdSet(firstDetail), signalIdSet(secondDetail));
    if (!orientationsDiffer && !signalSetsDiffer) {
      issues.push({
        code: "positive_documents_not_materially_distinct",
        documentId: `${first.documentId},${second.documentId}`,
        pageId: null,
        message: "os dois documentos positivos não apresentam diferença material detectável (mesma orientação e mesmo conjunto de sinais estruturais)",
      });
    }
  }

  const hasReferentialOnlyCase = suite.documents.some((d) =>
    d.pages.some(
      (p) =>
        p.expectedSignals.some((s) => knownSignalIds.has(s.signalId) && s.signalId.startsWith("referential-"))
        && p.referenceDecision !== SyntheticPageReferenceDecision.Candidate
        && !p.expectedSignals.some((s) => s.signalId.startsWith("structural-")),
    ),
  );
  if (!hasReferentialOnlyCase) {
    issues.push({ code: "missing_referential_only_case", documentId: null, pageId: null, message: "nenhuma página de menção referencial sem estrutura encontrada" });
  }

  const hasStructuralWithoutExactPhrase = suite.documents.some(
    (d) => !containsExactPhrase(d, "Planilha Orçamentária") && d.pages.some((p) => p.referenceDecision === SyntheticPageReferenceDecision.Candidate),
  );
  if (!hasStructuralWithoutExactPhrase) {
    issues.push({ code: "missing_structural_without_exact_phrase_case", documentId: null, pageId: null, message: "nenhum documento com estrutura candidata sem a expressão exata \"Planilha Orçamentária\" encontrado" });
  }

  const hasClosureCase = suite.documents.some((d) => d.pages.some((p) => p.documentaryRoles.includes(SyntheticPageDocumentaryRole.Closure)));
  if (!hasClosureCase) {
    issues.push({ code: "missing_closure_case", documentId: null, pageId: null, message: "nenhuma página de fechamento encontrada" });
  }

  const hasMultipleRolePage = suite.documents.some((d) => d.pages.some((p) => p.documentaryRoles.length >= 2));
  if (!hasMultipleRolePage) {
    issues.push({ code: "missing_multiple_role_page", documentId: null, pageId: null, message: "nenhuma página com múltiplos papéis documentais encontrada" });
  }

  const seenDocumentIds = new Set<string>();
  const seenPageIds = new Set<string>();
  suite.documents.forEach((document) => {
    if (seenDocumentIds.has(document.documentId)) {
      issues.push({ code: "duplicate_document_id", documentId: document.documentId, pageId: null, message: "identificador de documento duplicado" });
    }
    seenDocumentIds.add(document.documentId);

    if (!document.fixtureVersion || document.fixtureVersion < 1) {
      issues.push({ code: "missing_fixture_version", documentId: document.documentId, pageId: null, message: "versão de fixture ausente no documento" });
    }

    if (
      document.governance.classification !== SYNTHETIC_FIXTURE_CLASSIFICATION
      || !document.governance.createdManually
      || !document.governance.independentFromClientDocuments
      || !document.governance.noTranscription
      || !document.governance.noAutomaticDerivation
      || !document.governance.noRealValues
      || !document.governance.noRealCodes
      || !document.governance.noRealNames
      || !document.governance.noIdentifiableClientStructure
      || !document.governance.authorizedForInternalRegression
    ) {
      issues.push({ code: "non_synthetic_governance", documentId: document.documentId, pageId: null, message: "governança da fixture incompleta ou não-sintética" });
    }

    const continuityGroups = new Map<string, number>();
    document.pages.forEach((p, index) => {
      if (seenPageIds.has(p.pageId)) {
        issues.push({ code: "duplicate_page_id", documentId: document.documentId, pageId: p.pageId, message: "identificador de página duplicado" });
      }
      seenPageIds.add(p.pageId);

      if (!p.fixtureVersion || p.fixtureVersion < 1) {
        issues.push({ code: "missing_fixture_version", documentId: document.documentId, pageId: p.pageId, message: "versão de fixture ausente na página" });
      }
      if (p.humanRationale.trim().length === 0) {
        issues.push({ code: "missing_rationale", documentId: document.documentId, pageId: p.pageId, message: "justificativa humana ausente" });
      }
      if (p.syntheticPhysicalPageNumber !== index + 1) {
        issues.push({ code: "inconsistent_page_numbering", documentId: document.documentId, pageId: p.pageId, message: `numeração inconsistente: esperado ${index + 1}, encontrado ${p.syntheticPhysicalPageNumber}` });
      }
      [...p.expectedSignals.map((s) => s.signalId), ...p.explicitlyAbsentSignalIds].forEach((signalId) => {
        if (!knownSignalIds.has(signalId)) {
          issues.push({ code: "dangling_signal_reference", documentId: document.documentId, pageId: p.pageId, message: `sinal desconhecido referenciado: ${signalId}` });
        }
      });

      if (p.continuityGroupId !== null) {
        continuityGroups.set(p.continuityGroupId, (continuityGroups.get(p.continuityGroupId) ?? 0) + 1);
      }
    });

    continuityGroups.forEach((count, groupId) => {
      if (count < 2) {
        issues.push({ code: "dangling_continuity_reference", documentId: document.documentId, pageId: null, message: `grupo de continuidade "${groupId}" tem apenas ${count} página — não forma continuidade` });
      }
    });
  });

  return issues;
}
