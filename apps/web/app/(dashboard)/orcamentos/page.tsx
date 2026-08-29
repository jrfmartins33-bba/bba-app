"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import { BudgetEmptyState } from "@/components/budget/budget-empty-state";
import catalogStyles from "@/components/budget/official-budget-catalog.module.css";
import scenarioStyles from "@/components/budget/proposal-scenarios.module.css";
import {
  contractStatusLabel,
  formatPercentageBasisPointsPtBr,
  lotPresentation,
  resolveContractedDocumentChain,
  sortBudgetsByLotAscending,
  type ConsolidatedBudgetProcessDto,
  type ConsolidatedBudgetSummaryDto,
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

        {catalog.processes.map((process) => process.presentationKind === "Lots" ? (
          <LotsProcess
            key={process.procurementCaseId}
            process={process}
            scenariosByBudget={scenariosByBudget}
            organizationIdForLinks={organizationIdForLinks}
          />
        ) : (
          <DocumentChainProcess
            key={process.procurementCaseId}
            process={process}
            scenariosByBudget={scenariosByBudget}
            organizationIdForLinks={organizationIdForLinks}
          />
        ))}
      </section>
    </>
  );
}

function LotsProcess({
  process,
  scenariosByBudget,
  organizationIdForLinks,
}: {
  readonly process: ConsolidatedBudgetProcessDto;
  readonly scenariosByBudget: ReadonlyMap<string, ReadonlyArray<ProposalScenarioDto>>;
  readonly organizationIdForLinks: string | null;
}) {
  return (
    <section className={`${catalogStyles.process} ${catalogStyles.lotsProcess}`} aria-labelledby={`process-${process.procurementCaseId}`}>
      <div className={`${catalogStyles.processHeader} ${catalogStyles.lotsProcessHeader}`}>
        <div>
          <p className={catalogStyles.eyebrow}>Orçamento Oficial</p>
          <h2 id={`process-${process.procurementCaseId}`}>{process.title}</h2>
          <p className={catalogStyles.processMode}>Análise por lotes e cenários</p>
        </div>
        <dl className={catalogStyles.processSummary}>
          <div><dt>Escopo confirmado</dt><dd>{process.budgets.length} {process.budgets.length === 1 ? "lote confirmado" : "lotes confirmados"}</dd></div>
          <div><dt>Valor total dos lotes</dt><dd>{formatCentsPtBr(process.totalOfficialValueCents)}</dd></div>
        </dl>
      </div>
      <p className={catalogStyles.contextNote}>O total é apenas a soma visual dos lotes. Cada orçamento e cada cenário continuam independentes.</p>
      <div className={catalogStyles.lotGrid}>
        {sortBudgetsByLotAscending(process.budgets).map((budget) => (
          <BudgetCard
            key={budget.id}
            budget={budget}
            scenarios={scenariosByBudget.get(budget.id) ?? []}
            organizationIdForLinks={organizationIdForLinks}
            scenarioEmptyMessage="Nenhum cenário criado para este lote."
          />
        ))}
      </div>
    </section>
  );
}

