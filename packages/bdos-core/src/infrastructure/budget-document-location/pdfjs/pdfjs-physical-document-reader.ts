import { createHash } from "node:crypto";
import {
  computeGeometryContextFingerprint,
  computePageTextMetrics,
  computeTextItemPlacementMetrics,
  createTechnicalProblem,
  derivePageOrientation,
  normalizePageText,
  PHYSICAL_DOCUMENT_GEOMETRY_CONTEXT_FINGERPRINT_VERSION,
  PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
  PHYSICAL_DOCUMENT_READER_NAME,
  PHYSICAL_DOCUMENT_READER_VERSION,
  PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
  PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
} from "../../../domain/budget-document-location";
import type {
  PhysicalDocumentPage,
  PhysicalDocumentReadResult,
  PhysicalDocumentReadStatus,
  PhysicalDocumentReader,
  PhysicalDocumentTechnicalProblem,
  PhysicalDocumentTechnicalProblemCode,
  PhysicalDocumentTextExtractionAvailability,
  PhysicalDocumentTextItem,
  PhysicalDocumentTextItemPlacement,
} from "../../../domain/budget-document-location";
import { deriveTextItemPlacement } from "./text-item-geometry";

/**
 * Adaptador concreto de leitura física de PDF, baseado em `pdfjs-dist`
 * (versão efetivamente resolvida no monorepo: ver `package.json` de
 * `@bba/bdos-core` e a documentação da Sprint). Único ponto do pacote
 * autorizado a importar essa biblioteca — o domínio
 * `budget-document-location` não a conhece (guard arquitetural em
 * `packages/bdos-core/src/architecture/`).
 *
 * Investigação empírica que fundamenta as decisões abaixo (documentada
 * também em EPIC_21_SPRINT_4A2C_DOCUMENT_READER_AND_PDF_ADAPTER.md e, para
 * a geometria por item textual da Sprint 21.4A.2.f.0, em
 * EPIC_21_SPRINT_4A2F0_NORMALIZED_TEXT_ITEM_GEOMETRY.md):
 * - A entrada principal do pacote (`pdfjs-dist`) requer `DOMMatrix` e
 *   falha em Node puro; a build `legacy/build/pdf.mjs` funciona sem DOM e
 *   sem worker configurado (fallback síncrono automático da própria
 *   biblioteca quando nenhum worker é registrado).
 * - `viewport.width`/`viewport.height` já refletem a rotação efetiva da
 *   página (confirmado empiricamente com `/Rotate 90`): não há troca
 *   adicional de dimensões neste adaptador.
 * - `getDocument({ data })` toma posse do `Uint8Array` passado e pode
 *   transferi-lo/esvaziá-lo (documentado no próprio JSDoc de
 *   `DocumentInitParameters.data` da biblioteca); confirmado
 *   empiricamente que uma segunda leitura reaproveitando a mesma
 *   referência via a API pública deste adaptador observava um buffer já
 *   esvaziado. Por isso este adaptador sempre entrega uma cópia
 *   (`bytes.slice()`) à biblioteca, nunca a referência recebida pelo
 *   chamador — preservando a garantia de bytes imutáveis do contrato.
 * - `PageViewport.transform` (Sprint 21.4A.2.f.0) usa exclusivamente
 *   coeficientes exatos (±1, 0) multiplicados pela escala para as quatro
 *   rotações suportadas — nenhuma trigonometria — confirmado lendo o
 *   código-fonte da própria biblioteca. A derivação geométrica em si vive
 *   em `./text-item-geometry.ts` (função pura, sem tipos concretos da
 *   biblioteca), consumida aqui apenas com os valores já extraídos dos
 *   objetos concretos de `pdfjs-dist`.
 */
const UNDERLYING_LIBRARY_NAME = "pdfjs-dist";

export const PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION = "pdfjs-physical-document-reader-adapter-v2" as const;

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfjsDocumentProxy = Awaited<ReturnType<PdfjsModule["getDocument"]>["promise"]>;
type PdfjsPageProxy = Awaited<ReturnType<PdfjsDocumentProxy["getPage"]>>;
type PdfjsPageViewport = ReturnType<PdfjsPageProxy["getViewport"]>;
type PdfjsTextContent = Awaited<ReturnType<PdfjsPageProxy["getTextContent"]>>;
type PdfjsTextContentItem = PdfjsTextContent["items"][number];
type PdfjsTextItem = Extract<PdfjsTextContentItem, { str: string }>;
type PdfjsTextStyle = PdfjsTextContent["styles"][string];

// Resolved relative to this file's own location rather than via
// `import.meta.resolve` (whose TypeScript ambient typing is not reliably
// available under this package's `lib`/`module` configuration, and whose
// runtime availability across Node versions was not part of this Sprint's
// verified investigation). `pdfjs-dist` is a direct dependency of
// `@bba/bdos-core`, so pnpm always symlinks it into this package's own
// `node_modules`, making this relative path stable regardless of
// monorepo-wide hoisting.
const STANDARD_FONT_DATA_URL = new URL(
  "../../../../node_modules/pdfjs-dist/standard_fonts/",
  import.meta.url,
).toString();

