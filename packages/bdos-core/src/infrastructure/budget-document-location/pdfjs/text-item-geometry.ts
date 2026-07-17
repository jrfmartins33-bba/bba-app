import { canonicalizeGeometryPoints } from "../../../domain/budget-document-location/physical-document-text-item-geometry-canonicalization";
import { deriveTextItemPageBoundsRelation } from "../../../domain/budget-document-location/physical-document-text-item-page-bounds-relation";
import {
  PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
  PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
} from "../../../domain/budget-document-location/physical-document-read.types";
import type {
  PhysicalDocumentTextItemGeometryProblemCode,
  PhysicalDocumentTextItemPlacement,
} from "../../../domain/budget-document-location/physical-document-read.types";

/**
 * Derivação geométrica pura de um item textual (Sprint 21.4A.2.f.0).
 *
 * Deliberadamente definida com tipos locais simples (arrays de `number`,
 * `string | null | undefined`) em vez dos tipos concretos de `pdfjs-dist`
 * (`TextItem`, `TextStyle`, `PageViewport`) — este arquivo nunca importa
 * `pdfjs-dist` (guard arquitetural), embora resida fisicamente ao lado do
 * único adaptador autorizado a importá-la. Isso também o torna testável
 * com entradas fabricadas (orientação `ttb`, matrizes inclinadas, estilo
 * ausente, etc.) sem depender do comportamento real da biblioteca.
 *
 * Fundamentação empírica da composição (Sprint 21.4A.2.f.0, seção 7):
 * `PageViewport.transform` usa exclusivamente coeficientes exatos
 * (±1, 0) multiplicados pela escala — nenhuma trigonometria — para as
 * quatro rotações suportadas (0°/90°/180°/270°); confirmado lendo o
 * código-fonte da própria `pdfjs-dist@6.1.200`
 * (`legacy/build/pdf.mjs`, classe `PageViewport`). `TextItem.width` é o
 * avanço horizontal já em unidades de espaço PDF absoluto (não uma
 * fração a ser multiplicada pela escala da matriz) — confirmado
 * empiricamente: para "AB" em Helvetica 24pt, `width` é `32.016`,
 * batendo exatamente com os larguras de glifo padrão do AFM
 * (`(722+722)/1000 × 24`... na prática 667+667 unidades/1000 × 24 =
 * 32.016). `TextStyle.ascent`/`descent` são frações do tamanho de fonte
 * (magnitude do eixo y local de `item.transform`), não pontos absolutos.
 */

export interface TextItemGeometryStyleInput {
  readonly ascent: number;
  readonly descent: number;
  readonly vertical: boolean;
}

export interface TextItemGeometryInput {
  /** `TextItem.transform` — 6 componentes `[a, b, c, d, e, f]`, ou ausente. */
  readonly itemTransform: ReadonlyArray<number> | null | undefined;
  /** `TextItem.width`, ou ausente. */
  readonly itemWidth: number | null | undefined;
  /** `TextItem.dir` — apenas `"ltr"` é comprovadamente suportado nesta versão. */
  readonly itemDir: string | null | undefined;
  /** `TextContent.styles[item.fontName]`, ou ausente se não encontrado. */
  readonly style: TextItemGeometryStyleInput | null | undefined;
  /** `PageViewport.transform` (com `scale: 1`) — 6 componentes, ou ausente. */
  readonly viewportTransform: ReadonlyArray<number> | null | undefined;
  /** `PageViewport.width` (com `scale: 1`), ou `null` se a geometria da página está indisponível. */
  readonly pageWidthPoints: number | null;
  /** `PageViewport.height` (com `scale: 1`), ou `null` se a geometria da página está indisponível. */
  readonly pageHeightPoints: number | null;
}

/**
 * Deriva a disposição geométrica de um único item textual. Nunca lança —
 * toda condição previsível (ausência, invalidade, orientação não
 * suportada) resulta em um `PhysicalDocumentTextItemPlacement` não
 * resolvido com o `reasonCode` correspondente. Uma exceção inesperada
 * (bug, não uma condição de negócio prevista) ainda pode escapar desta
 * função — o chamador (o adaptador, por item) é responsável por
 * `unresolved_normalization_failed` nesse caso (Sprint 21.4A.2.f.0,
 * seção 30).
 */
