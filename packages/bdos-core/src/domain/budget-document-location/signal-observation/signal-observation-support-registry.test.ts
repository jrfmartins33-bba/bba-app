import { BUDGET_DOCUMENT_SIGNAL_CATALOG } from "../budget-document-signal-catalog";
import { SIGNAL_SUPPORT_REGISTRY, getSignalSupportEntry, listCatalogSignalIds } from "./signal-observation-support-registry";
import { SIGNAL_OBSERVATION_RULE_REGISTRY, getRuleById } from "./signal-observation-rules";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(actual: boolean, message: string): void {
  if (!actual) {
    throw new Error(message);
  }
}

const CATALOG_SIGNAL_IDS = new Set(BUDGET_DOCUMENT_SIGNAL_CATALOG.map((definition) => definition.id));

const FORBIDDEN_RULE_TEXT_KEYWORDS = ["dnocs", "dnit", "lagoa do arroz", "lagoa-do-arroz"];

// 1. todo ruleId é único
runTest("every ruleId in the rule registry is unique", () => {
  const ids = SIGNAL_OBSERVATION_RULE_REGISTRY.map((rule) => rule.ruleId);
  assertEqual(new Set(ids).size, ids.length, "duplicate ruleId found in the rule registry");
});

// 2. toda regra referencia um signalId real do catálogo
runTest("every rule references a real catalog signalId", () => {
  const violations = SIGNAL_OBSERVATION_RULE_REGISTRY.filter((rule) => !CATALOG_SIGNAL_IDS.has(rule.signalId));
  assertEqual(violations.length, 0, `rules referencing unknown signalId: ${violations.map((r) => r.ruleId).join(", ")}`);
});

// 3. nenhuma regra é órfã (toda regra do registro de regras é referenciada por ao menos uma entrada do registro de suporte)
runTest("no rule in the rule registry is orphaned from the support registry", () => {
  const referencedRuleIds = new Set(
    SIGNAL_SUPPORT_REGISTRY.filter((entry) => entry.ruleId !== null).map((entry) => entry.ruleId),
  );
  const orphanRules = SIGNAL_OBSERVATION_RULE_REGISTRY.filter((rule) => !referencedRuleIds.has(rule.ruleId));
  assertEqual(orphanRules.length, 0, `orphan rules not referenced by the support registry: ${orphanRules.map((r) => r.ruleId).join(", ")}`);
});

// 4. todo sinal marcado como suportado possui ao menos uma regra registrada
runTest("every supported signal resolves to a real registered rule", () => {
  const violations = SIGNAL_SUPPORT_REGISTRY.filter(
    (entry) => entry.status === "supported" && (entry.ruleId === null || getRuleById(entry.ruleId) === null),
  );
  assertEqual(violations.length, 0, `supported signals without a resolvable rule: ${violations.map((v) => v.signalId).join(", ")}`);
});

// 5. todo sinal não suportado possui motivo estável de não avaliação
runTest("every unsupported signal carries a stable not-evaluable reason code", () => {
  const violations = SIGNAL_SUPPORT_REGISTRY.filter((entry) => entry.status === "unsupported" && entry.unsupportedReasonCode === null);
  assertEqual(violations.length, 0, `unsupported signals missing a reason code: ${violations.map((v) => v.signalId).join(", ")}`);
});

// 6. todos os 23 sinais aparecem exatamente uma vez no registro de suporte
runTest("all 23 catalog signals appear exactly once in the support registry", () => {
  assertEqual(SIGNAL_SUPPORT_REGISTRY.length, 23, "support registry does not have exactly 23 entries");
  assertEqual(listCatalogSignalIds().length, 23, "catalog does not have exactly 23 signals");

  const counts = new Map<string, number>();
  SIGNAL_SUPPORT_REGISTRY.forEach((entry) => counts.set(entry.signalId, (counts.get(entry.signalId) ?? 0) + 1));

  listCatalogSignalIds().forEach((signalId) => {
    assertEqual(counts.get(signalId), 1, `catalog signal "${signalId}" does not appear exactly once in the support registry`);
  });
});

// 7. nenhum sinal desconhecido aparece no registro
runTest("no unknown signalId appears in the support registry", () => {
  const violations = SIGNAL_SUPPORT_REGISTRY.filter((entry) => !CATALOG_SIGNAL_IDS.has(entry.signalId));
  assertEqual(violations.length, 0, `support registry references unknown signalId(s): ${violations.map((v) => v.signalId).join(", ")}`);
});

// 8. nenhuma regra referencia órgão, licitação ou documento real
runTest("no rule references a specific agency, real bid or real document", () => {
  const violations: string[] = [];
  SIGNAL_OBSERVATION_RULE_REGISTRY.forEach((rule) => {
    const haystack = `${rule.ruleId} ${rule.humanDescription} ${rule.requiredInputs.join(" ")}`.toLowerCase();
    FORBIDDEN_RULE_TEXT_KEYWORDS.forEach((keyword) => {
      if (haystack.includes(keyword)) {
        violations.push(`${rule.ruleId} mentions "${keyword}"`);
      }
    });
  });
  assertEqual(violations.length, 0, violations.join("; "));
});

// 9. nenhum sinal é marcado como suportado apenas pela documentação (o ruleId sempre resolve de fato)
runTest("support status is always backed by a resolvable rule object, never asserted only in prose", () => {
  const supportedEntries = SIGNAL_SUPPORT_REGISTRY.filter((entry) => entry.status === "supported");
  assertTrue(supportedEntries.length > 0, "expected at least one supported signal");
  supportedEntries.forEach((entry) => {
    const rule = entry.ruleId === null ? null : getRuleById(entry.ruleId);
    assertTrue(rule !== null, `supported signal "${entry.signalId}" has no resolvable rule object`);
    assertEqual(rule?.signalId, entry.signalId, `rule for "${entry.signalId}" is registered under a mismatched signalId`);
  });
});

// 10. a matriz documentada corresponde ao registro executável (contagens fixadas pelo teste, não apenas pela prosa)
runTest("the registry's supported/unsupported counts match the documented matrix", () => {
  const supportedCount = SIGNAL_SUPPORT_REGISTRY.filter((entry) => entry.status === "supported").length;
  const unsupportedCount = SIGNAL_SUPPORT_REGISTRY.filter((entry) => entry.status === "unsupported").length;
  assertEqual(supportedCount, 9, "documented matrix expects exactly 9 supported signals");
  assertEqual(unsupportedCount, 14, "documented matrix expects exactly 14 unsupported signals");
});

runTest("getSignalSupportEntry returns null for an unknown signalId", () => {
  assertEqual(getSignalSupportEntry("unknown-signal-id"), null);
});
