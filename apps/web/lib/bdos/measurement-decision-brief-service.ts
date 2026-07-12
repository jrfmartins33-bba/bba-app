import type { DecisionBrief } from "@bba/bdos-core/decision-brief";
import { buildMeasurementDecisionBrief, type MeasurementAnalysisResult } from "@bba/bdos-core/services/measurement-bulletin-import";

/**
 * Epic 20 (Decision Experience), Sprint 20.1C — Measurement Decision
 * Brief Application Service. Orquestra a leitura do
 * `MeasurementAnalysisResult` já persistido pelo Epic 19 e chama o
 * builder puro do 20.1B -- nunca reinterpreta readiness, itens
 * críticos ou confidence, que já pertencem ao builder.
 *
 * Vive em `apps/web/lib/bdos/`, não em `packages/bdos-core`: é aqui
 * que `processMeasurementBulletinImport` (Epic 19) e as demais
 * Application Services de Medição já vivem -- mesmo contrato congelado
 * ("Route Handler → Application Service → Parser ou Repository",
 * EPIC_19_SPRINT_4D_APPLICATION_SERVICE_DESIGN.md).
 *
 * Depende só de `MeasurementDecisionBriefImportReader`, injetado por
 * quem o chama. A composição concreta (ligar o reader a
 * `getMeasurementBulletinImportById`, measurement-repository.ts) é
 * responsabilidade da fronteira web/server (futuro Route Handler,
 * Sprint 20.1D em diante), nunca deste Application Service.
 */

/**
 * Só os campos que este serviço realmente usa -- nunca o modelo de
 * persistência inteiro (`MeasurementBulletinImportRecord`,
 * measurement-repository.ts, tem companyId/engineeringProjectId/
 * fileName/storagePath/status/uploadedBy, nenhum deles necessário
 * aqui).
 */
export interface MeasurementDecisionBriefImportRecord {
  /** Valor bruto de `measurement_bulletin_imports.analysis_result` -- ainda não convertido para `MeasurementAnalysisResult` (mesmo cast do Epic 19, aplicado por este serviço, não pelo reader). */
  readonly analysisResult: unknown;
}

/**
 * Porta de leitura -- implementação concreta (Supabase ou qualquer
 * outra) fica inteiramente fora deste módulo.
 */
export interface MeasurementDecisionBriefImportReader {
  findById(input: { measurementBulletinImportId: string; companyId: string }): Promise<MeasurementDecisionBriefImportRecord | null>;
}

export interface GetMeasurementDecisionBriefDependencies {
  readonly importReader: MeasurementDecisionBriefImportReader;
}

export interface GetMeasurementDecisionBriefInput {
  readonly measurementBulletinImportId: string;
  readonly companyId: string;
  /** ISO 8601, injetado pelo chamador -- este serviço nunca chama new Date()/Date.now(). */
  readonly generatedAt: string;
}

export type GetMeasurementDecisionBriefErrorCode = "import_not_found" | "analysis_not_available";

export interface GetMeasurementDecisionBriefSuccess {
  readonly success: true;
  readonly decisionBrief: DecisionBrief;
}

export interface GetMeasurementDecisionBriefFailure {
  readonly success: false;
  readonly error: GetMeasurementDecisionBriefErrorCode;
}

export type GetMeasurementDecisionBriefResult = GetMeasurementDecisionBriefSuccess | GetMeasurementDecisionBriefFailure;

export async function getMeasurementDecisionBrief(
  input: GetMeasurementDecisionBriefInput,
  dependencies: GetMeasurementDecisionBriefDependencies
): Promise<GetMeasurementDecisionBriefResult> {
  const { measurementBulletinImportId, companyId, generatedAt } = input;

  const importRecord = await dependencies.importReader.findById({ measurementBulletinImportId, companyId });
  if (!importRecord) {
    return { success: false, error: "import_not_found" };
  }

  const analysisResult = toMeasurementAnalysisResult(importRecord.analysisResult);
  if (analysisResult === null) {
    return { success: false, error: "analysis_not_available" };
  }

  const decisionBrief = buildMeasurementDecisionBrief({
    analysisResult,
    sourceImportId: measurementBulletinImportId,
    generatedAt
  });

  return { success: true, decisionBrief };
}

/**
 * Mesmo padrão já usado por `processMeasurementBulletinImport`
 * (`toMeasurementAnalysisResult`, measurement-bulletin-import-service.ts) --
 * cast direto, sem validação de schema. `analysis_result` é escrito
 * exclusivamente por esse mesmo serviço, com o shape já garantido na
 * escrita. Limitação herdada do Epic 19, não resolvida aqui: nenhuma
 * validação runtime compartilhada existe -- uma futura validação na
 * fronteira de persistência deve ser tratada ali, nunca duplicada só
 * para o Decision Brief.
 */
function toMeasurementAnalysisResult(value: unknown): MeasurementAnalysisResult | null {
  return (value ?? null) as MeasurementAnalysisResult | null;
}
