import type { BusinessFact } from "../../../domain/business-fact";
import type { Rule } from "../../../engines/decision/rule-engine";

const currentCashBalanceType = "current_cash_balance";
const upcomingReceivablesType = "upcoming_receivables";
const upcomingPayablesType = "upcoming_payables";

type NumericBusinessFact = BusinessFact & {
  readonly value: number;
};

export const projectedCashDeficitRule: Rule = (facts) => {
  const currentCashBalanceFacts = getNumericFactsByType(
    facts,
    currentCashBalanceType,
  );
  const upcomingReceivablesFacts = getNumericFactsByType(
    facts,
    upcomingReceivablesType,
  );
  const upcomingPayablesFacts = getNumericFactsByType(
    facts,
    upcomingPayablesType,
  );

  const currentCashBalance = sumFactValues(currentCashBalanceFacts);
  const upcomingReceivables = sumFactValues(upcomingReceivablesFacts);
  const upcomingPayables = sumFactValues(upcomingPayablesFacts);
  const projectedCash =
    currentCashBalance + upcomingReceivables - upcomingPayables;

  if (projectedCash >= 0) {
    return [];
  }

  const usedFacts = [
    ...currentCashBalanceFacts,
    ...upcomingReceivablesFacts,
    ...upcomingPayablesFacts,
  ];

  return [
    {
      id: createDiagnosisId(usedFacts),
      category: "financial",
      type: "projected_cash_deficit",
      title: "Projected cash deficit",
      description:
        "Projected cash position is negative based on current balance, upcoming receivables, and upcoming payables.",
      severity: "high",
      confidence: 95,
      facts: usedFacts,
      metadata: {
        projectedCash,
        currentCashBalance,
        upcomingReceivables,
        upcomingPayables,
      },
      createdAt: getLatestObservedAt(usedFacts),
    },
  ];
};

function getNumericFactsByType(
  facts: ReadonlyArray<BusinessFact>,
  type: string,
): ReadonlyArray<NumericBusinessFact> {
  return facts.filter(
    (fact): fact is NumericBusinessFact =>
      fact.type === type && typeof fact.value === "number",
  );
}

function sumFactValues(facts: ReadonlyArray<NumericBusinessFact>): number {
  return facts.reduce((total, fact) => total + fact.value, 0);
}

function createDiagnosisId(facts: ReadonlyArray<BusinessFact>): string {
  const factIds = facts.map((fact) => fact.id).join(":");

  return `cash-intelligence:projected-cash-deficit:${factIds}`;
}

function getLatestObservedAt(facts: ReadonlyArray<BusinessFact>): string {
  return facts.reduce(
    (latest, fact) => (fact.observedAt > latest ? fact.observedAt : latest),
    facts[0]?.observedAt ?? "",
  );
}
