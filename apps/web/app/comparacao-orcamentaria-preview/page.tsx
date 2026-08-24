import { notFound } from "next/navigation";
import { buildBudgetComparisonValidationFixture } from "@bba/bdos-core/services/procurement-engineering";
import { OfficialBudgetDetail, type OfficialBudgetDto } from "@/components/budget/official-budget-detail";
import type { ConsolidatedBudgetSummaryDto } from "@/lib/budget/consolidated-budget-catalog";
import styles from "./page.module.css";

export default function BudgetComparisonPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const { proposalBudgetVersion, comparison } = buildBudgetComparisonValidationFixture();
  const budget: OfficialBudgetDto = {
    id: proposalBudgetVersion.id,
    status: "Consolidated",
    lines: proposalBudgetVersion.lines,
  };
  const summary: ConsolidatedBudgetSummaryDto = {
    id: proposalBudgetVersion.id,
    procurementCaseId: proposalBudgetVersion.procurementCaseId,
    procurementLotId: null,
    procurementCaseTitle: "Recuperação e Modernização da Barragem Lagoa do Arroz",
    procurementLotTitle: null,
    scopeKind: "WholeCase",
    originKind: "DocumentaryOpaqueReference",
    documentKind: "WinningProposal",
    sourceBudgetVersionId: comparison.officialBudgetVersionId,
    contractorName: "Consórcio CONJASF-HIDROMEC",
    contractNumber: "22/2025",
    contractStatus: "InExecution",
    scenarioCreationAllowed: false,
    status: "Consolidated",
    revision: 1,
    officialValueCents: comparison.summary.proposalTotalCents,
    lineCount: proposalBudgetVersion.lines.length,
    serviceItemCount: comparison.summary.proposalServiceItemCount,
    updatedAt: "2026-08-24T00:00:00.000Z",
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.previewBar}>
          <strong>Prévia local · Comparação item a item</strong>
          <span>Somente leitura · fixtures documentais validadas · indisponível em produção</span>
        </aside>
        <section className={styles.card}>
          <OfficialBudgetDetail budget={budget} summary={summary} comparison={comparison} />
        </section>
      </div>
    </main>
  );
}
