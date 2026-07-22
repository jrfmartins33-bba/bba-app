/**
 * Adaptador exclusivamente mecânico do schema real do PaddleOCR 3.7.0
 * (`paddlex`/`paddlepaddle` 3.3.1, `enable_mkldnn=False`), inspecionado
 * diretamente nas saídas brutas reais congeladas no Momento 3B.1
 * (cada execução serializa `[{res: {...}}]`, um único resultado por
 * imagem de entrada) — nunca lembrado de memória (Sprint 21.4B.3A.3,
 * Momento 3B.2).
 *
 * Fatos confirmados empiricamente contra as 6 aquisições brutas reais
 * (nunca presumidos):
 * - `res.rec_texts`, `res.rec_scores` e `res.rec_boxes` são arrays
 *   paralelos de mesmo comprimento — um item por região de texto
 *   detectada.
 * - `res.rec_boxes[i]` é `[xMin, yMin, xMax, yMax]` em PIXELS, origem
 *   superior esquerda (convenção padrão, documentada, desta biblioteca
 *   para saída de detecção — confirmada empiricamente: a primeira
 *   região detectada, com y ≈ 0–32, corresponde ao cabeçalho
 *   institucional no topo físico da página).
 * - Esta configuração (pipeline `PaddleOCR(...)` de OCR geral, os 5
 *   modelos já inventariados no Momento 1: PP-LCNet_x1_0_doc_ori,
 *   UVDoc, PP-LCNet_x1_0_textline_ori, PP-OCRv6_medium_det,
 *   PP-OCRv6_medium_rec) NÃO inclui nenhum submódulo de reconhecimento
 *   de estrutura de tabela — `res` nunca contém linhas, colunas ou
 *   células. Este adaptador, portanto, SEMPRE retorna `tables: []` e
 *   `cells: []` — não uma omissão do adaptador, mas um fato honesto
 *   sobre a capacidade desta configuração congelada.
 *
 * Restrições (§ Momento 3B.2 do enunciado): produz somente o formato
 * canônico já congelado; usa somente a conversão de coordenadas já
 * congelada; não importa a verdade de referência; não conhece os 80
 * itens, códigos, textos esperados ou páginas como casos especiais;
 * não corrige OCR; não infere grupos, subgrupos ou itens; não executa
 * reconciliação matemática; não usa fuzzy matching; não remove
 * conteúdo externo por semântica.
 */

import { convertLocalReaderBoundingBox } from "../discovery-local-reader-coordinates";
import type { LocalReaderObservedCell, LocalReaderObservedRegion, LocalReaderObservedTable, LocalReaderPageGeometry, LocalReaderRawBoundingBox } from "../discovery-local-reader-evaluation.types";

interface PaddleOcrRawRes {
  readonly rec_texts?: ReadonlyArray<string>;
  readonly rec_scores?: ReadonlyArray<number>;
  readonly rec_boxes?: ReadonlyArray<ReadonlyArray<number>>;
}

export type PaddleOcrRawExport = ReadonlyArray<{ readonly res?: PaddleOcrRawRes }>;

export interface PaddleOcrAdapterResult {
  readonly regions: ReadonlyArray<LocalReaderObservedRegion>;
  readonly tables: ReadonlyArray<LocalReaderObservedTable>;
  readonly cells: ReadonlyArray<LocalReaderObservedCell>;
}

export function parsePaddleOcrRawExport(rawExport: PaddleOcrRawExport, realPageNumber: number, pageGeometry: LocalReaderPageGeometry): PaddleOcrAdapterResult {
  const regions: LocalReaderObservedRegion[] = [];

  const res = rawExport[0]?.res;
  const texts = res?.rec_texts ?? [];
  const scores = res?.rec_scores ?? [];
  const boxes = res?.rec_boxes ?? [];

  texts.forEach((text, index) => {
    const rawCoords = boxes[index];
    const rawBox: LocalReaderRawBoundingBox | null =
      rawCoords && rawCoords.length === 4
        ? { originConvention: "top_left", unit: "pixels", xMin: rawCoords[0], yMin: rawCoords[1], xMax: rawCoords[2], yMax: rawCoords[3] }
        : null;
    const conversion = rawBox ? convertLocalReaderBoundingBox(rawBox, pageGeometry) : null;

    regions.push({
      id: `paddleocr-region-${index}`,
      tool: "paddleocr",
      realPageNumber,
      literalText: text,
      rawBoundingBox: rawBox ?? { originConvention: "unknown", unit: "unknown", xMin: 0, yMin: 0, xMax: 0, yMax: 0 },
      convertedBoundingBox: conversion?.box ?? null,
      conversionInterruptionReasonPt: conversion ? conversion.interruptedPt : "Região sem rec_boxes correspondente no export bruto do PaddleOCR.",
      readerConfidence: scores[index] ?? null,
      readerNativeType: null,
      rawElementReferencePt: `res.rec_texts[${index}]`,
    });
  });

  // Esta configuração do PaddleOCR (pipeline de OCR geral, sem submódulo de
  // estrutura de tabela) nunca produz tabelas ou células — ver cabeçalho.
  return { regions, tables: [], cells: [] };
}
