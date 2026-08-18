"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import { BudgetEmptyState } from "@/components/budget/budget-empty-state";
import catalogStyles from "@/components/budget/official-budget-catalog.module.css";
import scenarioStyles from "@/components/budget/proposal-scenarios.module.css";
import {
  lotPresentation,
  type ConsolidatedBudgetCatalogDto,
  type ConsolidatedBudgetSummaryDto,
} from "@/lib/budget/consolidated-budget-catalog";
import { formatBasisPointsPtBr, formatCentsPtBr, type ProposalScenarioDto } from "@/lib/proposal-scenarios";

interface OfficialLine {
  readonly id: string;
  readonly kind: "Group" | "Subgroup" | "ServiceItem";
  readonly description: { readonly status: "Confirmed"; readonly text: string } | { readonly status: "AbsentFromSource" };
  readonly externalCode: string | null;
  readonly parentLineId: string | null;
  readonly position: number;
  readonly totalCents: number | null;
}

interface OfficialBudgetDto {
  readonly id: string;
  readonly status: "Consolidated";
  readonly lines: ReadonlyArray<OfficialLine>;
}

type DetailState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly budget: OfficialBudgetDto }
  | { readonly status: "error"; readonly message: string };

export default function OrcamentosPage() {
  const [catalog, setCatalog] = useState<ConsolidatedBudgetCatalogDto | undefined>(undefined);
  const [scenarios, setScenarios] = useState<ReadonlyArray<ProposalScenarioDto>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [details, setDetails] = useState<Readonly<Record<string, DetailState>>>({});
  const [openBudgetId, setOpenBudgetId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/orcamentos/consolidado/resumo", { signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os orçamentos oficiais.");
        const payload = (await response.json()) as ConsolidatedBudgetCatalogDto;
        return { budgets: payload.budgets, processes: payload.processes };
      }),
      fetch("/api/orcamentos/cenarios", { signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os cenários de proposta.");
        return ((await response.json()) as { scenarios: ReadonlyArray<ProposalScenarioDto> }).scenarios;
      }),
    ])
      .then(([nextCatalog, nextScenarios]) => {
        setCatalog(nextCatalog);
        setScenarios(nextScenarios);
      })
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") {
          setLoadError(cause.message);
          setCatalog({ budgets: [], processes: [] });
        }
      });
    return () => controller.abort();
  }, []);

  const scenariosByBudget = useMemo(() => {
    const grouped = new Map<string, ProposalScenarioDto[]>();
    for (const scenario of scenarios) {
      const current = grouped.get(scenario.sourceBudgetId) ?? [];
      current.push(scenario);
      grouped.set(scenario.sourceBudgetId, current);
    }
    return grouped;
  }, [scenarios]);

  async function toggleBudgetDetail(budgetId: string) {
    if (openBudgetId === budgetId) {
      setOpenBudgetId(null);
      return;
    }
    setOpenBudgetId(budgetId);
    if (details[budgetId]) return;

    setDetails((current) => ({ ...current, [budgetId]: { status: "loading" } }));
    try {
      const response = await fetch(`/api/orcamentos/consolidado?orcamento=${encodeURIComponent(budgetId)}`);
      if (!response.ok) throw new Error("Não foi possível abrir este orçamento.");
      const payload = (await response.json()) as { budget: OfficialBudgetDto | null };
      if (!payload.budget) throw new Error("Este orçamento não está disponível.");
      setDetails((current) => ({ ...current, [budgetId]: { status: "loaded", budget: payload.budget! } }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível abrir este orçamento.";
      setDetails((current) => ({ ...current, [budgetId]: { status: "error", message } }));
    }
  }

  if (catalog === undefined) {
    return <><BudgetPageHeader isDemonstration={false} /><section className="section-grid"><p>Carregando orçamentos…</p></section></>;
  }

  if (loadError) {
    return (
      <>
        <BudgetPageHeader isDemonstration={false} />
        <section className="section-grid">
          <div className={catalogStyles.error} role="alert"><strong>Não foi possível abrir Orçamentos.</strong><span>{loadError}</span></div>
        </section>
      </>
    );
  }

  if (catalog.budgets.length === 0) {
    return <><BudgetPageHeader isDemonstration={false} /><section className="section-grid"><BudgetEmptyState /></section></>;
  }

  return (
    <>
      <BudgetPageHeader isDemonstration={false} />
      <section className={`section-grid ${catalogStyles.page}`}>
        <div className={catalogStyles.topActions}>
          <Link href="/workspaces/engenharia" className="bba-button bba-button--ghost bba-button--sm">Voltar ao Workspace Engenharia</Link>
          <div className={catalogStyles.importAction}>
            <Link href="/orcamentos/importar" className="bba-button bba-button--secondary bba-button--sm">Importar outro orçamento</Link>
            <span>Inicia outro fluxo documental e não substitui os orçamentos confirmados.</span>
          </div>
        </div>

        {catalog.processes.map((process) => (
          <section className={catalogStyles.process} key={process.procurementCaseId} aria-labelledby={`process-${process.procurementCaseId}`}>
            <div className={catalogStyles.processHeader}>
              <div>
                <p className={catalogStyles.eyebrow}>Orçamento Oficial</p>
                <h2 id={`process-${process.procurementCaseId}`}>{process.title}</h2>
              </div>
              <dl className={catalogStyles.processSummary}>
                <div><dt>Lotes confirmados</dt><dd>{process.budgets.length}</dd></div>
                <div><dt>Valor total dos lotes</dt><dd>{formatCentsPtBr(process.totalOfficialValueCents)}</dd></div>
              </dl>
            </div>
            <p className={catalogStyles.contextNote}>O total é apenas a soma visual dos lotes. Cada orçamento e cada cenário continuam independentes.</p>

            <div className={catalogStyles.lotGrid}>
              {process.budgets.map((budget) => {
                const presentation = lotPresentation(budget.procurementLotTitle, budget.scopeKind);
                const budgetScenarios = scenariosByBudget.get(budget.id) ?? [];
                const detail = details[budget.id];
                const isOpen = openBudgetId === budget.id;
                return (
                  <article className={catalogStyles.lotCard} key={budget.id}>
                    <div className={catalogStyles.lotHeader}>
                      <div>
                        <p className={catalogStyles.lotScope}>{budget.scopeKind === "Lot" ? "Lote independente" : "Processo completo"}</p>
                        <h3>{presentation.title}</h3>
                        {presentation.detail ? <p>{presentation.detail}</p> : null}
                      </div>
                      <span className={catalogStyles.confirmed}>Confirmado</span>
                    </div>
                    <p className={catalogStyles.value}>{formatCentsPtBr(budget.officialValueCents)}</p>
                    <div className={catalogStyles.metrics}>
                      <span><strong>{budget.serviceItemCount}</strong> itens de serviço</span>
                      {budget.lineCount !== null ? <span><strong>{budget.lineCount}</strong> linhas</span> : null}
                      <span>Revisão {budget.revision}</span>
                    </div>
                    <div className={catalogStyles.cardActions}>
                      <button type="button" className={scenarioStyles.secondary} aria-expanded={isOpen} aria-controls={`budget-detail-${budget.id}`} onClick={() => void toggleBudgetDetail(budget.id)}>
                        {isOpen ? "Fechar orçamento" : "Ver orçamento"}
                      </button>
                      <Link href={`/orcamentos/cenarios/novo?orcamento=${budget.id}`} className={scenarioStyles.primary}>Criar cenário</Link>
                    </div>

                    <section className={catalogStyles.scenarios} aria-labelledby={`scenarios-${budget.id}`}>
                      <div className={catalogStyles.scenarioHeading}>
                        <h4 id={`scenarios-${budget.id}`}>Cenários de Proposta</h4>
                        {budgetScenarios.length > 1 ? <Link href={`/orcamentos/cenarios/comparar?orcamento=${budget.id}`} className={catalogStyles.textLink}>Comparar</Link> : null}
                      </div>
                      {budgetScenarios.length === 0 ? <p>Nenhum cenário criado para este lote.</p> : (
                        <ul>
                          {budgetScenarios.map((scenario) => (
                            <li key={scenario.id}>
                              <div><strong>{scenario.name}</strong><span>{formatCentsPtBr(scenario.targetValueCents)} · {formatBasisPointsPtBr(scenario.differenceBasisPoints, scenario.comparisonKind)}</span></div>
                              <div><Link href={`/orcamentos/cenarios/${scenario.id}`}>Abrir</Link><Link href={`/orcamentos/cenarios/novo?duplicar=${scenario.id}`}>Duplicar</Link></div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    {isOpen ? (
                      <div className={catalogStyles.detail} id={`budget-detail-${budget.id}`}>
                        {detail?.status === "loading" ? <p>Carregando os detalhes deste lote…</p> : null}
                        {detail?.status === "error" ? <p role="alert">{detail.message}</p> : null}
                        {detail?.status === "loaded" ? <OfficialBudgetDetail budget={detail.budget} summary={budget} /> : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </section>
    </>
  );
}

function OfficialBudgetDetail({ budget, summary }: { readonly budget: OfficialBudgetDto; readonly summary: ConsolidatedBudgetSummaryDto }) {
  const { childrenByParent, totalsByLine } = useMemo(() => buildLineIndex(budget.lines), [budget.lines]);
  const roots = childrenByParent.get(null) ?? [];
  return (
    <div>
      <div className={catalogStyles.detailHeader}><strong>Itens do orçamento</strong><span>{formatCentsPtBr(summary.officialValueCents)}</span></div>
      {roots.map((line) => <OfficialLineTree key={line.id} line={line} depth={0} childrenByParent={childrenByParent} totalsByLine={totalsByLine} />)}
    </div>
  );
}

function OfficialLineTree({
  line,
  depth,
  childrenByParent,
  totalsByLine,
}: {
  readonly line: OfficialLine;
  readonly depth: number;
  readonly childrenByParent: ReadonlyMap<string | null, ReadonlyArray<OfficialLine>>;
  readonly totalsByLine: ReadonlyMap<string, number>;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const children = childrenByParent.get(line.id) ?? [];
  const isLeaf = line.kind === "ServiceItem";
  const description = line.description.status === "Confirmed" ? line.description.text : "Descrição não informada";
  return (
    <div className={catalogStyles.treeNode} style={{ paddingLeft: `${Math.min(depth, 5) * 1.1}rem` }}>
      <div className={catalogStyles.treeRow}>
        <div>
          {!isLeaf && children.length > 0 ? (
            <button type="button" aria-expanded={expanded} aria-label={`${expanded ? "Recolher" : "Expandir"} ${description}`} onClick={() => setExpanded((current) => !current)}>{expanded ? "▾" : "▸"}</button>
          ) : <span className={catalogStyles.treeSpacer} />}
          <span className={line.kind !== "ServiceItem" ? catalogStyles.strongLine : undefined}>{line.externalCode ? `${line.externalCode} — ` : ""}{description}</span>
        </div>
        <strong>{formatCentsPtBr(totalsByLine.get(line.id) ?? 0)}</strong>
      </div>
      {expanded ? children.map((child) => <OfficialLineTree key={child.id} line={child} depth={depth + 1} childrenByParent={childrenByParent} totalsByLine={totalsByLine} />) : null}
    </div>
  );
}

function buildLineIndex(lines: ReadonlyArray<OfficialLine>): {
  readonly childrenByParent: ReadonlyMap<string | null, ReadonlyArray<OfficialLine>>;
  readonly totalsByLine: ReadonlyMap<string, number>;
} {
  const childrenByParent = new Map<string | null, OfficialLine[]>();
  for (const line of lines) {
    const current = childrenByParent.get(line.parentLineId) ?? [];
    current.push(line);
    childrenByParent.set(line.parentLineId, current);
  }
  for (const children of childrenByParent.values()) children.sort((left, right) => left.position - right.position);

  const totalsByLine = new Map<string, number>();
  const calculate = (line: OfficialLine): number => {
    const cached = totalsByLine.get(line.id);
    if (cached !== undefined) return cached;
    const total = line.kind === "ServiceItem"
      ? line.totalCents ?? 0
      : (childrenByParent.get(line.id) ?? []).reduce((sum, child) => sum + calculate(child), 0);
    totalsByLine.set(line.id, total);
    return total;
  };
  for (const line of lines) calculate(line);
  return { childrenByParent, totalsByLine };
}
