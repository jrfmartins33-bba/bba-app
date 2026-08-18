"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import styles from "@/components/budget/proposal-scenarios.module.css";
import { formatBasisPointsPtBr, formatCentsPtBr, formatDifferencePtBr, type ProposalScenarioDto } from "@/lib/proposal-scenarios";

export default function CompareProposalScenariosPage() {
  return <Suspense fallback={<div className={styles.loading}>Preparando comparação…</div>}><CompareProposalScenariosContent /></Suspense>;
}

function CompareProposalScenariosContent() {
  const searchParams = useSearchParams();
  const initialIds = useMemo(() => (searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 3), [searchParams]);
  const [scenarios, setScenarios] = useState<ReadonlyArray<ProposalScenarioDto> | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<ReadonlyArray<string>>(initialIds);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/orcamentos/cenarios", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os cenários.");
        return ((await response.json()) as { scenarios: ReadonlyArray<ProposalScenarioDto> }).scenarios;
      })
      .then(setScenarios)
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") {
          setError(cause.message);
          setScenarios([]);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!scenarios) return;
    setSelectedIds((current) => {
      const candidates = scenarios.filter((scenario) => current.includes(scenario.id));
      const origin = candidates[0]?.sourceBudgetId;
      return candidates.filter((scenario) => scenario.sourceBudgetId === origin).slice(0, 3).map((scenario) => scenario.id);
    });
  }, [scenarios]);

  const selected = (scenarios ?? []).filter((scenario) => selectedIds.includes(scenario.id));
  const sourceId = selected[0]?.sourceBudgetId;
  const available = (scenarios ?? []).filter((scenario) => !sourceId || scenario.sourceBudgetId === sourceId);

  function toggle(scenario: ProposalScenarioDto) {
    setError(null);
    setSelectedIds((current) => {
      if (current.includes(scenario.id)) return current.filter((id) => id !== scenario.id);
      if (current.length >= 3) {
        setError("Selecione no máximo três cenários.");
        return current;
      }
      if (sourceId && scenario.sourceBudgetId !== sourceId) {
        setError("Só é possível comparar cenários baseados no mesmo orçamento oficial.");
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
            <div><p className={styles.eyebrow}>Cenários de Proposta</p><h2>Comparar cenários</h2><p>Escolha até três valores baseados no mesmo orçamento oficial.</p></div>
            <Link href="/orcamentos" className={styles.secondary}>Voltar ao orçamento</Link>
          </div>
          {scenarios === undefined ? <div className={styles.loading}>Carregando cenários…</div> : null}
          {scenarios?.length === 0 ? <div className={styles.notice}><strong>Nenhum cenário salvo</strong>Crie ao menos um cenário para iniciar a comparação.</div> : null}
          {available.length > 0 ? (
            <div className={styles.selector}>
              {available.map((scenario) => (
                <label className={styles.choice} key={scenario.id}>
                  <input type="checkbox" checked={selectedIds.includes(scenario.id)} onChange={() => toggle(scenario)} />
                  <span><strong>{scenario.name}</strong><span>{formatCentsPtBr(scenario.targetValueCents)} · {formatBasisPointsPtBr(scenario.differenceBasisPoints, scenario.comparisonKind)}</span></span>
                </label>
              ))}
            </div>
          ) : null}
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
