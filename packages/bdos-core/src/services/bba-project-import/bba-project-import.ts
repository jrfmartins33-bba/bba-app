import { calculateCriticalPath, buildScheduleSCurve } from "../../domain/schedule-management";
import { importProjectXml } from "../../domain/schedule-management/adapters/ms-project-xml-import";
import { generateSpatialObjectsFromWorkPackages } from "../../domain/spatial-object";
import { spatialObjectFactsAdapter } from "../../domain/business-facts-generator/adapters/spatial-object";
import { buildDecisions } from "../../engines/decision/builder";
import { buildRecommendations } from "../../engines/decision/recommendation";
import { executeRulePack, type RulePack } from "../../engines/decision/rule-engine";
import { lowSpatialConfidenceRule } from "../../capabilities/geospatial-intelligence/rules/low-spatial-confidence-rule";
import type {
  BbaProjectImportError,
  BbaProjectImportErrorStage,
  BbaProjectImportInput,
  BbaProjectImportResult,
} from "./bba-project-import.types";

/**
 * BBA Project — Sprint Zero (ver `packages/bdos-core/docs/BBA_PROJECT.md`).
 *
 * A Application Service que uma superfície de produto (UI, rota de
 * API) deve chamar — nunca `domain/schedule-management`,
 * `domain/schedule-management/adapters/ms-project-xml-import`,
 * `domain/spatial-object`, `engines/decision/*` ou
 * `capabilities/geospatial-intelligence` diretamente. Mesmo padrão já
 * estabelecido por `services/geospatial-product-integration`
 * (EPIC 04): esta função não tem conhecimento de negócio próprio, só
 * orquestra, na ordem já provada correta, as funções reais que fazem
 * o trabalho — `importProjectXml` (que já produz `ScheduleActivity[]`
 * e `WorkPackage[]` conectados, PRINCIPLE 005) →
 * `generateSpatialObjectsFromWorkPackages` →
 * `spatialObjectFactsAdapter.generateFacts` → `executeRulePack` →
 * `buildDecisions` → `buildRecommendations`, mais
 * `calculateCriticalPath`/`buildScheduleSCurve` sobre as atividades.
 *
 * Reaproveita deliberadamente a mesma `capabilities/geospatial-intelligence`
 * (baixa confiança espacial) em vez de criar uma nova regra de
 * "atraso de cronograma" — toda atividade recém-importada nasce sem
 * evidência de campo, então já produz um Diagnosis/Decision real e
 * honesto por si só. Uma capability dedicada de "atraso" é um
 * aprimoramento explicitamente adiado para uma sprint futura (ver
 * roadmap em `BBA_PROJECT.md`), não fingido aqui.
 */
export const geospatialRulePack: RulePack = {
  id: "geospatial-intelligence-rule-pack",
  name: "Geospatial Intelligence",
  version: "1.0.0",
  capability: "geospatial-intelligence",
  rules: [lowSpatialConfidenceRule],
  metadata: {},
};

export function buildBbaProjectImportSnapshot(input: BbaProjectImportInput): BbaProjectImportResult {
  const errors: BbaProjectImportError[] = [];

  const importResult = importProjectXml({
    xml: input.xml,
    projectId: input.projectId,
    organizationId: input.organizationId,
    contractId: input.contractId,
    correlationId: input.correlationId,
    createdBy: input.actor,
  });

  errors.push(
    ...importResult.errors.map((error) => toServiceError("xml_import", { code: error.code, message: error.message })),
  );

  if (importResult.activities.length === 0 || importResult.workPackages.length === 0) {
    return emptyResult(errors, importResult.skipped);
  }

  const spatialObjectResult = generateSpatialObjectsFromWorkPackages({
    workPackages: importResult.workPackages,
    actor: input.actor,
    occurredAt: input.occurredAt,
  });

  errors.push(
    ...spatialObjectResult.errors.map((error) => toServiceError("spatial_object_generation", error)),
  );

  const factsResult = spatialObjectFactsAdapter.generateFacts({
    source: spatialObjectFactsAdapter.supportedSource,
    generatedAt: input.generatedAt,
    correlationId: input.correlationId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    capability: input.capability,
    spatialObjects: spatialObjectResult.spatialObjects,
    metadata: input.metadata ?? {},
  });

  errors.push(...factsResult.errors.map((error) => toServiceError("business_fact_generation", error)));

  const diagnoses = executeRulePack(geospatialRulePack, factsResult.facts);
  const decisions = buildDecisions(diagnoses);
  const recommendations = buildRecommendations(decisions);

  return {
    success: errors.length === 0,
    activities: importResult.activities,
    criticalPath: calculateCriticalPath(importResult.activities),
    sCurve: buildScheduleSCurve(importResult.activities, input.asOfDate),
    spatialObjects: spatialObjectResult.spatialObjects,
    facts: factsResult.facts,
    diagnoses,
    decisions,
    recommendations,
    skippedTasks: importResult.skipped,
    errors,
  };
}

function toServiceError(
  stage: BbaProjectImportErrorStage,
  error: { readonly code: string; readonly message: string },
): BbaProjectImportError {
  return { stage, code: error.code, message: error.message };
}

function emptyResult(
  errors: ReadonlyArray<BbaProjectImportError>,
  skippedTasks: BbaProjectImportResult["skippedTasks"],
): BbaProjectImportResult {
  return {
    success: errors.length === 0,
    activities: [],
    criticalPath: { activities: [], criticalActivityIds: [], projectDurationDays: 0 },
    sCurve: [],
    spatialObjects: [],
    facts: [],
    diagnoses: [],
    decisions: [],
    recommendations: [],
    skippedTasks,
    errors,
  };
}
