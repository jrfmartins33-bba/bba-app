"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import styles from "@/components/budget/proposal-scenarios.module.css";
import { lotPresentation, type ConsolidatedBudgetSummaryDto } from "@/lib/budget/consolidated-budget-catalog";
import type { BudgetOrganizationOption } from "@/lib/budget/budget-organization-policy";
import { comparisonLabel, formatBasisPointsPtBr, formatCentsPtBr, formatDifferencePtBr, type ProposalScenarioDto } from "@/lib/proposal-scenarios";

export default function ProposalScenarioPage({ params }: { readonly params: { readonly scenarioId: string } }) {
  return <Suspense fallback={<div className={styles.loading}>Abrindo cenário…</div>}><ProposalScenarioContent scenarioId={params.scenarioId} /></Suspense>;
}

function ProposalScenarioContent({ scenarioId }: { readonly scenarioId: string }) {
  const searchParams = useSearchParams();
  const requestedOrganizationId = searchParams.get("empresa");
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(requestedOrganizationId);
  const [scenario, setScenario] = useState<ProposalScenarioDto | null | undefined>(undefined);
  const [sourceBudget, setSourceBudget] = useState<ConsolidatedBudgetSummaryDto | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(withOrganization(`/api/orcamentos/cenarios/${scenarioId}`, requestedOrganizationId), { signal: controller.signal })
      .then(async (response) => response.ok ? (await response.json()) as { scenario: ProposalScenarioDto; organization: BudgetOrganizationOption } : null)
      .then(async (scenarioPayload) => {
        const nextScenario = scenarioPayload?.scenario ?? null;
        setScenario(nextScenario);
        if (!nextScenario) return;
        const organizationId = scenarioPayload?.organization.id ?? requestedOrganizationId;
        setActiveOrganizationId(organizationId);
        const response = await fetch(withOrganization(`/api/orcamentos/consolidado/resumo?orcamento=${encodeURIComponent(nextScenario.sourceBudgetId)}`, organizationId), { signal: controller.signal });
        if (!response.ok) return;
        const summaryPayload = (await response.json()) as { budget: ConsolidatedBudgetSummaryDto | null };
        setSourceBudget(summaryPayload.budget);
      })
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setScenario(null);
      });
    return () => controller.abort();
  }, [requestedOrganizationId, scenarioId]);

  const tone = scenario?.comparisonKind === "Reduction" ? styles.reduction : scenario?.comparisonKind === "Increase" ? styles.increase : styles.equal;
  const sourcePresentation = sourceBudget ? lotPresentation(sourceBudget.procurementLotTitle, sourceBudget.scopeKind) : null;

  return (
    <>
      <BudgetPageHeader isDemonstration={false} />
      <section className="section-grid">
        <div className={styles.page}>
          {scenario === undefined ? <div className={styles.loading}>Abrindo cenário…</div> : null}
          {scenario === null ? <div className={styles.notice}><strong>Cenário não encontrado</strong>Ele pode não existir ou não estar disponível para sua organização.</div> : null}
          {scenario ? (
            <>
              <div className={styles.hero}>
                <div className={styles.heroTop}>
                  <div><p className={styles.eyebrow}>Cenário de Proposta</p><h1>{scenario.name}</h1></div>
                  <div className={styles.actions}>
                    <Link className={styles.secondary} href={withOrganization(`/orcamentos/cenarios/novo?orcamento=${scenario.sourceBudgetId}&duplicar=${scenario.id}`, activeOrganizationId)}>Duplicar cenário</Link>
                    <Link className={styles.primary} href={withOrganization(`/orcamentos/cenarios/comparar?ids=${scenario.id}`, activeOrganizationId)}>Comparar cenários</Link>
                  </div>
                </div>
                <p className={styles.proposalLabel}>Valor da proposta</p>
                <p className={styles.proposalValue}>{formatCentsPtBr(scenario.targetValueCents)}</p>
                <div className={`${styles.delta} ${tone}`}>
                  <strong>{formatDifferencePtBr(scenario)}</strong>
                  <strong>{formatBasisPointsPtBr(scenario.differenceBasisPoints, scenario.comparisonKind)}</strong>
                  <span>{comparisonLabel(scenario.comparisonKind)} em relação ao oficial</span>
                </div>
                <p className={styles.base}>Base do cenário: Orçamento Oficial{sourcePresentation ? ` — ${sourcePresentation.title}` : ""}</p>
              </div>
              <div className={styles.summary}>
                <div className={styles.summaryItem}><span>Orçamento Oficial</span><strong>{formatCentsPtBr(scenario.officialValueCents)}</strong></div>
                <div className={styles.summaryItem}><span>Valor do cenário</span><strong>{formatCentsPtBr(scenario.targetValueCents)}</strong></div>
                <div className={styles.summaryItem}><span>Diferença</span><strong className={tone}>{formatDifferencePtBr(scenario)}</strong></div>
                <div className={styles.summaryItem}><span>Percentual</span><strong className={tone}>{formatBasisPointsPtBr(scenario.differenceBasisPoints, scenario.comparisonKind)}</strong></div>
                <div className={styles.summaryItem}><span>Criado em</span><strong>{new Date(scenario.createdAt).toLocaleString("pt-BR")}</strong></div>
                <div className={styles.summaryItem}><span>Origem</span><strong>{sourcePresentation?.title ?? "Orçamento Oficial"}</strong></div>
              </div>
              <div className={styles.notice}><strong>Margem e custo ainda não avaliados</strong>Este cenário compara o valor da proposta com o orçamento oficial. A análise de margem depende de custos e composições econômicas que ainda não foram informados.</div>
              <div className={styles.actions}><Link href={withOrganization("/orcamentos", activeOrganizationId)} className={styles.secondary}>Voltar ao orçamento</Link></div>
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}

function withOrganization(path: string, organizationId: string | null): string {
  if (!organizationId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}empresa=${encodeURIComponent(organizationId)}`;
}
