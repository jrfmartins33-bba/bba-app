/**
 * Renderizador SVG determinístico e genérico da geometria esperada de
 * uma página. Puro (string in, string out) — nunca lê disco, nunca
 * contém página real ou hash real. Instrumento de validação de
 * desenvolvimento (§17 do enunciado da Sprint), nunca entrada do
 * sistema: nenhum outro módulo desta pasta importa este arquivo.
 */
import type { ReferenceTruthCellGeometry, ReferenceTruthBoundingBox } from "./discovery-reference-truth-cell-geometry.types";

export interface ReferenceTruthCellGeometrySvgColumn {
  readonly id: string;
  readonly leftPoints: number;
  readonly rightPoints: number;
}

export interface ReferenceTruthCellGeometrySvgRow {
  readonly id: string;
  readonly band: ReferenceTruthBoundingBox;
}

export interface ReferenceTruthCellGeometrySvgInput {
  readonly realPageNumber: number;
  readonly pageWidthPoints: number;
  readonly pageHeightPoints: number;
  readonly columns: ReadonlyArray<ReferenceTruthCellGeometrySvgColumn>;
  readonly rows: ReadonlyArray<ReferenceTruthCellGeometrySvgRow>;
  readonly geometries: ReadonlyArray<ReferenceTruthCellGeometry>;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function boxRect(box: ReferenceTruthBoundingBox, attrs: string): string {
  const w = box.rightPoints - box.leftPoints;
  const h = box.bottomPoints - box.topPoints;
  return `<rect x="${fmt(box.leftPoints)}" y="${fmt(box.topPoints)}" width="${fmt(w)}" height="${fmt(h)}" ${attrs} />`;
}

const SHARED_GROUP_PALETTE = ["#e07a5f", "#3d5a80", "#81b29a", "#f2cc8f", "#9b5de5", "#118ab2", "#ef476f", "#06d6a0"];

function colorForSharedGroup(groupId: string): string {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0;
  }
  return SHARED_GROUP_PALETTE[hash % SHARED_GROUP_PALETTE.length];
}

/**
 * Camadas, em ordem determinística de desenho (fundo -> frente): faixas
 * de linha; limites das 12 colunas; segmentos físicos de origem;
 * fragmentos das células (coloridos por grupo compartilhado, quando
 * aplicável); envelopes (contorno tracejado); rótulos de `cellId` (texto
 * pequeno, última camada, sempre presente — "sob demanda" é uma decisão
 * de visualização do consumidor do SVG, nunca deste gerador).
 */
export function renderReferenceTruthCellGeometryPageSvg(input: ReferenceTruthCellGeometrySvgInput): string {
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(input.pageWidthPoints)} ${fmt(input.pageHeightPoints)}" width="${fmt(input.pageWidthPoints)}" height="${fmt(input.pageHeightPoints)}" font-family="monospace">`,
  );
  parts.push(`<title>Reference truth expected cell geometry — page ${input.realPageNumber}</title>`);
  parts.push(boxRect({ leftPoints: 0, topPoints: 0, rightPoints: input.pageWidthPoints, bottomPoints: input.pageHeightPoints }, 'fill="white" stroke="black" stroke-width="1"'));

  // Faixas das linhas.
  parts.push('<g id="row-bands">');
  input.rows.forEach((row) => {
    parts.push(boxRect(row.band, 'fill="#f4f4f4" stroke="#bbbbbb" stroke-width="0.5"'));
  });
  parts.push("</g>");

  // Limites das 12 colunas (linhas verticais full-height).
  parts.push('<g id="column-bounds" stroke="#9999ff" stroke-width="0.6" stroke-dasharray="4,3">');
  input.columns.forEach((column) => {
    parts.push(`<line x1="${fmt(column.leftPoints)}" y1="0" x2="${fmt(column.leftPoints)}" y2="${fmt(input.pageHeightPoints)}" />`);
    parts.push(`<line x1="${fmt(column.rightPoints)}" y1="0" x2="${fmt(column.rightPoints)}" y2="${fmt(input.pageHeightPoints)}" />`);
  });
  parts.push("</g>");

  // Segmentos físicos de origem (caixa bruta, antes da interseção de coluna).
  parts.push('<g id="source-segments" fill="none" stroke="#cccccc" stroke-width="0.5">');
  const drawnSegmentKeys = new Set<string>();
  input.geometries.forEach((geometry) => {
    geometry.fragments.forEach((fragment) => {
      if (fragment.sourceBoundingBox === null || fragment.legacyDeclaredSegmentKey === null) return;
      if (drawnSegmentKeys.has(fragment.legacyDeclaredSegmentKey)) return;
      drawnSegmentKeys.add(fragment.legacyDeclaredSegmentKey);
      parts.push(boxRect(fragment.sourceBoundingBox, ""));
    });
  });
  parts.push("</g>");

  // Fragmentos das células.
  parts.push('<g id="cell-fragments">');
  input.geometries.forEach((geometry) => {
    const strokeColor = geometry.sharedGeometryGroupId !== null ? colorForSharedGroup(geometry.sharedGeometryGroupId) : "#2a9d8f";
    const fillOpacity = geometry.spatialSemantics === "empty_slot" ? "0.08" : "0.18";
    geometry.fragments.forEach((fragment) => {
      parts.push(boxRect(fragment.projectedBoundingBox, `fill="${strokeColor}" fill-opacity="${fillOpacity}" stroke="${strokeColor}" stroke-width="0.8"`));
    });
  });
  parts.push("</g>");

  // Envelopes (contorno tracejado).
  parts.push('<g id="cell-envelopes" fill="none" stroke="#264653" stroke-width="0.7" stroke-dasharray="2,2">');
  input.geometries.forEach((geometry) => {
    parts.push(boxRect(geometry.expectedEnvelope, ""));
  });
  parts.push("</g>");

  // Rótulos de cellId.
  parts.push('<g id="cell-labels" font-size="3.2" fill="#1d1d1d">');
  input.geometries.forEach((geometry) => {
    const box = geometry.expectedEnvelope;
    parts.push(`<text x="${fmt(box.leftPoints + 0.5)}" y="${fmt(box.topPoints + 3)}">${escapeXml(geometry.cellId)}</text>`);
  });
  parts.push("</g>");

  parts.push("</svg>");
  return parts.join("\n");
}
