import type { BudgetDocumentPageDecision } from "../../page-location/budget-page-location.types";
import {
  BUDGET_DOCUMENT_PAGE_LOCATION_SCHEMA_VERSION,
  BUDGET_DOCUMENT_PAGE_LOCATOR_NAME,
  BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION,
  PAGE_LOCATION_DECISION_RULE_SET_VERSION,
} from "../../page-location/budget-page-location.types";
import { formCandidateGroups } from "../../page-location/page-location-candidate-groups";
import type { BudgetDocumentPageLocationResult } from "../../page-location/budget-page-location.types";
import { DOCUMENT_SIGNAL_OBSERVER_NAME, DOCUMENT_SIGNAL_OBSERVER_VERSION, SIGNAL_OBSERVATION_RULE_SET_VERSION, SIGNAL_OBSERVATION_SCHEMA_VERSION } from "../../signal-observation/signal-observation.types";
import { BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION } from "../../budget-document-signal-catalog.types";
import type { PhysicalDocumentReadResult } from "../../physical-document-read.types";
import type { SyntheticGeometryPage } from "../../structure-reconstruction/testing/structure-reconstruction-test-bridge";
import { buildPhysicalDocumentReadResultWithGeometry } from "../../structure-reconstruction/testing/structure-reconstruction-test-bridge";
import { reconstructBudgetDocumentStructure } from "../../structure-reconstruction";
import type { BudgetDocumentStructureReconstructionResult } from "../../structure-reconstruction/budget-document-structure-reconstruction.types";

/**
 * Ponte exclusivamente de teste, local à Sprint 21.4A.2.f.2a, entre
 * especificações geométricas simples (reaproveitando `SyntheticGeometryPage`
 * da Sprint anterior, sem duplicar a construção da leitura física) e um
 * `BudgetDocumentStructureReconstructionResult` real e válido: encadeia o
 * leitor sintético de geometria com uma localização de página fabricada
 * (todas as páginas candidatas diretas, num único grupo contíguo) e o
 * reconstrutor real (`reconstructBudgetDocumentStructure`) — nunca uma
 * simulação manual do resultado da reconstrução. A localização de página é
 * fabricada diretamente (nunca via classificação real por sinais textuais)
 * porque esta Sprint detecta exclusivamente por geometria — acoplar as
 * fixtures a frases-gatilho textuais do observador de sinais seria
 * incidental e frágil, nunca o objeto real deste teste. Não exportada pelo
 * barrel público do domínio nem por `tabular-region-detection/index.ts`;
 * nunca vira fixture de produção; usa apenas geometria sintética, nunca
 * documento real.
 */

const FORMATION_RULE_ID = "synthetic-single-group-all-candidate-v1";

function buildFabricatedPageDecision(physicalRead: PhysicalDocumentReadResult, pageNumber: number): BudgetDocumentPageDecision {
  return {
    pageNumber,
    classification: "candidate",
    candidateType: "direct",
    primaryRuleId: FORMATION_RULE_ID,
    primaryRuleVersion: 1,
    satisfiedRules: [{ ruleId: FORMATION_RULE_ID, ruleVersion: 1 }],
    supportingSignals: [],
    limitingSignals: [],
    neighborPageNumbersUsed: [],
    decisionPhase: "direct_classification",
    decisionOrigin: "technical",
    canAnchor: true,
    reasonCode: "candidate_service_item_and_total",
    locatorVersion: BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION,
    decisionRuleSetVersion: PAGE_LOCATION_DECISION_RULE_SET_VERSION,
    sourceObserverVersion: DOCUMENT_SIGNAL_OBSERVER_VERSION,
    sourceObservationRuleSetVersion: SIGNAL_OBSERVATION_RULE_SET_VERSION,
    sourceCatalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
    sourceByteHash: physicalRead.sourceByteHash,
  };
}

/** Fabrica uma localização válida em que todas as páginas são candidatas diretas, formando um único grupo contíguo — nunca via classificação real por sinais textuais (§ acima). */
function buildAllCandidatePageLocation(physicalRead: PhysicalDocumentReadResult): BudgetDocumentPageLocationResult {
  const pageDecisions = physicalRead.pages.map((page) => buildFabricatedPageDecision(physicalRead, page.pageNumber));
  const candidateGroups = formCandidateGroups(physicalRead.sourceByteHash, pageDecisions);

  return {
    schemaVersion: BUDGET_DOCUMENT_PAGE_LOCATION_SCHEMA_VERSION,
    locatorName: BUDGET_DOCUMENT_PAGE_LOCATOR_NAME,
    locatorVersion: BUDGET_DOCUMENT_PAGE_LOCATOR_VERSION,
    decisionRuleSetVersion: PAGE_LOCATION_DECISION_RULE_SET_VERSION,
    sourceByteHash: physicalRead.sourceByteHash,
    sourceObservationSchemaVersion: SIGNAL_OBSERVATION_SCHEMA_VERSION,
    sourceObserverName: DOCUMENT_SIGNAL_OBSERVER_NAME,
    sourceObserverVersion: DOCUMENT_SIGNAL_OBSERVER_VERSION,
    sourceObservationRuleSetVersion: SIGNAL_OBSERVATION_RULE_SET_VERSION,
    sourceCatalogVersion: BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION,
    sourceReadMetadata: {
      readerName: physicalRead.readerName,
      readerVersion: physicalRead.readerVersion,
      adapterVersion: physicalRead.adapterVersion,
      underlyingLibraryVersion: physicalRead.underlyingLibraryVersion,
      sourceReadStatus: physicalRead.status,
    },
    sourceObservationStatus: "completed",
    sourceObservationTechnicalProblems: [],
    totalPageCount: physicalRead.totalPageCount,
    supportedSignalIds: [],
    unsupportedSignalIds: [],
    status: "completed",
    pageDecisions,
    candidateGroups,
    technicalProblems: [],
    limitations: [],
  };
}

/** Constrói um `BudgetDocumentStructureReconstructionResult` real e válido a partir de especificações geométricas simples — todas as páginas num único grupo candidato contíguo. */
export function buildTabularRegionDetectionFixture(
  sourceLabel: string,
  syntheticPages: ReadonlyArray<SyntheticGeometryPage>,
): BudgetDocumentStructureReconstructionResult {
  const physicalRead = buildPhysicalDocumentReadResultWithGeometry(sourceLabel, syntheticPages);
  const pageLocation = buildAllCandidatePageLocation(physicalRead);
  return reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
}

export type { SyntheticGeometryPage, SyntheticGeometryTextItem } from "../../structure-reconstruction/testing/structure-reconstruction-test-bridge";
