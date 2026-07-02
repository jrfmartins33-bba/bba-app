import type { BusinessFact } from "../../../../domain/business-fact";
import type { CapabilityContext, ObserveResult } from "./observe.types";

export function observe(context: CapabilityContext): ObserveResult {
  return context.facts.map<BusinessFact>((fact) => ({
    id: fact.id,
    tenantId: context.tenantId,
    organizationId: context.organizationId,
    capability: context.capability,
    source: fact.source,
    sourceReference: fact.sourceReference,
    category: fact.category,
    type: fact.type,
    label: fact.label,
    description: fact.description,
    value: fact.value,
    unit: fact.unit,
    confidence: fact.confidence,
    observedAt: fact.observedAt,
    metadata: fact.metadata,
    createdAt: fact.createdAt,
  }));
}
