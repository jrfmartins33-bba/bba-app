import type { MeasurementBulletinImportStatus } from "./measurement-repository";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.1A — Measurement
 * Imports Listing Application Service. Cadeia mínima para a futura
 * página `/medicoes`: nenhuma interpretação de negócio existe aqui
 * (não há builder nesta cadeia -- a listagem é uma projeção quase
 * mecânica da tabela) -- por isso este serviço fica deliberadamente
 * fino, sem violar a disciplina de não depender de `SupabaseClient`
 * diretamente.
 */

export interface MeasurementImportListItem {
  readonly measurementBulletinImportId: string;
  /** `fileName` real, verbatim -- nunca derivado do id, nunca numerado artificialmente. */
  readonly humanLabel: string | null;
  readonly status: MeasurementBulletinImportStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly analysisAvailable: boolean;
}

export interface MeasurementImportsListReader {
  listByCompany(input: { companyId: string }): Promise<ReadonlyArray<MeasurementImportListItem>>;
}

export interface ListMeasurementImportsDependencies {
  readonly importsListReader: MeasurementImportsListReader;
}

export interface ListMeasurementImportsInput {
  readonly companyId: string;
}

export async function listMeasurementImports(
  input: ListMeasurementImportsInput,
  dependencies: ListMeasurementImportsDependencies
): Promise<ReadonlyArray<MeasurementImportListItem>> {
  return dependencies.importsListReader.listByCompany({ companyId: input.companyId });
}
