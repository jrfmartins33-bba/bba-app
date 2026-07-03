import type { BusinessFact } from "../../../business-fact";
import type { CreateDecisionCaseInput } from "../../decision-case";
import { createDecisionCase } from "../../decision-case";
import type {
  EngineeringDecisionCaseAdapter,
  EngineeringDecisionCaseMetadata,
  EngineeringDecisionCaseSnapshot,
  EngineeringDecisionCaseSummary,
  EngineeringDecisionCaseTrace,
  GenerateEngineeringDecisionCasesInput,
  GenerateEngineeringDecisionCasesResult,
} from "./engineering-decision-case.types";

export const engineeringDecisionCaseAdapterId = "engineering-decision-case-bridge";

/**
 * BusinessFact carries no `actor` field (confirmed by audit of
 * domain/business-fact), and this Sprint may not modify the Sprint 11.3
 * Facts Adapter to add one. This fixed, hand-written constant stands in
 * for "who" opened the case unless the caller supplies its own actor.
 */
export const engineeringDecisionCaseDefaultActor = "engineering-decision-case-bridge";

const ENGINEERING_FACT_SOURCE_PREFIX = "engineering-application.";

const SUPPORTED_ENGINEERING_FACT_TYPES: ReadonlyArray<string> = [
  "measurement_finalized",
  "approval_completed",
  "bulletin_finalized",
  "export_prepared",
  "evidence_attached",
];

export const engineeringDecisionCaseAdapter: EngineeringDecisionCaseAdapter = {
  adapterId: engineeringDecisionCaseAdapterId,
  supportedFactTypes: SUPPORTED_ENGINEERING_FACT_TYPES,
  generate: generateEngineeringDecisionCases,
};

/**
 * Translates a single BusinessFact into a DecisionCase snapshot, or
 * returns null when the fact does not originate from the engineering
 * application adapter or is not one of the supported fact types. Stops at
 * that single artifact — `artifacts` is always left empty, since anything
 * downstream of a bare case belongs to later EPIC 11 sprints.
 */
export function createEngineeringDecisionCase(
  fact: BusinessFact,
  options?: {
    readonly actor?: string;
    readonly metadata?: EngineeringDecisionCaseMetadata;
  },
): EngineeringDecisionCaseSnapshot | null {
  if (!isSupportedEngineeringFact(fact)) {
    return null;
  }

  const correlationId = extractCorrelationId(fact);
  const actor = options?.actor ?? engineeringDecisionCaseDefaultActor;
  const metadata = createSnapshotMetadata(fact, correlationId, options?.metadata);

  const decisionCaseInput: CreateDecisionCaseInput = {
    id: `${fact.id}:decision-case`,
    capability: fact.capability,
    createdAt: fact.observedAt,
    actor,
    metadata,
  };

  const decisionCase = createDecisionCase(decisionCaseInput);

  return freezeDomainObject<EngineeringDecisionCaseSnapshot>({
    sourceFactId: fact.id,
    sourceFactType: fact.type,
    correlationId,
    decisionCase,
    trace: [
      createTraceEntry(
        "engineering_decision_case_created",
        actor,
        fact.observedAt,
        `Decision case opened from engineering fact "${fact.type}" (${fact.label}).`,
        metadata,
      ),
    ],
    metadata,
  });
}

/**
 * Translates a batch of facts. Facts that are not supported engineering
 * facts are silently skipped (not an error) and counted in the summary —
 * "each operational BusinessFact may generate zero or more Decision
 * Cases."
 */
export function generateEngineeringDecisionCases(
  input: GenerateEngineeringDecisionCasesInput,
): GenerateEngineeringDecisionCasesResult {
  const decisionCases: EngineeringDecisionCaseSnapshot[] = [];
  const caseCountByFactType: Record<string, number> = {};
  let totalFactsSkipped = 0;

  input.facts.forEach((fact) => {
    const snapshot = createEngineeringDecisionCase(fact, {
      actor: input.actor,
      metadata: input.metadata,
    });

    if (snapshot === null) {
      totalFactsSkipped += 1;
      return;
    }

    decisionCases.push(snapshot);
    caseCountByFactType[snapshot.sourceFactType] =
      (caseCountByFactType[snapshot.sourceFactType] ?? 0) + 1;
  });

  return freezeDomainObject<GenerateEngineeringDecisionCasesResult>({
    decisionCases,
    summary: {
      totalFactsConsidered: input.facts.length,
      totalDecisionCasesGenerated: decisionCases.length,
      totalFactsSkipped,
      caseCountByFactType,
    },
    metadata: {
      ...(input.metadata ?? {}),
      adapterId: engineeringDecisionCaseAdapterId,
    },
  });
}

/**
 * Recomputes the summary shape for a single already-generated snapshot —
 * the single-item counterpart to `generateEngineeringDecisionCases`'s
 * batch summary.
 */
export function summarizeEngineeringDecisionCase(
  snapshot: EngineeringDecisionCaseSnapshot,
): EngineeringDecisionCaseSummary {
  return {
    totalFactsConsidered: 1,
    totalDecisionCasesGenerated: 1,
    totalFactsSkipped: 0,
    caseCountByFactType: { [snapshot.sourceFactType]: 1 },
  };
}

function isSupportedEngineeringFact(fact: BusinessFact): boolean {
  return (
    fact.source.startsWith(ENGINEERING_FACT_SOURCE_PREFIX) &&
    SUPPORTED_ENGINEERING_FACT_TYPES.includes(fact.type)
  );
}

function extractCorrelationId(fact: BusinessFact): string {
  const rawValue = fact.metadata["correlationId"];
  return typeof rawValue === "string" ? rawValue : "";
}

function createSnapshotMetadata(
  fact: BusinessFact,
  correlationId: string,
  extraMetadata: EngineeringDecisionCaseMetadata | undefined,
): EngineeringDecisionCaseMetadata {
  return {
    ...(extraMetadata ?? {}),
    adapterId: engineeringDecisionCaseAdapterId,
    correlationId,
    sourceFactId: fact.id,
    sourceFactType: fact.type,
    sourceFactSource: fact.source,
    sourceReference: fact.sourceReference,
    organizationId: fact.organizationId,
    tenantId: fact.tenantId,
  };
}

function createTraceEntry(
  action: string,
  actor: string,
  occurredAt: string,
  description: string,
  metadata: EngineeringDecisionCaseMetadata,
): EngineeringDecisionCaseTrace {
  return {
    action,
    actor,
    occurredAt,
    description,
    metadata,
  };
}

type FreezableRecord = Record<PropertyKey, unknown>;

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [
      key,
      cloneDomainValue(property),
    ]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as FreezableRecord).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
