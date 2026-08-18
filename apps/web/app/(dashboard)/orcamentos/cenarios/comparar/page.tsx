"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import styles from "@/components/budget/proposal-scenarios.module.css";
import {
  lotPresentation,
  type ConsolidatedBudgetCatalogDto,
  type ConsolidatedBudgetSummaryDto,
} from "@/lib/budget/consolidated-budget-catalog";
import { canCompareScenarioSource, formatBasisPointsPtBr, formatCentsPtBr, formatDifferencePtBr, type ProposalScenarioDto } from "@/lib/proposal-scenarios";

export default function CompareProposalScenariosPage() {
  return <Suspense fallback={<div className={styles.loading}>Preparando comparação…</div>}><CompareProposalScenariosContent /></Suspense>;
}

function CompareProposalScenariosContent() {
  const searchParams = useSearchParams();
  const initialIds = useMemo(() => (searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 3), [searchParams]);
  const requestedBudgetId = searchParams.get("orcamento");
  const [scenarios, setScenarios] = useState<ReadonlyArray<ProposalScenarioDto> | undefined>(undefined);
  const [catalog, setCatalog] = useState<ConsolidatedBudgetCatalogDto | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<ReadonlyArray<string>>(initialIds);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/orcamentos/cenarios", { signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os cenários.");
        return ((await response.json()) as { scenarios: ReadonlyArray<ProposalScenarioDto> }).scenarios;
      }),
      fetch("/api/orcamentos/consolidado/resumo", { signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os lotes.");
        const payload = (await response.json()) as ConsolidatedBudgetCatalogDto;
        return { budgets: payload.budgets, processes: payload.processes };
      }),
    ])
      .then(([nextScenarios, nextCatalog]) => {
        setScenarios(nextScenarios);
        setCatalog(nextCatalog);
        setSelectedIds((current) => {
          const candidates = nextScenarios.filter((scenario) => current.includes(scenario.id));
          const origin = candidates[0]?.sourceBudgetId ?? requestedBudgetId;
          return candidates.filter((scenario) => !origin || scenario.sourceBudgetId === origin).slice(0, 3).map((scenario) => scenario.id);
        });
      })
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") {
          setError(cause.message);
          setScenarios([]);
          setCatalog({ budgets: [], processes: [] });
        }
      });
    return () => controller.abort();
  }, [requestedBudgetId]);

  const selected = (scenarios ?? []).filter((scenario) => selectedIds.includes(scenario.id));
  const selectedSourceId = selected[0]?.sourceBudgetId ?? requestedBudgetId;
  const budgetsById = useMemo(() => new Map((catalog?.budgets ?? []).map((budget) => [budget.id, budget])), [catalog]);
  const groups = useMemo(() => {
    const grouped = new Map<string, ProposalScenarioDto[]>();
    for (const scenario of scenarios ?? []) {
      const current = grouped.get(scenario.sourceBudgetId) ?? [];
      current.push(scenario);
      grouped.set(scenario.sourceBudgetId, current);
    }
    return Array.from(grouped.entries()).map(([budgetId, groupScenarios]) => ({
      budget: budgetsById.get(budgetId) ?? null,
      budgetId,
      scenarios: groupScenarios,
    }));
  }, [budgetsById, scenarios]);

  function toggle(scenario: ProposalScenarioDto) {
    setError(null);
    setSelectedIds((current) => {
      if (current.includes(scenario.id)) return current.filter((id) => id !== scenario.id);
      if (current.length >= 3) {
        setError("Selecione no máximo três cenários.");
        return current;
      }
      const currentSource = (scenarios ?? []).find((candidate) => current.includes(candidate.id))?.sourceBudgetId ?? requestedBudgetId;
      if (!canCompareScenarioSource(currentSource, scenario.sourceBudgetId)) {
        setError("Compare cenários criados para o mesmo lote.");
        return current;
      }
      return [...current, scenario.id];
    });
  }

  return (
    <>
      <BudgetPageHeader isDemonstration={false} />
      <section className="section-grid">
        <div className={styles.page}>
          <div className={styles.sectionTitle}>
            <div><p className={styles.eyebrow}>Cenários de Proposta</p><h2>Comparar cenários</h2><p>Escolha até três valores criados para o mesmo lote.</p></div>
            <Link href="/orcamentos" className={styles.secondary}>Voltar para Orçamentos</Link>
          </div>
          {scenarios === undefined || catalog === undefined ? <div className={styles.loading}>Carregando cenários…</div> : null}
          {scenarios?.length === 0 ? <div className={styles.notice}><strong>Nenhum cenário salvo</strong>Crie ao menos um cenário para iniciar a comparação.</div> : null}
          {groups.map((group) => <ScenarioLotGroup key={group.budgetId} budget={group.budget} scenarios={group.scenarios} selectedIds={selectedIds} selectedSourceId={selectedSourceId} onToggle={toggle} />)}
          {groups.length > 1 ? <div className={styles.notice}><strong>Comparação por lote</strong>Compare cenários criados para o mesmo lote. Origens diferentes permanecem separadas.</div> : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {selected.length > 0 ? (
            <div className={styles.compareWrap}>
              <table className={styles.compare}>
                <thead><tr><th>Comparação</th><th>Oficial</th>{selected.map((scenario) => <th key={scenario.id}>{scenario.name}</th>)}</tr></thead>
                <tbody>
                  <tr><td>Valor</td><td>{formatCentsPtBr(selected[0].officialValueCents)}</td>{selected.map((scenario) => <td key={scenario.id}><strong>{formatCentsPtBr(scenario.targetValueCents)}</strong></td>)}</tr>
                  <tr><td>Diferença</td><td>—</td>{selected.map((scenario) => <td key={scenario.id}>{formatDifferencePtBr(scenario)}</td>)}</tr>
                  <tr><td>Percentual</td><td>—</td>{selected.map((scenario) => <td key={scenario.id}>{formatBasisPointsPtBr(scenario.differenceBasisPoints, scenario.comparisonKind)}</td>)}</tr>
                </tbody>
              </table>
            </div>
          ) : null}
          <div className={styles.notice}><strong>Margem e custo ainda não avaliados</strong>A comparação mostra somente a relação de cada valor com o orçamento oficial. Ela não recomenda preço nem estima rentabilidade.</div>
        </div>
      </section>
    </>
  );
}

