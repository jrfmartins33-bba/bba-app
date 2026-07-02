import type { BusinessFact } from "../../../domain/business-fact";
import type { RulePack, RuleResult } from "./rule.types";

export function executeRulePack(
  rulePack: RulePack,
  facts: ReadonlyArray<BusinessFact>,
): RuleResult {
  return rulePack.rules.flatMap((rule) => rule(facts));
}
