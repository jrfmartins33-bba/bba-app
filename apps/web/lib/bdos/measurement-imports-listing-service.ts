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
  /**
   * Presente só na visão cross-tenant do admin (ver listAll abaixo) --
   * `undefined` na listagem normal de um cliente, que já sabe de qual
   * empresa é a própria lista. Nunca inferido/formatado aqui: verbatim
   * do reader.
   */
  readonly companyName?: string | null;
}

export interface MeasurementImportsListReader {
  listByCompany(input: { companyId: string }): Promise<ReadonlyArray<MeasurementImportListItem>>;
  /**
   * Cross-tenant -- só deve ser chamado depois que a fronteira de rota
   * já confirmou `isAdmin` (requireAuthenticatedActor). Este serviço
   * não reautentica nem reverifica papel; nunca é o lugar certo para
   * essa checagem de autorização.
   */
  listAll(): Promise<ReadonlyArray<MeasurementImportListItem>>;
}

export interface ListMeasurementImportsDependencies {
  readonly importsListReader: MeasurementImportsListReader;
}

export interface ListMeasurementImportsInput {
  /** null exclusivamente quando isAdmin -- ver AuthenticatedActor em lib/supabase/server.ts. */
  readonly companyId: string | null;
  readonly isAdmin: boolean;
}

export async function listMeasurementImports(
  input: ListMeasurementImportsInput,
  dependencies: ListMeasurementImportsDependencies
): Promise<ReadonlyArray<MeasurementImportListItem>> {
  if (input.isAdmin) {
    return dependencies.importsListReader.listAll();
  }

  // input.companyId só é null quando isAdmin -- garantido pelo
  // contrato de AuthenticatedActor (requireAuthenticatedActor nunca
  // devolve companyId null para um ator não-admin).
  return dependencies.importsListReader.listByCompany({ companyId: input.companyId as string });
}
