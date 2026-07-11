/**
 * Par FISICO/FINANCEIRO de um período MED-NN dentro da grade
 * histórica (colunas W:AR no BM_08 real). Achado do Epic 19/Sprint 4C
 * (revisão pós-19.4A/4C): essa grade é preenchida manualmente, sem
 * fórmula, e não reconcilia com a fonte oficial do período corrente
 * (`DetectedOfficialPeriodColumn`) — mantida apenas para auditoria,
 * nunca para alimentar `ParsedMeasurementLine`.
 */
export interface DetectedBulletinPeriodColumn {
  readonly label: string;
  readonly periodNumber: number;
  readonly physicalColumnIndex: number;
  readonly financialColumnIndex: number;
}

/**
 * Bloco "CONTROLE FINANCEIRO – MEDIÇÃO" (QUANTITATIVO / VALOR (R$)) —
 * fonte autoritativa do período corrente. No BM_08 real essas colunas
 * são ligadas por fórmula à aba `BOLETIM FÍSICO FINANCEIRO` e
 * reconciliam exatamente com o total oficial do rodapé do boletim.
 * Detectado semanticamente pelo texto do cabeçalho, não por posição
 * fixa — arquivos de outros boletins do mesmo órgão podem deslocar as
 * colunas.
 */
export interface DetectedOfficialPeriodColumn {
  readonly headerLabel: string;
  readonly quantityColumnIndex: number;
  readonly valueColumnIndex: number;
}

/**
 * Coluna de texto livre sem cabeçalho reconhecido, situada entre o
 * bloco contratual e a grade de períodos, com valores que não
 * correspondem de forma confiável a nenhuma estrutura conhecida da
 * planilha (achado real: coluna N do BM_08 — texto órfão, sem
 * fórmula, parcialmente coincidente com a descrição oficial por pura
 * coincidência de conteúdo, não por relação estrutural).
 */
export interface DetectedOrphanColumn {
  readonly columnIndex: number;
  readonly valueCount: number;
  readonly matchingNameColumnCount: number;
}

export interface BulletinSheetDetectionResult {
  readonly periodLabelRowIndex: number;
  readonly subHeaderRowIndex: number;
  readonly codeColumnIndex: number | null;
  readonly nameColumnIndex: number | null;
  readonly unitColumnIndex: number | null;
  readonly contractQuantityColumnIndex: number | null;
  readonly unitPriceColumnIndex: number | null;
  /** Grade histórica MED-NN -- não autoritativa, ver `DetectedBulletinPeriodColumn`. */
  readonly periodColumns: ReadonlyArray<DetectedBulletinPeriodColumn>;
  /** Fonte autoritativa do período corrente; `null` se o bloco não foi encontrado. */
  readonly officialPeriodColumn: DetectedOfficialPeriodColumn | null;
  readonly orphanColumns: ReadonlyArray<DetectedOrphanColumn>;
  /** code + name + >=1 período pareado corretamente + preço unitário. */
  readonly confidence: number;
}
