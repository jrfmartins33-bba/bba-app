/**
 * Adaptador exclusivamente mecânico do schema real do Docling 2.114.0
 * (`docling_core` instalado, `DoclingDocument.export_to_dict()`),
 * inspecionado diretamente nas classes Python instaladas
 * (`docling_core.types.doc.document.TableCell`, `TextItem`,
 * `ProvenanceItem`) e nas saídas brutas reais congeladas no Momento
 * 3B.1 — nunca lembrado de memória (Sprint 21.4B.3A.3, Momento 3B.2).
 *
 * Fatos confirmados empiricamente contra as 6 aquisições brutas reais
 * (nunca presumidos):
 * - Entrada `InputFormat.IMAGE`: `pages["1"].size` é EXATAMENTE as
 *   dimensões em pixels da imagem de entrada (3308×2339 nas 3
 *   páginas) — Docling trata a página, neste modo, em unidade de
 *   pixel, nunca em pontos. Por isso a unidade bruta é sempre
 *   `"pixels"` nesta configuração, nunca adivinhada por caixa.
 * - `bbox.coord_origin` é sempre `"TOPLEFT"` ou `"BOTTOMLEFT"`,
 *   explícito por região — mapeado 1:1, nunca assumido.
 * - Sem motor de OCR configurado (mesma configuração já inventariada e
 *   aprovada no Momento 1): `texts` veio vazio nas 6 aquisições reais
 *   — nenhuma correção ou suposição de texto é aplicada aqui; o
 *   adaptador apenas mapeia o que existir em `texts`, vazio ou não.
 * - `TableCell` não expõe campo de confiança nesta versão (verificado
 *   no schema Pydantic instalado) — `readerConfidence` é sempre
 *   `null` para células e regiões de tabela.
 * - `page_no` interno do Docling é sempre `1` (documento de página
 *   única sintetizado a partir de uma única imagem) — NUNCA a página
 *   real do orçamento; a página real é sempre um parâmetro explícito
 *   deste adaptador, nunca lida do JSON bruto.
 *
 * Restrições (§ Momento 3B.2 do enunciado): produz somente o formato
 * canônico já congelado; usa somente a conversão de coordenadas já
 * congelada; não importa a verdade de referência; não conhece os 80
 * itens, códigos, textos esperados ou páginas como casos especiais;
 * não corrige OCR; não reorganiza células; não infere grupos,
 * subgrupos ou itens; não executa reconciliação matemática; não usa
 * fuzzy matching; não remove conteúdo externo por semântica.
 */

import { convertLocalReaderBoundingBox } from "../discovery-local-reader-coordinates";
import type {
  LocalReaderCoordinateOriginConvention,
  LocalReaderObservedCell,
  LocalReaderObservedRegion,
  LocalReaderObservedTable,
  LocalReaderPageGeometry,
  LocalReaderRawBoundingBox,
} from "../discovery-local-reader-evaluation.types";

interface DoclingRawBBox {
  readonly l: number;
  readonly t: number;
  readonly r: number;
  readonly b: number;
  readonly coord_origin?: string;
}

interface DoclingRawProv {
  readonly page_no?: number;
  readonly bbox?: DoclingRawBBox;
}

interface DoclingRawTextItem {
  readonly text?: string;
  readonly label?: string;
  readonly prov?: ReadonlyArray<DoclingRawProv>;
}

interface DoclingRawPictureItem {
  readonly label?: string;
  readonly prov?: ReadonlyArray<DoclingRawProv>;
}

interface DoclingRawTableCell {
  readonly bbox?: DoclingRawBBox | null;
  readonly row_span?: number;
  readonly col_span?: number;
  readonly start_row_offset_idx?: number;
  readonly start_col_offset_idx?: number;
  readonly text?: string;
}

interface DoclingRawTable {
  readonly label?: string;
  readonly prov?: ReadonlyArray<DoclingRawProv>;
  readonly data?: {
    readonly num_rows?: number;
    readonly num_cols?: number;
    readonly table_cells?: ReadonlyArray<DoclingRawTableCell>;
  };
}

export interface DoclingRawExport {
  readonly texts?: ReadonlyArray<DoclingRawTextItem>;
  readonly pictures?: ReadonlyArray<DoclingRawPictureItem>;
  readonly tables?: ReadonlyArray<DoclingRawTable>;
}

export interface DoclingAdapterResult {
  readonly regions: ReadonlyArray<LocalReaderObservedRegion>;
  readonly tables: ReadonlyArray<LocalReaderObservedTable>;
  readonly cells: ReadonlyArray<LocalReaderObservedCell>;
}

function mapDoclingOrigin(rawOrigin: string | undefined): LocalReaderCoordinateOriginConvention {
  if (rawOrigin === "TOPLEFT") return "top_left";
  if (rawOrigin === "BOTTOMLEFT") return "bottom_left";
  return "unknown";
}

