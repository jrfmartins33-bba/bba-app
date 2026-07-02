import {
  alphaEngenhariaBusinessReality,
  alphaEngenhariaBusinessRealityInput,
  createBusinessRealityCompany,
} from "./index";

runTest("company creation", () => {
  const businessReality = createBusinessRealityCompany(
    alphaEngenhariaBusinessRealityInput,
  );

  assertEqual(
    businessReality.company.legalName,
    "Alpha Engenharia Ltda.",
    "legalName mismatch",
  );
  assertEqual(
    businessReality.company.tradeName,
    "Alpha Engenharia",
    "tradeName mismatch",
  );
  assertEqual(businessReality.company.country, "Brazil", "country mismatch");
  assertEqual(businessReality.company.currency, "BRL", "currency mismatch");
  assertEqual(
    businessReality.company.taxRegime,
    "Lucro Real",
    "tax regime mismatch",
  );
  assertEqual(
    businessReality.company.companySize,
    "Medium Enterprise",
    "company size mismatch",
  );
  assertEqual(businessReality.company.employees, 180, "employees mismatch");
});

runTest("profile", () => {
  const businessReality = createBusinessRealityCompany(
    alphaEngenhariaBusinessRealityInput,
  );

  assertEqual(
    businessReality.profile.annualRevenue,
    48000000,
    "annualRevenue mismatch",
  );
  assertEqual(
    businessReality.profile.monthlyRevenue,
    4000000,
    "monthlyRevenue mismatch",
  );
  assertEqual(
    businessReality.profile.cashBalance,
    1850000,
    "cashBalance mismatch",
  );
  assertEqual(
    businessReality.profile.workingCapital,
    620000,
    "workingCapital mismatch",
  );
  assertEqual(businessReality.profile.debt, 11000000, "debt mismatch");
});

runTest("scenario", () => {
  const businessReality = createBusinessRealityCompany(
    alphaEngenhariaBusinessRealityInput,
  );

  assertEqual(
    businessReality.scenario.primaryChallenge,
    "Projected Cash Deficit",
    "primary challenge mismatch",
  );
  assertArrayIncludes(
    businessReality.scenario.secondaryChallenges,
    "Delayed customer payments",
    "missing delayed payments challenge",
  );
  assertArrayIncludes(
    businessReality.scenario.secondaryChallenges,
    "Large CAPEX",
    "missing capex challenge",
  );
  assertArrayIncludes(
    businessReality.scenario.expectedBusinessFacts,
    "current_cash_balance",
    "missing current cash balance fact",
  );
  assertArrayIncludes(
    businessReality.scenario.expectedBusinessFacts,
    "upcoming_payables",
    "missing upcoming payables fact",
  );
});

runTest("business events", () => {
  const businessReality = createBusinessRealityCompany(
    alphaEngenhariaBusinessRealityInput,
  );

  assertEqual(businessReality.events.length, 8, "event count mismatch");
  assertEqual(
    businessReality.events[0]?.title,
    "Large contract signed",
    "first event title mismatch",
  );
  assertEqual(
    businessReality.events[1]?.title,
    "Client delayed payment",
    "second event title mismatch",
  );
  assertEqual(
    businessReality.events[7]?.title,
    "Bank financing approved",
    "last event title mismatch",
  );
  assertEqual(
    businessReality.events[2]?.financialImpact,
    -3200000,
    "equipment acquisition impact mismatch",
  );
});

runTest("deterministic output", () => {
  const first = JSON.stringify(
    createBusinessRealityCompany(alphaEngenhariaBusinessRealityInput),
  );
  const second = JSON.stringify(
    createBusinessRealityCompany(alphaEngenhariaBusinessRealityInput),
  );

  assertEqual(first, second, "expected deterministic output");
  assertEqual(
    JSON.stringify(alphaEngenhariaBusinessReality),
    first,
    "exported reality mismatch",
  );
});

runTest("traceability", () => {
  const businessReality = createBusinessRealityCompany(
    alphaEngenhariaBusinessRealityInput,
  );
  const companyId = businessReality.company.id;
  const scenarioId = businessReality.scenario.id;

  assertEqual(
    businessReality.company.metadata["traceId"],
    "brs-alpha-engenharia",
    "company trace id mismatch",
  );

  businessReality.events.forEach((event) => {
    assertEqual(
      event.metadata["companyId"],
      companyId,
      "event company trace mismatch",
    );
    assertEqual(
      event.metadata["scenarioId"],
      scenarioId,
      "event scenario trace mismatch",
    );
    assertEqual(event.metadata["traceId"], event.id, "event trace id mismatch");
  });
});

function assertArrayIncludes<T>(
  values: ReadonlyArray<T>,
  expected: T,
  message: string,
): void {
  if (!values.includes(expected)) {
    throw new Error(message);
  }
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