function ScenarioLotGroup({
  budget,
  scenarios,
  selectedIds,
  selectedSourceId,
  onToggle,
}: {
  readonly budget: ConsolidatedBudgetSummaryDto | null;
  readonly scenarios: ReadonlyArray<ProposalScenarioDto>;
  readonly selectedIds: ReadonlyArray<string>;
  readonly selectedSourceId: string | null;
  readonly onToggle: (scenario: ProposalScenarioDto) => void;
}) {
  const presentation = lotPresentation(budget?.procurementLotTitle ?? null, budget?.scopeKind ?? "Lot");
  const disabled = Boolean(selectedSourceId && budget?.id !== selectedSourceId);
  return (
    <section className={styles.budgetGroup} aria-labelledby={`compare-${budget?.id ?? scenarios[0]?.sourceBudgetId}`}>
      <div>
        <h3 id={`compare-${budget?.id ?? scenarios[0]?.sourceBudgetId}`}>{presentation.title}</h3>
        {budget ? <p>{presentation.detail ? `${presentation.detail} · ` : ""}{formatCentsPtBr(budget.officialValueCents)}</p> : null}
      </div>
      <div className={styles.selector}>
        {scenarios.map((scenario) => (
          <label className={styles.choice} key={scenario.id} aria-disabled={disabled}>
            <input type="checkbox" checked={selectedIds.includes(scenario.id)} disabled={disabled && !selectedIds.includes(scenario.id)} onChange={() => onToggle(scenario)} />
            <span><strong>{scenario.name}</strong><span>{formatCentsPtBr(scenario.targetValueCents)} · {formatBasisPointsPtBr(scenario.differenceBasisPoints, scenario.comparisonKind)}</span></span>
          </label>
        ))}
      </div>
    </section>
  );
}
