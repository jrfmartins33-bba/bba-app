import type { ReferenceTruthDocument, ReferenceTruthPage } from "./discovery-reference-truth.types";

export const REFERENCE_TRUTH_DOCUMENT: ReferenceTruthDocument = {
  sourceFileName: "05_Anexo_Tecnico_Termo_Referencia.pdf",
  sourceFingerprintSha256: "5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5",
  sourceUrl: "https://www.gov.br/dnocs/pt-br/acesso-a-informacao/licitacoes-e-contratos/conteudo/consulta-de-licitacoes/2025/pregoes/administracao-central/pregao-eletronico-no-90006-2025",
};

export const REFERENCE_TRUTH_PAGE_SELECTION_RULE_PT =
  "Páginas 46 (início do recorte de 9 páginas conhecido, elementos adversariais), 50 (página intermediária representativa de continuidade tabular convencional) e 54 (fronteira final, totalizações e encerramento) — fixadas ANTES de qualquer execução de Docling ou PaddleOCR sobre estas páginas, e nunca alteradas depois de observar qualquer saída de leitor local.";

export const REFERENCE_TRUTH_PAGES: ReadonlyArray<ReferenceTruthPage> = [
  {
    realPageNumber: 46,
    renderingHashSha256: "e89b4482222a59d2ebd2e8e1b645cd7a5cd89b0128a92cd9bf4d195f81a33e25",
    pageWidthPoints: 1190.52,
    pageHeightPoints: 841.92,
    renderedWidthPixels: 3308,
    renderedHeightPixels: 2339,
    renderingResolutionDpi: 200,
    renderingMethodIdentity: "pypdfium2 5.12.1 (pip), PdfPage.render(scale=200/72), pypdfium2-bundled PDFium",
    pageSelectionRulePt: "Início do recorte conhecido (primeira das 9 páginas da grade tabular) e presença de elementos externos adversariais (bloco de título institucional e nota externa de citação jurídica, ambos já classificados no manifesto H3c aprovado).",
  },
  {
    realPageNumber: 50,
    renderingHashSha256: "dd325528863d7091df9335ce99acf10b6beaa9aafc953a178a77002a06f7d974",
    pageWidthPoints: 1190.52,
    pageHeightPoints: 841.92,
    renderedWidthPixels: 3308,
    renderedHeightPixels: 2339,
    renderingResolutionDpi: 200,
    renderingMethodIdentity: "pypdfium2 5.12.1 (pip), PdfPage.render(scale=200/72), pypdfium2-bundled PDFium",
    pageSelectionRulePt: "Página intermediária representativa da continuidade tabular convencional (nenhum elemento adversarial, densidade típica de itens de serviço).",
  },
  {
    realPageNumber: 54,
    renderingHashSha256: "8f16be2d96c2e48c9828cbbcd7380b794864325a1b0c78544dc8e900211fc62b",
    pageWidthPoints: 1190.52,
    pageHeightPoints: 841.92,
    renderedWidthPixels: 3308,
    renderedHeightPixels: 2339,
    renderingResolutionDpi: 200,
    renderingMethodIdentity: "pypdfium2 5.12.1 (pip), PdfPage.render(scale=200/72), pypdfium2-bundled PDFium",
    pageSelectionRulePt: "Fronteira final do recorte de 9 páginas: contém totalizações de grupo (10.00.00, 11.00.00) e a linha de TOTAL GERAL, encerrando a grade tabular.",
  },
];