function toRawBoundingBox(bbox: DoclingRawBBox | null | undefined): LocalReaderRawBoundingBox | null {
  if (!bbox) return null;
  return {
    originConvention: mapDoclingOrigin(bbox.coord_origin),
    unit: "pixels",
    xMin: bbox.l,
    xMax: bbox.r,
    yMin: bbox.b < bbox.t ? bbox.b : bbox.t,
    yMax: bbox.b < bbox.t ? bbox.t : bbox.b,
  };
}

function convertOrNull(rawBox: LocalReaderRawBoundingBox | null, pageGeometry: LocalReaderPageGeometry) {
  if (!rawBox) return { converted: null, interruptedPt: "Região sem bbox no export bruto do Docling." };
  const result = convertLocalReaderBoundingBox(rawBox, pageGeometry);
  return { converted: result.box, interruptedPt: result.interruptedPt };
}

export function parseDoclingRawExport(rawExport: DoclingRawExport, realPageNumber: number, pageGeometry: LocalReaderPageGeometry): DoclingAdapterResult {
  const regions: LocalReaderObservedRegion[] = [];
  const tables: LocalReaderObservedTable[] = [];
  const cells: LocalReaderObservedCell[] = [];

  (rawExport.texts ?? []).forEach((item, index) => {
    const prov = item.prov?.[0];
    const rawBox = toRawBoundingBox(prov?.bbox);
    const { converted, interruptedPt } = convertOrNull(rawBox, pageGeometry);
    regions.push({
      id: `docling-text-${index}`,
      tool: "docling",
      realPageNumber,
      literalText: item.text ?? "",
      rawBoundingBox: rawBox ?? { originConvention: "unknown", unit: "unknown", xMin: 0, yMin: 0, xMax: 0, yMax: 0 },
      convertedBoundingBox: converted,
      conversionInterruptionReasonPt: converted ? null : interruptedPt,
      readerConfidence: null,
      readerNativeType: item.label ?? null,
      rawElementReferencePt: `texts[${index}]`,
    });
  });

  (rawExport.pictures ?? []).forEach((item, index) => {
    const prov = item.prov?.[0];
    const rawBox = toRawBoundingBox(prov?.bbox);
    const { converted, interruptedPt } = convertOrNull(rawBox, pageGeometry);
    regions.push({
      id: `docling-picture-${index}`,
      tool: "docling",
      realPageNumber,
      literalText: "",
      rawBoundingBox: rawBox ?? { originConvention: "unknown", unit: "unknown", xMin: 0, yMin: 0, xMax: 0, yMax: 0 },
      convertedBoundingBox: converted,
      conversionInterruptionReasonPt: converted ? null : interruptedPt,
      readerConfidence: null,
      readerNativeType: item.label ?? "picture",
      rawElementReferencePt: `pictures[${index}]`,
    });
  });

  (rawExport.tables ?? []).forEach((table, tableIndex) => {
    const tableId = `docling-table-${tableIndex}`;
    const prov = table.prov?.[0];
    const rawBox = toRawBoundingBox(prov?.bbox);
    const { converted, interruptedPt } = convertOrNull(rawBox, pageGeometry);

    regions.push({
      id: tableId,
      tool: "docling",
      realPageNumber,
      literalText: "",
      rawBoundingBox: rawBox ?? { originConvention: "unknown", unit: "unknown", xMin: 0, yMin: 0, xMax: 0, yMax: 0 },
      convertedBoundingBox: converted,
      conversionInterruptionReasonPt: converted ? null : interruptedPt,
      readerConfidence: null,
      readerNativeType: table.label ?? "table",
      rawElementReferencePt: `tables[${tableIndex}]`,
    });

    const cellIds: string[] = [];
    (table.data?.table_cells ?? []).forEach((cell, cellIndex) => {
      const cellId = `${tableId}-cell-${cellIndex}`;
      cellIds.push(cellId);
      const cellRawBox = toRawBoundingBox(cell.bbox ?? null);
      const cellConverted = cellRawBox ? convertLocalReaderBoundingBox(cellRawBox, pageGeometry).box : null;
      const rowSpan = cell.row_span ?? 1;
      const colSpan = cell.col_span ?? 1;
      cells.push({
        id: cellId,
        tool: "docling",
        realPageNumber,
        tableId,
        proposedRowIndex: cell.start_row_offset_idx ?? 0,
        proposedColumnIndex: cell.start_col_offset_idx ?? 0,
        literalText: cell.text ?? "",
        boundingBox: cellConverted,
        relatedRegionIds: [],
        nativeMergeIndicationPt: rowSpan > 1 || colSpan > 1 ? `row_span=${rowSpan}, col_span=${colSpan}` : null,
      });
    });

    tables.push({
      id: tableId,
      tool: "docling",
      realPageNumber,
      boundingBox: converted,
      rowCount: table.data?.num_rows ?? 0,
      columnCount: table.data?.num_cols ?? 0,
      cellIds,
    });
  });

  return { regions, tables, cells };
}
