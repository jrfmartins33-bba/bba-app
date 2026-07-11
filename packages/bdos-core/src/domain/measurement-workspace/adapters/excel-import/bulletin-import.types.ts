/**
 * Epic 19, Sprint 4.0 (Contract Freeze) — contrato congelado entre o
 * parser do Boletim de Medição (Sprint 4C) e o Application Service
 * que o consome (`processMeasurementBulletinImport`, Sprint 4A/D).
 * Só tipos — nenhuma implementação nesta sprint.
 *
 * O parser não conhece Supabase, IDs de banco, `companyId`,
 * `engineeringProjectId`, número oficial de boletim, datas oficiais,
 * status de aggregate, decisão de fechamento nem aceitação de
 * divergência — todas essas decisões pertencem ao Application
 * Service, nunca ao parser. O parser só interpreta o arquivo e
 * relata, nunca decide.
 *
 * Distinção obrigatória em todo o contrato: "declared" é o que o
 * arquivo de origem afirmava; a contraparte oficial (id, número,
 * datas oficiais) é decidida depois, pelo Application Service — nunca
 * o mesmo conceito, mesmo quando os valores coincidem.
 */

export interface BulletinImportInput {
  readonly bytes: Uint8Array;
  readonly fileName: string;
}

/**
 * Uma frente/código de EAP como o arquivo o descreve — não é ainda um
 * `WorkPackage` persistido; o Application Service decide find-or-create
 * contra `work_packages` a partir daqui.
 */
export interface ParsedWorkPackage {
  readonly code: string;
  readonly name: string;
  /** `null` quando o arquivo não deixa hierarquia explícita entre itens. */
  readonly parentCode: string | null;
  readonly isAggregator: boolean;
}

/**
 * Um item de serviço medível como o arquivo o descreve — não é ainda
 * um `ManagedServiceItem` persistido.
 */
export interface ParsedManagedServiceItem {
  readonly code: string;
  readonly workPackageCode: string;
  readonly description: string;
  readonly unit: string | null;
  readonly declaredContractQuantity: number | null;
  readonly declaredUnitPrice: number | null;
}

/**
 * Origem física da linha dentro da planilha — preservada para que uma
 * divergência apontada por `MeasurementImportIssue` seja sempre
 * rastreável até a célula real que a originou, nunca só "linha X do
 * boletim".
 */
export interface ParsedMeasurementLineSourceLocation {
  readonly sheetName: string;
  readonly rowNumber: number;
  readonly physicalColumn?: string;
  readonly financialColumn?: string;
}

export interface ParsedMeasurementLine {
  readonly workPackageCode: string;
  readonly serviceItemCode: string;
  readonly description: string;
  readonly unit: string | null;

  /** O que o arquivo declarava — nunca o valor oficial da linha. */
  readonly declaredQuantity: number | null;
  readonly declaredUnitValue: number | null;
  readonly declaredTotalValue: number | null;

  /**
   * Rótulo textual do período tal como a planilha o escreve (ex.:
   * "MED-08") — nunca convertido automaticamente em
   * `declaredPeriodNumber`; ver nota sobre períodos no cabeçalho do
   * arquivo.
   */
  readonly periodLabel: string | null;

  readonly sourceLocation: ParsedMeasurementLineSourceLocation;
}

export type ParsedSkippedSheetReason =
  | "hidden_sheet_not_selected"
  | "calculation_memory_deferred"
  | "unsupported_layout"
  | "empty_sheet"
  | "duplicate_candidate"
  | "summary_sheet_not_measurement_lines"
  | "non_measurement_sheet";

export interface ParsedSkippedSheet {
  readonly sheetName: string;
  readonly reason: ParsedSkippedSheetReason;
  readonly detail?: string;
}

export type MeasurementImportIssueSeverity = "blocking" | "warning";

export type MeasurementImportIssueCode =
  | "unrecognized_line"
  | "missing_work_package_code"
  | "missing_service_item_code"
  | "missing_quantity_and_value"
  | "ambiguous_period_label"
  | "duplicate_service_item_in_sheet"
  | "official_measurement_block_not_found"
  | "historical_grid_not_authoritative"
  | "orphan_legacy_column_detected"
  | "official_period_total_mismatch";

export interface MeasurementImportIssue {
  readonly code: MeasurementImportIssueCode;
  readonly severity: MeasurementImportIssueSeverity;
  readonly message: string;
  readonly sourceLocation?: ParsedMeasurementLineSourceLocation;
}

/**
 * Bloco de identificação do documento — nome do arquivo e inventário
 * de abas inspecionadas, para que "algo foi extraído" nunca seja
 * confundido com "o workbook inteiro foi considerado" (achado da
 * revisão: o BM_08 real tem ~190 abas, a maioria memórias de cálculo
 * corretamente ignoradas, não perdidas silenciosamente).
 */
export interface ParsedMeasurementBulletinSource {
  readonly fileName: string;
  readonly inspectedSheetCount: number;
  readonly selectedSheets: ReadonlyArray<string>;
}

/**
 * Bloco de período declarado. `labels` preserva os rótulos brutos de
 * período encontrados (ex.: ["MED-01", ..., "MED-08"]) sem presumir
 * que o número do boletim, o número do período e esses rótulos sejam
 * o mesmo conceito — mesmo quando coincidem neste arquivo específico.
 * `startDate`/`endDate` só são preenchidos quando o arquivo
 * efetivamente declara datas de período (não deduzidos dos rótulos).
 */
export interface ParsedMeasurementBulletinDeclaredPeriod {
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly labels: ReadonlyArray<string>;
}

export interface ParsedMeasurementBulletin {
  readonly source: ParsedMeasurementBulletinSource;

  /** Ex.: "BOLETIM DE MEDIÇÃO 08" -> 8. `null` se o arquivo não declarar. */
  readonly declaredBulletinNumber: number | null;
  readonly declaredPeriod: ParsedMeasurementBulletinDeclaredPeriod | null;

  readonly workPackages: ReadonlyArray<ParsedWorkPackage>;
  readonly serviceItems: ReadonlyArray<ParsedManagedServiceItem>;
  readonly lines: ReadonlyArray<ParsedMeasurementLine>;

  readonly skippedSheets: ReadonlyArray<ParsedSkippedSheet>;
  readonly issues: ReadonlyArray<MeasurementImportIssue>;
}

export interface BulletinImportResult {
  readonly success: boolean;
  readonly bulletin: ParsedMeasurementBulletin;
}