export function deriveTextItemPlacement(input: TextItemGeometryInput): PhysicalDocumentTextItemPlacement {
  const { itemTransform, itemWidth, itemDir, style, viewportTransform, pageWidthPoints, pageHeightPoints } = input;

  if (
    itemTransform === null ||
    itemTransform === undefined ||
    itemWidth === null ||
    itemWidth === undefined ||
    style === null ||
    style === undefined ||
    viewportTransform === null ||
    viewportTransform === undefined ||
    pageWidthPoints === null ||
    pageHeightPoints === null
  ) {
    return unresolvedPlacement("unresolved_missing_geometry", "text_item_geometry_missing");
  }

  if (!isFiniteSixComponentMatrix(itemTransform) || !isFiniteSixComponentMatrix(viewportTransform)) {
    return unresolvedPlacement("unresolved_invalid_geometry", "text_item_geometry_invalid");
  }

  if (!Number.isFinite(itemWidth) || itemWidth < 0) {
    return unresolvedPlacement("unresolved_invalid_geometry", "text_item_geometry_invalid");
  }

  if (!Number.isFinite(style.ascent) || !Number.isFinite(style.descent)) {
    return unresolvedPlacement("unresolved_invalid_geometry", "text_item_geometry_invalid");
  }

  if (!Number.isFinite(pageWidthPoints) || pageWidthPoints <= 0 || !Number.isFinite(pageHeightPoints) || pageHeightPoints <= 0) {
    return unresolvedPlacement("unresolved_invalid_geometry", "text_item_geometry_invalid");
  }

  if (style.vertical || itemDir !== "ltr" || !hasAxisAlignedLinearPart(itemTransform)) {
    return unresolvedPlacement("unresolved_unsupported_orientation", "text_item_orientation_unsupported");
  }

  const rawBounds = computeRawLayoutBounds(itemTransform, itemWidth, style, viewportTransform);
  if (rawBounds === null) {
    return unresolvedPlacement("unresolved_invalid_geometry", "text_item_geometry_invalid");
  }

  const leftPoints = canonicalizeGeometryPoints(rawBounds.left);
  const topPoints = canonicalizeGeometryPoints(rawBounds.top);
  const rightPoints = canonicalizeGeometryPoints(rawBounds.right);
  const bottomPoints = canonicalizeGeometryPoints(rawBounds.bottom);

  if (leftPoints > rightPoints || topPoints >= bottomPoints) {
    return unresolvedPlacement("unresolved_invalid_geometry", "text_item_geometry_invalid");
  }

  const widthPoints = canonicalizeGeometryPoints(rightPoints - leftPoints);
  const heightPoints = canonicalizeGeometryPoints(bottomPoints - topPoints);
  const centerXPoints = canonicalizeGeometryPoints((leftPoints + rightPoints) / 2);
  const centerYPoints = canonicalizeGeometryPoints((topPoints + bottomPoints) / 2);

  if (widthPoints < 0 || heightPoints <= 0) {
    return unresolvedPlacement("unresolved_invalid_geometry", "text_item_geometry_invalid");
  }

  const canonicalPageWidthPoints = canonicalizeGeometryPoints(pageWidthPoints);
  const canonicalPageHeightPoints = canonicalizeGeometryPoints(pageHeightPoints);

  const pageBoundsRelation = deriveTextItemPageBoundsRelation(
    { leftPoints, topPoints, rightPoints, bottomPoints },
    canonicalPageWidthPoints,
    canonicalPageHeightPoints,
  );

  return {
    status: "placed",
    geometry: {
      leftPoints,
      topPoints,
      rightPoints,
      bottomPoints,
      widthPoints,
      heightPoints,
      centerXPoints,
      centerYPoints,
      pageBoundsRelation,
      coordinateSpaceVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_COORDINATE_SPACE_VERSION,
      geometryProfileVersion: PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_PROFILE_VERSION,
    },
    reasonCode: null,
  };
}

