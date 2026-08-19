"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import { BudgetEmptyState } from "@/components/budget/budget-empty-state";
import catalogStyles from "@/components/budget/official-budget-catalog.module.css";
import scenarioStyles from "@/components/budget/proposal-scenarios.module.css";
import {
  lotPresentation,
  sortBudgetsByLotAscending,
  type ConsolidatedBudgetCatalogDto,
} from "@/lib/budget/consolidated-budget-catalog";
import { formatBasisPointsPtBr, formatCentsPtBr, type ProposalScenarioDto } from "@/lib/proposal-scenarios";
import type { BudgetOrganizationAccessKind, BudgetOrganizationOption } from "@/lib/budget/budget-organization-policy";

interface CatalogPayload extends ConsolidatedBudgetCatalogDto {
  readonly accessKind: BudgetOrganizationAccessKind;
  readonly organization: BudgetOrganizationOption | null;
  readonly organizations: ReadonlyArray<BudgetOrganizationOption>;
  readonly organizationSelectionRequired: boolean;
  readonly scenarios?: ReadonlyArray<ProposalScenarioDto>;
}

export default function OrcamentosPage() {
  return (
    <Suspense fallback={<><BudgetPageHeader isDemonstration={false} /><section className="section-grid"><p>Carregando orçamentos…</p></section></>}>
      <OrcamentosContent />
    </Suspense>
  );
}

