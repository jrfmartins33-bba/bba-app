"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import {
  OfficialBudgetDetail,
  type OfficialBudgetDto,
} from "@/components/budget/official-budget-detail";
import catalogStyles from "@/components/budget/official-budget-catalog.module.css";
import scenarioStyles from "@/components/budget/proposal-scenarios.module.css";
import {
  lotPresentation,
  type ConsolidatedBudgetSummaryDto,
} from "@/lib/budget/consolidated-budget-catalog";
import {
  formatBasisPointsPtBr,
  formatCentsPtBr,
  type ProposalScenarioDto,
} from "@/lib/proposal-scenarios";
import type {
  BudgetOrganizationAccessKind,
  BudgetOrganizationOption,
} from "@/lib/budget/budget-organization-policy";

interface SummaryPayload {
  readonly budget: ConsolidatedBudgetSummaryDto | null;
  readonly scenarios?: ReadonlyArray<ProposalScenarioDto>;
  readonly accessKind?: BudgetOrganizationAccessKind;
  readonly organization?: BudgetOrganizationOption | null;
  readonly organizations?: ReadonlyArray<BudgetOrganizationOption>;
}

export default function IndividualBudgetPage({
  params,
}: {
  readonly params?: { readonly budgetId?: string };
}) {
  const routeParams = useParams();
  const rawId = params?.budgetId ?? routeParams?.budgetId;
  const budgetId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";

  return (
    <Suspense
      fallback={
        <>
          <BudgetPageHeader isDemonstration={false} />
          <section className="section-grid">
            <p>Carregando orçamento…</p>
          </section>
        </>
      }
    >
      <IndividualBudgetContent budgetId={budgetId} />
    </Suspense>
  );
}