function unresolvedPlacement(
  status: "unresolved_missing_geometry" | "unresolved_invalid_geometry" | "unresolved_unsupported_orientation",
  reasonCode: PhysicalDocumentTextItemGeometryProblemCode,
): PhysicalDocumentTextItemPlacement {
  return { status, geometry: null, reasonCode };
}

function isFiniteSixComponentMatrix(matrix: ReadonlyArray<number>): boolean {
  return matrix.length === 6 && matrix.every((component) => typeof component === "number" && Number.isFinite(component));
}

/**
 * O item é considerado sem inclinação/cisalhamento quando seu eixo x
 * local mapeia inteiramente para um eixo global (b=0,c=0) ou inteiramente
 * para o outro (a=0,d=0) — o padrão exato produzido por texto horizontal
 * comum (`Tf`+`Td`/`Tm` sem rotação), e preservado por composição com o
 * viewport porque `PageViewport.transform` é, para as quatro rotações
 * suportadas, ele mesmo uma permutação de eixos exata (sem trigonometria,
 * ver caracterização no topo do arquivo) — nunca precisa ser verificado
 * aqui porque a álgebra garante que compor um item já axis-aligned com um
 * viewport axis-aligned permanece axis-aligned, para qualquer uma das
 * quatro rotações suportadas. Matrizes inclinadas ou cisalhadas (nenhum
 * dos dois padrões) falham este teste.
 */
function hasAxisAlignedLinearPart(matrix: ReadonlyArray<number>): boolean {
  const [a, b, c, d] = matrix;
  return (b === 0 && c === 0) || (a === 0 && d === 0);
}

interface RawLayoutBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * Constrói o quadrilátero local do item (usando o avanço horizontal
 * absoluto `width` e o tamanho de fonte absoluto — magnitude do eixo y
 * local — multiplicado pelas frações de ascent/descent), transforma seus
 * quatro cantos pelo viewport, e devolve a bounding box axis-aligned
 * (mínimo/máximo). Para as orientações já comprovadas suportadas
 * (`hasAxisAlignedLinearPart`), essa bounding box é a área exata do
 * quadrilátero transformado, não uma aproximação.
 */
function computeRawLayoutBounds(
  itemTransform: ReadonlyArray<number>,
  itemWidth: number,
  style: TextItemGeometryStyleInput,
  viewportTransform: ReadonlyArray<number>,
): RawLayoutBounds | null {
  const [a, b, c, d, e, f] = itemTransform;
  const fontSize = Math.hypot(c, d);
  if (fontSize === 0) {
    return null;
  }

  const xAxisMagnitude = Math.hypot(a, b);
  const ux = xAxisMagnitude === 0 ? 0 : a / xAxisMagnitude;
  const uy = xAxisMagnitude === 0 ? 0 : b / xAxisMagnitude;
  const vx = c / fontSize;
  const vy = d / fontSize;

  const startX = e;
  const startY = f;
  const endX = e + itemWidth * ux;
  const endY = f + itemWidth * uy;

  const ascentOffsetX = vx * fontSize * style.ascent;
  const ascentOffsetY = vy * fontSize * style.ascent;
  const descentOffsetX = vx * fontSize * style.descent;
  const descentOffsetY = vy * fontSize * style.descent;

  const corners: ReadonlyArray<readonly [number, number]> = [
    [startX + descentOffsetX, startY + descentOffsetY],
    [endX + descentOffsetX, endY + descentOffsetY],
    [endX + ascentOffsetX, endY + ascentOffsetY],
    [startX + ascentOffsetX, startY + ascentOffsetY],
  ];

  const transformedCorners = corners.map(([x, y]) => applyAffineTransform(viewportTransform, x, y));
  const xs = transformedCorners.map(([x]) => x);
  const ys = transformedCorners.map(([, y]) => y);

  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  if (![left, right, top, bottom].every(Number.isFinite)) {
    return null;
  }

  return { left, top, right, bottom };
}

function applyAffineTransform(matrix: ReadonlyArray<number>, x: number, y: number): readonly [number, number] {
  return [x * matrix[0] + y * matrix[2] + matrix[4], x * matrix[1] + y * matrix[3] + matrix[5]];
}
