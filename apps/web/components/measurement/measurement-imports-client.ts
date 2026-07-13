import type { MeasurementImportListItem } from "@/lib/bdos/measurement-imports-listing-service";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.1B — orquestra a chamada
 * a `GET /api/measurement/imports` para a página `/medicoes`. `fetchImpl`
 * é injetável só para permitir teste sem rede real -- em produção é
 * sempre o `fetch` global do browser (nenhuma biblioteca nova, mesmo
 * padrão de todo o produto).
 */

export type MeasurementImportsFetchOutcome =
  | { readonly kind: "ok"; readonly imports: ReadonlyArray<MeasurementImportListItem> }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "error" };

export async function fetchMeasurementImports(
  fetchImpl: typeof fetch = fetch
): Promise<MeasurementImportsFetchOutcome> {
  let response: Response;
  try {
    response = await fetchImpl("/api/measurement/imports");
  } catch {
    return { kind: "error" };
  }

  if (response.status === 401) {
    return { kind: "unauthenticated" };
  }

  if (!response.ok) {
    return { kind: "error" };
  }

  try {
    const body = (await response.json()) as { imports: ReadonlyArray<MeasurementImportListItem> };
    return { kind: "ok", imports: body.imports };
  } catch {
    return { kind: "error" };
  }
}