let cachedPdfjsModule: PdfjsModule | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (cachedPdfjsModule === null) {
    cachedPdfjsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return cachedPdfjsModule;
}

export const pdfjsPhysicalDocumentReader: PhysicalDocumentReader = {
  read: readPhysicalDocument,
};

async function readPhysicalDocument(bytes: Uint8Array): Promise<PhysicalDocumentReadResult> {
  const sourceByteHash = hashSourceBytes(bytes);

  if (bytes.byteLength === 0) {
    return buildFailedResult(sourceByteHash, null, "document_bytes_empty");
  }

  const pdfjs = await loadPdfjs();
  const underlyingLibraryVersion = getUnderlyingLibraryVersion(pdfjs);

  let doc: PdfjsDocumentProxy;
  let loadingTaskDestroy: () => Promise<void>;

  try {
    const loadingTask = pdfjs.getDocument({
      // A copy, never the caller's own `bytes` reference: `pdfjs-dist`
      // takes ownership of and transfers/detaches a `TypedArray` passed as
      // `data` (documented in its own `DocumentInitParameters.data` JSDoc),
      // which would otherwise silently empty the caller's buffer as a side
      // effect of reading it — violating the port's contract that `read`
      // receives immutable bytes. Confirmed empirically: without this
      // copy, a second `read()` call on the same `Uint8Array` observed an
      // already-detached, zero-length buffer.
      data: bytes.slice(),
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
      verbosity: 0,
    });
    loadingTaskDestroy = () => loadingTask.destroy();
    doc = await loadingTask.promise;
  } catch (err) {
    const code = classifyDocumentOpenFailure(err, pdfjs);
    return buildFailedResult(sourceByteHash, underlyingLibraryVersion, code);
  }

  try {
    const pages: PhysicalDocumentPage[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      pages.push(await readPhysicalPage(doc, pageNumber));
    }

    const status: PhysicalDocumentReadStatus = pages.some((page) => page.technicalProblems.length > 0)
      ? "completed_with_page_failures"
      : "completed";

    return {
      schemaVersion: PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
      readerName: PHYSICAL_DOCUMENT_READER_NAME,
      readerVersion: PHYSICAL_DOCUMENT_READER_VERSION,
      adapterVersion: PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION,
      underlyingLibraryVersion,
      sourceByteHash,
      totalPageCount: doc.numPages,
      pages,
      status,
      technicalProblems: [],
      ...buildGeometryContextFields(sourceByteHash, underlyingLibraryVersion),
    };
  } finally {
    await doc.cleanup();
    await loadingTaskDestroy();
  }
}

async function readPhysicalPage(doc: PdfjsDocumentProxy, pageNumber: number): Promise<PhysicalDocumentPage> {
  const problems: PhysicalDocumentTechnicalProblem[] = [];
  let page: PdfjsPageProxy;

  try {
    page = await doc.getPage(pageNumber);
  } catch {
    problems.push(createTechnicalProblem("page_load_failed", "page", pageNumber));
    return buildUnreadablePage(pageNumber, problems);
  }

  try {
    let widthPoints: number | null = null;
    let heightPoints: number | null = null;
    let rotationDegrees: number | null = null;
    let viewport: PdfjsPageViewport | null = null;

    try {
      viewport = page.getViewport({ scale: 1 });
      widthPoints = viewport.width;
      heightPoints = viewport.height;
      rotationDegrees = viewport.rotation;
    } catch {
      problems.push(createTechnicalProblem("page_geometry_unavailable", "page", pageNumber));
    }

    let textItems: ReadonlyArray<PhysicalDocumentTextItem> = [];
    let extractionAvailability: PhysicalDocumentTextExtractionAvailability;

    try {
      const textContent = await page.getTextContent();
      const admittedRawItems = textContent.items.filter(hasStr);

      let normalizationFailureOccurred = false;
      textItems = admittedRawItems.map((rawItem, index) => {
        const placement = safeDeriveTextItemPlacement(rawItem, textContent.styles, viewport, widthPoints, heightPoints, () => {
          normalizationFailureOccurred = true;
        });
        return { index, text: rawItem.str, placement };
      });

      if (normalizationFailureOccurred) {
        problems.push(createTechnicalProblem("page_text_item_geometry_normalization_failed", "page", pageNumber));
      }

      extractionAvailability = textItems.length > 0 ? "text_available" : "no_extractable_text";
    } catch {
      problems.push(createTechnicalProblem("page_text_extraction_failed", "page", pageNumber));
      extractionAvailability = "extraction_failed";
    }

    const rawItemTexts = textItems.map((item) => item.text);

    return {
      pageNumber,
      widthPoints,
      heightPoints,
      rotationDegrees,
      orientation: derivePageOrientation(widthPoints, heightPoints),
      textItems,
      normalizedText: normalizePageText(rawItemTexts),
      metrics: computePageTextMetrics(rawItemTexts),
      textItemPlacementMetrics: computeTextItemPlacementMetrics(textItems),
      extractionAvailability,
      technicalProblems: problems,
    };
  } finally {
    page.cleanup();
  }
}

