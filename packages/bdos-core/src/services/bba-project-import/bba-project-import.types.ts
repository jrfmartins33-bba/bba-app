import type { ScheduleActivity, CalculateCriticalPathResult, ScheduleSCurvePoint } from "../../domain/schedule-management";
import type { SpatialObject } from "../../domain/spatial-object";
import type { BusinessFact } from "../../domain/business-fact";
import type { Diagnosis } from "../../engines/decision/pipeline/diagnose";
import type { Decision } from "../../domain/decision";
import type { Recommendation } from "../../engines/decision/recommendation";
import type { ImportProjectXmlSkip } from "../../domain/schedule-management/adapters/ms-project-xml-import";

export interface BbaProjectImportInput {
  /** Conteúdo bruto do arquivo XML exportado pelo Microsoft Project (Arquivo → Salvar Como → XML). */
  readonly xml: string;
  readonly organizationId: string;
  readonly contractId: string;
  readonly projectId: string;
  readonly tenantId: string;
  readonly capability: string;
  readonly generatedAt: string;
  readonly correlationId: string;
  readonly actor: string;
  readonly occurredAt: string;
  /** Data de referência para a Curva S — normalmente "hoje". */
  readonly asOfDate: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type BbaProjectImportErrorStage =
  | "xml_import"
  | "work_package_creation"
  | "spatial_object_generation"
  | "business_fact_generation";

export interface BbaProjectImportError {
  readonly stage: BbaProjectImportErrorStage;
  readonly code: string;
  readonly message: string;
}

/**
 * Um snapshot de tudo o que a importação de um cronograma produziu —
 * o cronograma em si (atividades, caminho crítico, curva S) e a
 * mesma cadeia de decisão real já provada pelo Geospatial Engine
 * (objetos espaciais, fatos, diagnósticos, decisões, recomendações),
 * nunca uma cadeia paralela ou inventada (PRINCIPLE 005).
 */
export interface BbaProjectImportResult {
  readonly success: boolean;
  readonly activities: ReadonlyArray<ScheduleActivity>;
  readonly criticalPath: CalculateCriticalPathResult;
  readonly sCurve: ReadonlyArray<ScheduleSCurvePoint>;
  readonly spatialObjects: ReadonlyArray<SpatialObject>;
  readonly facts: ReadonlyArray<BusinessFact>;
  readonly diagnoses: ReadonlyArray<Diagnosis>;
  readonly decisions: ReadonlyArray<Decision>;
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly skippedTasks: ReadonlyArray<ImportProjectXmlSkip>;
  readonly errors: ReadonlyArray<BbaProjectImportError>;
}
