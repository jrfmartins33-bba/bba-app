import { BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION } from "../budget-document-signal-catalog.types";
import { SIGNAL_OBSERVATION_RULE_REGISTRY } from "../signal-observation/signal-observation-rules";
import {
  DOCUMENT_SIGNAL_OBSERVER_NAME,
  DOCUMENT_SIGNAL_OBSERVER_VERSION,
  SIGNAL_OBSERVATION_RULE_SET_VERSION,
  SIGNAL_OBSERVATION_SCHEMA_VERSION,
} from "../signal-observation/signal-observation.types";
import {
  CONTENT_DECISION_SIGNAL_IDS,
  PAGE_LOCATION_DECISION_RULE_REGISTRY,
  PAGE_LOCATION_SOURCE_SIGNAL_IDS,
  SUPPORTED_SOURCE_OBSERVATION_CONTRACTS,
  UNSUPPORTED_SOURCE_SIGNAL_CONTRACTS,
} from "./page-location-decision-rule-registry";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertArrayEqual<T>(actual: ReadonlyArray<T>, expected: ReadonlyArray<T>, message?: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message ?? "arrays differ"}: expected ${expectedJson}, got ${actualJson}`);
  }
}

runTest("declares exactly one supported source contract", () => {
  assertEqual(SUPPORTED_SOURCE_OBSERVATION_CONTRACTS.length, 1);
  assertEqual(SUPPORTED_SOURCE_OBSERVATION_CONTRACTS[0].signalRules.length, 8);
});

runTest("source compatibility policy matches the current observer contract exactly", () => {
  const contract = SUPPORTED_SOURCE_OBSERVATION_CONTRACTS[0];
  assertEqual(contract.schemaVersion, SIGNAL_OBSERVATION_SCHEMA_VERSION);
  assertEqual(contract.observerName, DOCUMENT_SIGNAL_OBSERVER_NAME);
  assertEqual(contract.observerVersion, DOCUMENT_SIGNAL_OBSERVER_VERSION);
  assertEqual(contract.observationRuleSetVersion, SIGNAL_OBSERVATION_RULE_SET_VERSION);
  assertEqual(contract.catalogVersion, BUDGET_DOCUMENT_SIGNAL_CATALOG_VERSION);
  contract.signalRules.forEach((sourceRule) => {
    const actualRule = SIGNAL_OBSERVATION_RULE_REGISTRY.find((rule) => rule.signalId === sourceRule.signalId);
    assertEqual(actualRule?.ruleId, sourceRule.ruleId, `rule id mismatch for ${sourceRule.signalId}`);
    assertEqual(actualRule?.ruleVersion, sourceRule.ruleVersion, `rule version mismatch for ${sourceRule.signalId}`);
  });
});

runTest("declares all 23 source signals as supported or unsupported", () => {
  assertEqual(SUPPORTED_SOURCE_OBSERVATION_CONTRACTS[0].signalRules.length + UNSUPPORTED_SOURCE_SIGNAL_CONTRACTS.length, 23);
});

runTest("all decision rule ids and precedence values are unique", () => {
  assertEqual(new Set(PAGE_LOCATION_DECISION_RULE_REGISTRY.map((rule) => rule.ruleId)).size, PAGE_LOCATION_DECISION_RULE_REGISTRY.length);
  assertEqual(new Set(PAGE_LOCATION_DECISION_RULE_REGISTRY.map((rule) => rule.precedence)).size, PAGE_LOCATION_DECISION_RULE_REGISTRY.length);
});

runTest("anchor capability is explicit on every candidate rule", () => {
  const byId = new Map(PAGE_LOCATION_DECISION_RULE_REGISTRY.map((rule) => [rule.ruleId, rule]));
  assertEqual(byId.get("candidate-service-item-and-bdi-v1")?.canAnchor, true);
  assertEqual(byId.get("candidate-service-item-and-total-v1")?.canAnchor, false);
  assertEqual(byId.get("candidate-service-item-by-continuity-v1")?.canAnchor, true);
  assertEqual(byId.get("candidate-closing-page-by-continuity-v1")?.canAnchor, false);
});

runTest("only the two approved structural candidate rules can anchor", () => {
  const anchors = PAGE_LOCATION_DECISION_RULE_REGISTRY.filter((rule) => rule.canAnchor).map((rule) => rule.ruleId);
  assertArrayEqual(anchors, ["candidate-service-item-and-bdi-v1", "candidate-service-item-by-continuity-v1"]);
});

runTest("ambiguity declares any positive content signal and excludes geometry", () => {
  const rule = PAGE_LOCATION_DECISION_RULE_REGISTRY.find((entry) => entry.ruleId === "ambiguous-positive-content-evidence-v1");
  assertArrayEqual(rule?.requiredAnyObservedSignalIds ?? [], CONTENT_DECISION_SIGNAL_IDS);
  assertEqual(rule?.requiredAnyObservedSignalIds.includes(PAGE_LOCATION_SOURCE_SIGNAL_IDS.stableGeometry), false);
});

runTest("no-positive-evidence requires all four content signals absent and excludes geometry", () => {
  const rule = PAGE_LOCATION_DECISION_RULE_REGISTRY.find((entry) => entry.ruleId === "no-positive-content-evidence-v1");
  assertArrayEqual(rule?.requiredNotObservedSignalIds ?? [], CONTENT_DECISION_SIGNAL_IDS);
  assertEqual(rule?.requiredNotObservedSignalIds.includes(PAGE_LOCATION_SOURCE_SIGNAL_IDS.stableGeometry), false);
});