/**
 * Deriva a disposição geométrica de um item, isolando qualquer exceção
 * inesperada para este item específico (Sprint 21.4A.2.f.0, seção 30) —
 * nunca aborta o processamento dos demais itens da página. `onFailure` é
 * chamado no máximo uma vez por página, do lado de fora, para agregar no
 * máximo um problema técnico de página, mesmo que vários itens falhem.
 */
function safeDeriveTextItemPlacement(
  rawItem: PdfjsTextItem,
  styles: PdfjsTextContent["styles"],
  viewport: PdfjsPageViewport | null,
  pageWidthPoints: number | null,
  pageHeightPoints: number | null,
  onFailure: () => void,
): PhysicalDocumentTextItemPlacement {
  try {
    const rawStyle: PdfjsTextStyle | undefined = styles[rawItem.fontName];
    return deriveTextItemPlacement({
      itemTransform: rawItem.transform ?? null,
      itemWidth: rawItem.width ?? null,
      itemDir: rawItem.dir ?? null,
      style: rawStyle === undefined ? null : { ascent: rawStyle.ascent, descent: rawStyle.descent, vertical: rawStyle.vertical },
      viewportTransform: viewport === null ? null : viewport.transform,
      pageWidthPoints,
      pageHeightPoints,
    });
  } catch {
    onFailure();
    return { status: "unresolved_normalization_failed", geometry: null, reasonCode: "text_item_geometry_normalization_failed" };
  }
}

function hasStr(item: PdfjsTextContentItem): item is PdfjsTextItem {
  return "str" in item;
}

function buildUnreadablePage(
  pageNumber: number,
  problems: ReadonlyArray<PhysicalDocumentTechnicalProblem>,
): PhysicalDocumentPage {
  return {
    pageNumber,
    widthPoints: null,
    heightPoints: null,
    rotationDegrees: null,
    orientation: derivePageOrientation(null, null),
    textItems: [],
    normalizedText: normalizePageText([]),
    metrics: computePageTextMetrics([]),
    textItemPlacementMetrics: computeTextItemPlacementMetrics([]),
    extractionAvailability: "extraction_failed",
    technicalProblems: problems,
  };
}

function buildFailedResult(
  sourceByteHash: string,
  underlyingLibraryVersion: string | null,
  code: PhysicalDocumentTechnicalProblemCode,
): PhysicalDocumentReadResult {
  return {
    schemaVersion: PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
    readerName: PHYSICAL_DOCUMENT_READER_NAME,
    readerVersion: PHYSICAL_DOCUMENT_READER_VERSION,
    adapterVersion: PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION,
    underlyingLibraryVersion,
    sourceByteHash,
    totalPageCount: 0,
    pages: [],
    status: "failed",
    technicalProblems: [createTechnicalProblem(code, "document", null)],
    ...buildGeometryContextFields(sourceByteHash, underlyingLibraryVersion),
  };
}

/**
 * Campos de contexto geométrico presentes em todo resultado, inclusive
 * `failed` (Sprint 21.4A.2.f.0, seção 18) — identificam o contrato
 * técnico utilizado independentemente do sucesso da leitura.
 */
function buildGeometryContextFields(
  sourceByteHash: string,
  underlyingLibraryVersion: string | null,
): Pick<
  PhysicalDocumentReadResult,
  | "textItemCoordinateSpaceVersion"
  | "textItemGeometryProfileVersion"
  | "geometryContextFingerprintVersion"
  | "geometryContextFingerprint"
> {
  return {
    textItemCoordinateSpaceVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
    textItemGeometryProfileVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
    geometryContextFingerprintVersion: PHYSICAL_DOCUMENT_GEOMETRY_CONTEXT_FINGERPRINT_VERSION,
    geometryContextFingerprint: computeGeometryContextFingerprint({
      sourceByteHash,
      physicalReadSchemaVersion: PHYSICAL_DOCUMENT_READ_SCHEMA_VERSION,
      readerName: PHYSICAL_DOCUMENT_READER_NAME,
      readerVersion: PHYSICAL_DOCUMENT_READER_VERSION,
      adapterVersion: PDFJS_PHYSICAL_DOCUMENT_READER_ADAPTER_VERSION,
      underlyingLibraryVersion,
      coordinateSpaceVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
      geometryProfileVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
    }),
  };
}

function classifyDocumentOpenFailure(err: unknown, pdfjs: PdfjsModule): PhysicalDocumentTechnicalProblemCode {
  if (err instanceof pdfjs.PasswordException) {
    return "document_protected";
  }
  if (err instanceof pdfjs.InvalidPDFException) {
    return "document_invalid_structure";
  }
  return "document_open_failed";
}

function getUnderlyingLibraryVersion(pdfjs: PdfjsModule): string | null {
  const version = pdfjs.version;
  return typeof version === "string" && version.length > 0 ? `${UNDERLYING_LIBRARY_NAME}@${version}` : null;
}

function hashSourceBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
