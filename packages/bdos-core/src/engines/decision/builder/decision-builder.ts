import type {
  Decision,
  DecisionEvidence,
} from "../../../domain/decision";
import {
  DecisionCategory,
  DecisionImpact,
  DecisionPriority,
  DecisionStatus,
} from "../../../domain/decision";
import type { BusinessFact } from "../../../domain/business-fact";
import type {
  Diagnosis,
  DiagnosisSeverity,
} from "../pipeline/diagnose";
import type {
  BuildDecisionsInput,
  BuildDecisionsResult,
} from "./decision-builder.types";

export function buildDecisions(
  diagnoses: BuildDecisionsInput,
): BuildDecisionsResult {
  return diagnoses.flatMap((diagnosis) => {
    const decision = buildDecision(diagnosis);

    return decision === null ? [] : [decision];
  });
}

function buildDecision(diagnosis: Diagnosis): Decision | null {
  const firstFact = diagnosis.facts[0];

  if (firstFact === undefined || !hasBusinessIdentity(firstFact)) {
    return null;
  }

  const category = mapDiagnosisCategory(diagnosis.category);

  if (category === null) {
    return null;
  }

  const priority = mapSeverityToPriority(diagnosis.severity);

  return {
    id: `decision:${diagnosis.id}`,
    tenantId: firstFact.tenantId,
    organizationId: firstFact.organizationId,
    evidence: diagnosis.facts.map(toDecisionEvidence),
    title: diagnosis.title,
    summary: diagnosis.description,
    status: DecisionStatus.Created,
    priority,
    category,
    impact: mapPriorityToImpact(priority),
    confidence: diagnosis.confidence,
    owner: "",
    dueDate: null,
    expectedBenefit: {
      description: "",
      metadata: {},
    },
    createdAt: diagnosis.createdAt,
    updatedAt: diagnosis.createdAt,
    resolvedAt: null,
    metadata: {
      diagnosisId: diagnosis.id,
      diagnosisType: diagnosis.type,
      diagnosisMetadata: diagnosis.metadata,
    },
  };
}

function hasBusinessIdentity(fact: BusinessFact): boolean {
  return fact.tenantId.trim().length > 0 && fact.organizationId.trim().length > 0;
}

function mapDiagnosisCategory(
  category: Diagnosis["category"],
): DecisionCategory | null {
  switch (category) {
    case "strategic":
      return DecisionCategory.Strategic;
    case "operational":
      return DecisionCategory.Operational;
    case "financial":
      return DecisionCategory.Financial;
    case "compliance":
      return DecisionCategory.Compliance;
    case "risk":
      return DecisionCategory.Risk;
    default:
      return null;
  }
}

function mapSeverityToPriority(
  severity: DiagnosisSeverity,
): DecisionPriority {
  switch (severity) {
    case "critical":
      return DecisionPriority.Critical;
    case "high":
      return DecisionPriority.High;
    case "medium":
      return DecisionPriority.Medium;
    case "low":
    case "info":
      return DecisionPriority.Low;
  }
}

function mapPriorityToImpact(priority: DecisionPriority): DecisionImpact {
  switch (priority) {
    case DecisionPriority.Critical:
      return DecisionImpact.Critical;
    case DecisionPriority.High:
      return DecisionImpact.High;
    case DecisionPriority.Medium:
      return DecisionImpact.Medium;
    case DecisionPriority.Low:
      return DecisionImpact.Low;
  }
}

function toDecisionEvidence(fact: BusinessFact): DecisionEvidence {
  return {
    source: fact.source,
    sourceReference: fact.sourceReference,
    description: fact.description,
    metadata: {
      businessFactId: fact.id,
      capability: fact.capability,
      category: fact.category,
      type: fact.type,
      label: fact.label,
      value: fact.value,
      unit: fact.unit,
      confidence: fact.confidence,
      observedAt: fact.observedAt,
      metadata: fact.metadata,
    },
  };
}