function OrcamentosContent() {
  const searchParams = useSearchParams();
  const requestedOrganizationId = searchParams.get("empresa");
  const [catalog, setCatalog] = useState<ConsolidatedBudgetCatalogDto | undefined>(undefined);
  const [scenarios, setScenarios] = useState<ReadonlyArray<ProposalScenarioDto>>([]);
  const [accessKind, setAccessKind] = useState<BudgetOrganizationAccessKind | null>(null);
  const [organization, setOrganization] = useState<BudgetOrganizationOption | null>(null);
  const [organizations, setOrganizations] = useState<ReadonlyArray<BudgetOrganizationOption>>([]);
  const [organizationSelectionRequired, setOrganizationSelectionRequired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCatalog(undefined);
    setScenarios([]);
    setOrganization(null);
    setOrganizationSelectionRequired(false);
    const organizationQuery = requestedOrganizationId ? `?empresa=${encodeURIComponent(requestedOrganizationId)}` : "";
    fetch(`/api/orcamentos/consolidado/resumo${organizationQuery}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os orçamentos oficiais.");
        return (await response.json()) as CatalogPayload;
      })
      .then((payload) => {
        setCatalog({ budgets: payload.budgets, processes: payload.processes });
        setScenarios(payload.scenarios ?? []);
        setAccessKind(payload.accessKind);
        setOrganization(payload.organization);
        setOrganizations(payload.organizations);
        setOrganizationSelectionRequired(payload.organizationSelectionRequired);
        setLoadError(null);
      })
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") {
          setLoadError(cause.message);
          setCatalog({ budgets: [], processes: [] });
        }
      });
    return () => controller.abort();
  }, [requestedOrganizationId]);

  const organizationIdForLinks = accessKind === "bba_admin" ? organization?.id ?? null : null;

  const scenariosByBudget = useMemo(() => {
    const grouped = new Map<string, ProposalScenarioDto[]>();
    for (const scenario of scenarios) {
      const current = grouped.get(scenario.sourceBudgetId) ?? [];
      current.push(scenario);
      grouped.set(scenario.sourceBudgetId, current);
    }
    return grouped;
  }, [scenarios]);

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

  if (organizationSelectionRequired) {
    return (
      <>
        <BudgetPageHeader isDemonstration={false} />
        <section className={`section-grid ${catalogStyles.page}`}>
          <OrganizationSelector organizations={organizations} />
        </section>
      </>
    );
  }

  if (catalog.budgets.length === 0) {
    return <><BudgetPageHeader isDemonstration={false} /><section className="section-grid">{accessKind === "bba_admin" && organization ? <OrganizationContext organization={organization} organizations={organizations} /> : null}<BudgetEmptyState /></section></>;
  }

  return (
    <>
      <BudgetPageHeader isDemonstration={false} />
      <section className={`section-grid ${catalogStyles.page}`}>
        {accessKind === "bba_admin" && organization ? <OrganizationContext organization={organization} organizations={organizations} /> : null}
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
                <div><dt>Escopo confirmado</dt><dd>{process.budgets.length} {process.budgets.length === 1 ? "lote confirmado" : "lotes confirmados"}</dd></div>
                <div><dt>Valor total dos lotes</dt><dd>{formatCentsPtBr(process.totalOfficialValueCents)}</dd></div>
              </dl>
            </div>
            <p className={catalogStyles.contextNote}>O total é apenas a soma visual dos lotes. Cada orçamento e cada cenário continuam independentes.</p>

            <div className={catalogStyles.lotGrid}>
              {sortBudgetsByLotAscending(process.budgets).map((budget) => {
                const presentation = lotPresentation(budget.procurementLotTitle, budget.scopeKind);
                const budgetScenarios = scenariosByBudget.get(budget.id) ?? [];
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
                      <Link
                        href={withOrganization(`/orcamentos/${budget.id}`, organizationIdForLinks)}
                        className={scenarioStyles.secondary}
                      >
                        Ver orçamento
                      </Link>
                      <Link href={withOrganization(`/orcamentos/cenarios/novo?orcamento=${budget.id}`, organizationIdForLinks)} className={scenarioStyles.primary}>Criar cenário</Link>
                    </div>

                    <section className={catalogStyles.scenarios} aria-labelledby={`scenarios-${budget.id}`}>
                      <div className={catalogStyles.scenarioHeading}>
                        <h4 id={`scenarios-${budget.id}`}>Cenários de Proposta</h4>
                        {budgetScenarios.length > 1 ? <Link href={withOrganization(`/orcamentos/cenarios/comparar?orcamento=${budget.id}`, organizationIdForLinks)} className={catalogStyles.textLink}>Comparar</Link> : null}
                      </div>
                      {budgetScenarios.length === 0 ? <p>Nenhum cenário criado para este lote.</p> : (
                        <ul>
                          {budgetScenarios.map((scenario) => (
                            <li key={scenario.id}>
                              <div><strong>{scenario.name}</strong><span>{formatCentsPtBr(scenario.targetValueCents)} · {formatBasisPointsPtBr(scenario.differenceBasisPoints, scenario.comparisonKind)}</span></div>
                              <div><Link href={withOrganization(`/orcamentos/cenarios/${scenario.id}`, organizationIdForLinks)}>Abrir</Link><Link href={withOrganization(`/orcamentos/cenarios/novo?duplicar=${scenario.id}`, organizationIdForLinks)}>Duplicar</Link></div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
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

function OrganizationContext({
  organization,
  organizations,
}: {
  readonly organization: BudgetOrganizationOption;
  readonly organizations: ReadonlyArray<BudgetOrganizationOption>;
}) {
  return (
    <section className={catalogStyles.organizationContext} aria-label="Empresa selecionada">
      <div><span>Empresa</span><strong>{organization.name}</strong></div>
      {organizations.length > 1 ? <Link href="/orcamentos" className={catalogStyles.textLink}>Trocar empresa</Link> : null}
    </section>
  );
}

function OrganizationSelector({ organizations }: { readonly organizations: ReadonlyArray<BudgetOrganizationOption> }) {
  return (
    <section className={catalogStyles.organizationSelector} aria-labelledby="organization-selector-title">
      <div><p className={catalogStyles.eyebrow}>Orçamentos Oficiais</p><h2 id="organization-selector-title">Selecione a empresa</h2><p>Escolha a empresa cliente cujos processos, lotes e cenários você deseja visualizar.</p></div>
      {organizations.length === 0 ? <p>Nenhuma empresa possui orçamento confirmado neste momento.</p> : (
        <div className={catalogStyles.organizationGrid}>
          {organizations.map((option) => <Link key={option.id} href={`/orcamentos?empresa=${encodeURIComponent(option.id)}`}><span>Empresa cliente</span><strong>{option.name}</strong></Link>)}
        </div>
      )}
    </section>
  );
}

function withOrganization(path: string, organizationId: string | null): string {
  if (!organizationId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}empresa=${encodeURIComponent(organizationId)}`;
}