function DocumentChainProcess({
  process,
  scenariosByBudget,
  organizationIdForLinks,
}: {
  readonly process: ConsolidatedBudgetProcessDto;
  readonly scenariosByBudget: ReadonlyMap<string, ReadonlyArray<ProposalScenarioDto>>;
  readonly organizationIdForLinks: string | null;
}) {
  const contractedChain = resolveContractedDocumentChain(process);

  if (contractedChain) {
    const {
      officialBudget,
      winningProposal,
      differenceCents,
      differenceBasisPoints,
      officialBarBasisPoints,
      contractedBarBasisPoints,
      comparisonKind,
    } = contractedChain;
    const comparisonLabel = comparisonKind === "Reduction"
      ? "Redução contratada"
      : comparisonKind === "Increase" ? "Acréscimo contratado" : "Sem diferença contratual";

    return (
      <section className={`${catalogStyles.process} ${catalogStyles.documentProcess}`} aria-labelledby={`process-${process.procurementCaseId}`}>
        <div className={`${catalogStyles.processHeader} ${catalogStyles.contractedProcessHeader}`}>
          <div>
            <p className={catalogStyles.eyebrow}>Processo de Licitação e Contratação</p>
            <h2 id={`process-${process.procurementCaseId}`}>{process.title}</h2>
            <p className={catalogStyles.processMode}>Contrato vigente · Referência econômica da execução</p>
          </div>
        </div>

        <article className={catalogStyles.contractHero} aria-labelledby={`winning-proposal-${winningProposal.id}`}>
          <div className={catalogStyles.contractHeroTop}>
            <div>
              <p className={catalogStyles.contractHeroEyebrow}>Proposta Vencedora</p>
              <h3 id={`winning-proposal-${winningProposal.id}`}>{formatContractorName(winningProposal.contractorName)}</h3>
              {winningProposal.contractNumber ? <p className={catalogStyles.contractNumber}>Contrato nº {winningProposal.contractNumber}</p> : null}
            </div>
            <span className={catalogStyles.executionBadge}>{contractStatusLabel(winningProposal.contractStatus)}</span>
          </div>
          <div className={catalogStyles.contractHeroBody}>
            <div>
              <span className={catalogStyles.contractValueLabel}>Valor contratado</span>
              <p className={catalogStyles.contractValue}>{formatCentsPtBr(winningProposal.officialValueCents)}</p>
              <div className={catalogStyles.contractMetrics}>
                <span><strong>{winningProposal.serviceItemCount}</strong> itens de serviço</span>
                {winningProposal.lineCount !== null ? <span><strong>{winningProposal.lineCount}</strong> linhas</span> : null}
              </div>
            </div>
            <Link
              href={withOrganization(`/orcamentos/${winningProposal.id}`, organizationIdForLinks)}
              className={catalogStyles.contractPrimaryAction}
            >
              Ver proposta e itens contratados
            </Link>
          </div>
        </article>

        <section className={catalogStyles.contractComparison} aria-labelledby={`comparison-${winningProposal.id}`}>
          <div className={catalogStyles.comparisonHeading}>
            <div>
              <p className={catalogStyles.comparisonEyebrow}>Comparação da contratação</p>
              <h3 id={`comparison-${winningProposal.id}`}>Da referência da licitação ao valor contratado</h3>
            </div>
            <div className={catalogStyles.comparisonResult}>
              <span>{comparisonLabel}</span>
              <strong>{formatCentsPtBr(differenceCents)}</strong>
              <em>{formatPercentageBasisPointsPtBr(differenceBasisPoints)}</em>
            </div>
          </div>

          <div className={catalogStyles.comparisonFlow}>
            <div>
              <span>Orçamento oficial</span>
              <strong>{formatCentsPtBr(officialBudget.officialValueCents)}</strong>
            </div>
            <span className={catalogStyles.comparisonArrow} aria-hidden="true">→</span>
            <div>
              <span>Valor contratado</span>
              <strong>{formatCentsPtBr(winningProposal.officialValueCents)}</strong>
            </div>
          </div>

          <div className={catalogStyles.comparisonBars} aria-label="Barras proporcionais do orçamento oficial e do valor contratado">
            <div className={catalogStyles.comparisonBarRow}>
              <div><span>Orçamento oficial</span><strong>{formatCentsPtBr(officialBudget.officialValueCents)}</strong></div>
              <div className={catalogStyles.comparisonTrack}>
                <span className={`${catalogStyles.comparisonFill} ${catalogStyles.officialComparisonFill}`} style={comparisonBarStyle(officialBarBasisPoints)} />
              </div>
            </div>
            <div className={catalogStyles.comparisonBarRow}>
              <div><span>Valor contratado</span><strong>{formatCentsPtBr(winningProposal.officialValueCents)}</strong></div>
              <div className={catalogStyles.comparisonTrack}>
                <span className={`${catalogStyles.comparisonFill} ${catalogStyles.contractedComparisonFill}`} style={comparisonBarStyle(contractedBarBasisPoints)} />
              </div>
            </div>
          </div>
        </section>

        <article className={catalogStyles.officialReference} aria-labelledby={`official-reference-${officialBudget.id}`}>
          <div>
            <p className={catalogStyles.lotScope}>Referência da licitação</p>
            <h3 id={`official-reference-${officialBudget.id}`}>Orçamento Oficial</h3>
            <p>Documento de origem usado como referência para a contratação.</p>
          </div>
          <div className={catalogStyles.officialReferenceSummary}>
            <strong>{formatCentsPtBr(officialBudget.officialValueCents)}</strong>
            <span>{officialBudget.serviceItemCount} itens de serviço · {officialBudget.lineCount ?? "—"} linhas</span>
          </div>
          <Link
            href={withOrganization(`/orcamentos/${officialBudget.id}`, organizationIdForLinks)}
            className={scenarioStyles.secondary}
          >
            Consultar orçamento oficial
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className={`${catalogStyles.process} ${catalogStyles.documentProcess}`} aria-labelledby={`process-${process.procurementCaseId}`}>
      <div className={catalogStyles.processHeader}>
        <div><p className={catalogStyles.eyebrow}>Processo de Licitação e Contratação</p><h2 id={`process-${process.procurementCaseId}`}>{process.title}</h2></div>
      </div>
      <div className={catalogStyles.documentChain}>
        {process.budgets.map((budget, index) => (
          <div className={catalogStyles.documentStep} key={budget.id}>
            {index > 0 ? <div className={catalogStyles.documentConnector} aria-label={budget.documentKind === "WinningProposal" ? "Proposta vencedora" : "Versão derivada"}><span>↓</span><strong>{budget.documentKind === "WinningProposal" ? "Proposta vencedora" : "Versão derivada"}</strong></div> : null}
            <BudgetCard
              budget={budget}
              scenarios={scenariosByBudget.get(budget.id) ?? []}
              organizationIdForLinks={organizationIdForLinks}
              scenarioEmptyMessage="Nenhum cenário criado para este orçamento oficial."
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function BudgetCard({
  budget,
  scenarios,
  organizationIdForLinks,
  scenarioEmptyMessage,
}: {
  readonly budget: ConsolidatedBudgetSummaryDto;
  readonly scenarios: ReadonlyArray<ProposalScenarioDto>;
  readonly organizationIdForLinks: string | null;
  readonly scenarioEmptyMessage: string;
}) {
  const isLot = budget.scopeKind === "Lot";
  const isWinningProposal = budget.documentKind === "WinningProposal";
  const isDerived = budget.documentKind === "DerivedVersion";
  const permitsScenarios = budget.scenarioCreationAllowed;
  const presentation = lotPresentation(budget.procurementLotTitle, budget.scopeKind);
  const title = isLot ? presentation.title : isWinningProposal ? "Proposta Vencedora" : isDerived ? "Versão Derivada" : "Orçamento Oficial";
  const scopeLabel = isLot ? "Lote independente" : isWinningProposal ? "Proposta contratada" : isDerived ? "Documento derivado" : "Documento de origem";

  return (
    <article className={`${catalogStyles.lotCard} ${!isLot ? catalogStyles.documentCard : ""}`}>
      <div className={catalogStyles.lotHeader}>
        <div>
          <p className={catalogStyles.lotScope}>{scopeLabel}</p>
          <h3>{title}</h3>
          {isLot && presentation.detail ? <p>{presentation.detail}</p> : null}
          {!isLot && budget.contractorName ? <p className={catalogStyles.contractorName}>{budget.contractorName}</p> : null}
        </div>
        <span className={catalogStyles.confirmed}>{isWinningProposal ? "Confirmada" : "Confirmado"}</span>
      </div>
      <p className={catalogStyles.value}>{formatCentsPtBr(budget.officialValueCents)}</p>
      <div className={catalogStyles.metrics}>
        <span><strong>{budget.serviceItemCount}</strong> itens de serviço</span>
        {budget.lineCount !== null ? <span><strong>{budget.lineCount}</strong> linhas</span> : null}
        {isLot ? <span>Revisão {budget.revision}</span> : null}
      </div>
      <div className={catalogStyles.cardActions}>
        <Link href={withOrganization(`/orcamentos/${budget.id}`, organizationIdForLinks)} className={scenarioStyles.secondary}>
          {isWinningProposal ? "Ver proposta e itens contratados" : "Ver orçamento"}
        </Link>
        {permitsScenarios ? <Link href={withOrganization(`/orcamentos/cenarios/novo?orcamento=${budget.id}`, organizationIdForLinks)} className={scenarioStyles.primary}>Criar cenário</Link> : null}
      </div>
      {permitsScenarios ? <ScenarioList budgetId={budget.id} scenarios={scenarios} organizationIdForLinks={organizationIdForLinks} emptyMessage={scenarioEmptyMessage} /> : null}
    </article>
  );
}

function ScenarioList({
  budgetId,
  scenarios,
  organizationIdForLinks,
  emptyMessage,
}: {
  readonly budgetId: string;
  readonly scenarios: ReadonlyArray<ProposalScenarioDto>;
  readonly organizationIdForLinks: string | null;
  readonly emptyMessage: string;
}) {
  return (
    <section className={catalogStyles.scenarios} aria-labelledby={`scenarios-${budgetId}`}>
      <div className={catalogStyles.scenarioHeading}>
        <h4 id={`scenarios-${budgetId}`}>Cenários de Proposta</h4>
        {scenarios.length > 1 ? <Link href={withOrganization(`/orcamentos/cenarios/comparar?orcamento=${budgetId}`, organizationIdForLinks)} className={catalogStyles.textLink}>Comparar</Link> : null}
      </div>
      {scenarios.length === 0 ? <p>{emptyMessage}</p> : <ul>{scenarios.map((scenario) => (
        <li key={scenario.id}>
          <div><strong>{scenario.name}</strong><span>{formatCentsPtBr(scenario.targetValueCents)} · {formatBasisPointsPtBr(scenario.differenceBasisPoints, scenario.comparisonKind)}</span></div>
          <div><Link href={withOrganization(`/orcamentos/cenarios/${scenario.id}`, organizationIdForLinks)}>Abrir</Link><Link href={withOrganization(`/orcamentos/cenarios/novo?duplicar=${scenario.id}`, organizationIdForLinks)}>Duplicar</Link></div>
        </li>
      ))}</ul>}
    </section>
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

function formatContractorName(name: string | null): string {
  if (!name?.trim()) return "Contratada";
  return name.trim().replace(/^CONSÓRCIO\b/u, "Consórcio");
}

function comparisonBarStyle(basisPoints: number): CSSProperties {
  const width = Math.max(0, Math.min(10_000, basisPoints)) / 100;
  return { "--comparison-width": `${width}%` } as CSSProperties;
}