function IndividualBudgetContent({ budgetId }: { readonly budgetId: string }) {
  const searchParams = useSearchParams();
  const requestedOrganizationId = searchParams.get("empresa");

  const [summary, setSummary] = useState<ConsolidatedBudgetSummaryDto | null | undefined>(undefined);
  const [detailBudget, setDetailBudget] = useState<OfficialBudgetDto | null | undefined>(undefined);
  const [scenarios, setScenarios] = useState<ReadonlyArray<ProposalScenarioDto>>([]);
  const [accessKind, setAccessKind] = useState<BudgetOrganizationAccessKind | null>(null);
  const [organization, setOrganization] = useState<BudgetOrganizationOption | null>(null);
  const [organizations, setOrganizations] = useState<ReadonlyArray<BudgetOrganizationOption>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!budgetId) return;
    const controller = new AbortController();
    setSummary(undefined);
    setDetailBudget(undefined);
    setScenarios([]);
    setLoadError(null);

    const organizationQuery = requestedOrganizationId ? `&empresa=${encodeURIComponent(requestedOrganizationId)}` : "";

    Promise.all([
      fetch(`/api/orcamentos/consolidado/resumo?orcamento=${encodeURIComponent(budgetId)}${organizationQuery}`, {
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os metadados do orçamento.");
        return (await response.json()) as SummaryPayload;
      }),
      fetch(`/api/orcamentos/consolidado?orcamento=${encodeURIComponent(budgetId)}${organizationQuery}`, {
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os itens deste orçamento.");
        return (await response.json()) as { budget: OfficialBudgetDto | null };
      }),
    ])
      .then(([summaryPayload, detailPayload]) => {
        if (!summaryPayload.budget || !detailPayload.budget) {
          throw new Error("Este orçamento não está disponível.");
        }
        setSummary(summaryPayload.budget);
        setScenarios(summaryPayload.scenarios ?? []);
        setAccessKind(summaryPayload.accessKind ?? null);
        setOrganization(summaryPayload.organization ?? null);
        setOrganizations(summaryPayload.organizations ?? []);
        setDetailBudget(detailPayload.budget);
        setLoadError(null);
      })
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") {
          setLoadError(cause.message);
          setSummary(null);
          setDetailBudget(null);
        }
      });

    return () => controller.abort();
  }, [budgetId, requestedOrganizationId]);

  const organizationIdForLinks = accessKind === "bba_admin" ? organization?.id ?? null : null;

  if (summary === undefined || detailBudget === undefined) {
    return (
      <>
        <BudgetPageHeader isDemonstration={false} />
        <section className="section-grid">
          <p>Carregando orçamento…</p>
        </section>
      </>
    );
  }

  if (loadError || !summary || !detailBudget) {
    return (
      <>
        <BudgetPageHeader isDemonstration={false} />
        <section className="section-grid">
          <div className={catalogStyles.error} role="alert">
            <strong>Não foi possível abrir este orçamento.</strong>
            <span>{loadError ?? "Orçamento não encontrado ou indisponível."}</span>
          </div>
          <div className={catalogStyles.topActions} style={{ marginTop: "1rem" }}>
            <Link
              href={withOrganization("/orcamentos", organizationIdForLinks)}
              className="bba-button bba-button--ghost bba-button--sm"
            >
              ← Voltar para Orçamentos
            </Link>
          </div>
        </section>
      </>
    );
  }

  const presentation = lotPresentation(summary.procurementLotTitle, summary.scopeKind);

  return (
    <>
      <BudgetPageHeader isDemonstration={false} />
      <section className={`section-grid ${catalogStyles.individualPage}`}>
        <div className={catalogStyles.topActions}>
          <Link
            href={withOrganization("/orcamentos", organizationIdForLinks)}
            className="bba-button bba-button--ghost bba-button--sm"
          >
            ← Voltar para Orçamentos
          </Link>
        </div>

        {accessKind === "bba_admin" && organization ? (
          <OrganizationContext organization={organization} organizations={organizations} />
        ) : null}

        <article className={catalogStyles.individualHero}>
          <div className={catalogStyles.individualHeroTop}>
            <div>
              <p className={catalogStyles.lotScope}>
                {summary.scopeKind === "Lot" ? "Lote independente" : "Processo completo"}
              </p>
              <h2>{presentation.title}</h2>
              {presentation.detail ? <p className={catalogStyles.individualProcessTitle}>{presentation.detail}</p> : null}
              <p className={catalogStyles.individualProcessTitle}>{summary.procurementCaseTitle}</p>
            </div>
            <span className={catalogStyles.confirmed}>Confirmado</span>
          </div>

          <div className={catalogStyles.individualValueBlock}>
            <span className={catalogStyles.individualValueLabel}>Valor total do orçamento oficial</span>
            <p className={catalogStyles.individualValue}>{formatCentsPtBr(summary.officialValueCents)}</p>
          </div>

          <div className={catalogStyles.individualMetricsStrip}>
            <span>
              <strong>{summary.serviceItemCount}</strong> itens de serviço
            </span>
            {summary.lineCount !== null ? (
              <span>
                <strong>{summary.lineCount}</strong> linhas
              </span>
            ) : null}
            <span>Revisão {summary.revision}</span>
          </div>

          <div className={catalogStyles.individualCardActions}>
            <Link
              href={withOrganization(`/orcamentos/cenarios/novo?orcamento=${summary.id}`, organizationIdForLinks)}
              className={scenarioStyles.primary}
            >
              Criar cenário
            </Link>
          </div>
        </article>

        {scenarios.length > 0 ? (
          <section className={catalogStyles.individualScenariosCard} aria-labelledby="lot-scenarios-heading">
            <div className={catalogStyles.scenarioHeading}>
              <h4 id="lot-scenarios-heading">Cenários de Proposta ({scenarios.length})</h4>
              {scenarios.length > 1 ? (
                <Link
                  href={withOrganization(`/orcamentos/cenarios/comparar?orcamento=${summary.id}`, organizationIdForLinks)}
                  className={catalogStyles.textLink}
                >
                  Comparar
                </Link>
              ) : null}
            </div>
            <ul className={catalogStyles.scenarios} style={{ borderTop: "none", marginTop: "0.5rem" }}>
              {scenarios.map((scenario) => (
                <li key={scenario.id} style={{ marginBottom: "0.4rem" }}>
                  <div>
                    <strong>{scenario.name}</strong>
                    <span>
                      {formatCentsPtBr(scenario.targetValueCents)} · {formatBasisPointsPtBr(scenario.differenceBasisPoints, scenario.comparisonKind)}
                    </span>
                  </div>
                  <div>
                    <Link href={withOrganization(`/orcamentos/cenarios/${scenario.id}`, organizationIdForLinks)}>
                      Abrir
                    </Link>
                    <Link href={withOrganization(`/orcamentos/cenarios/novo?duplicar=${scenario.id}`, organizationIdForLinks)}>
                      Duplicar
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className={catalogStyles.treeCard}>
          <OfficialBudgetDetail budget={detailBudget} summary={summary} />
        </div>
      </section>
    </>
  );
}

function OrganizationContext({
  organization,
  organizations,
}: {
  readonly organization: BudgetOrganizationOption;
  readonly organizations: ReadonlyArray<BudgetOrganizationOption>;
}) {
  return (
    <section className={catalogStyles.organizationContext} aria-label="Empresa selecionada">
      <div>
        <span>Empresa</span>
        <strong>{organization.name}</strong>
      </div>
      {organizations.length > 1 ? (
        <Link href="/orcamentos" className={catalogStyles.textLink}>
          Trocar empresa
        </Link>
      ) : null}
    </section>
  );
}

function withOrganization(path: string, organizationId: string | null): string {
  if (!organizationId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}empresa=${encodeURIComponent(organizationId)}`;
}
