import type { Event } from "./event";

export interface EventPolicyResult {
  allowed: boolean;
  reasons: string[];
}

type EventPolicyRule = (event: Event) => ReadonlyArray<string>;

const eventPolicyRules: ReadonlyArray<EventPolicyRule> = [];

export function evaluateEventPolicy(event: Event): EventPolicyResult {
  const reasons = eventPolicyRules.flatMap((rule) => rule(event));

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}
