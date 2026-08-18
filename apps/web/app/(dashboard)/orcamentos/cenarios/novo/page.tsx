"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import styles from "@/components/budget/proposal-scenarios.module.css";
import {
  lotPresentation,
  resolveScenarioSourceBudget,
  type ConsolidatedBudgetCatalogDto,
} from "@/lib/budget/consolidated-budget-catalog";
import {
  formatCentsPtBr,
  inputValueFromCents,
  parseBrlToCents,
  type ProposalScenarioDto,
} from "@/lib/proposal-scenarios";
import type { BudgetOrganizationOption } from "@/lib/budget/budget-organization-policy";

interface CatalogPayload extends ConsolidatedBudgetCatalogDto {
  readonly organization: BudgetOrganizationOption | null;
}

export default function NewProposalScenarioPage() {
  return <Suspense fallback={<div className={styles.loading}>Preparando criação…</div>}><NewProposalScenarioContent /></Suspense>;
}

function NewProposalScenarioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedBudgetId = searchParams.get("orcamento");
  const duplicateId = searchParams.get("duplicar");
  const requestedOrganizationId = searchParams.get("empresa");
  const [catalog, setCatalog] = useState<ConsolidatedBudgetCatalogDto | null | undefined>(undefined);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(requestedOrganizationId);
  const [duplicateScenario, setDuplicateScenario] = useState<ProposalScenarioDto | null | undefined>(() => duplicateId ? undefined : null);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(withOrganization("/api/orcamentos/consolidado/resumo", requestedOrganizationId), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os orçamentos oficiais.");
        return (await response.json()) as CatalogPayload;
      })
      .then((payload) => {
        setCatalog({ budgets: payload.budgets, processes: payload.processes });
        setActiveOrganizationId(payload.organization?.id ?? requestedOrganizationId);
      })
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") {
          setError(cause.message);
          setCatalog(null);
        }
      });
    return () => controller.abort();
  }, [requestedOrganizationId]);

  useEffect(() => {
    if (!duplicateId) return;
    const controller = new AbortController();
    fetch(withOrganization(`/api/orcamentos/cenarios/${encodeURIComponent(duplicateId)}`, requestedOrganizationId), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível abrir o cenário de referência.");
        return (await response.json()) as { scenario: ProposalScenarioDto; organization?: BudgetOrganizationOption };
      })
      .then(({ scenario, organization }) => {
        if (organization) setActiveOrganizationId(organization.id);
        setDuplicateScenario(scenario);
        setName(`Cópia de ${scenario.name}`.slice(0, 120));
        setTargetValue(inputValueFromCents(scenario.targetValueCents));
      })
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") {
          setError(cause.message);
          setDuplicateScenario(null);
        }
      });
    return () => controller.abort();
  }, [duplicateId, requestedOrganizationId]);

  const requestedBudget = catalog?.budgets.find((budget) => budget.id === requestedBudgetId) ?? null;
  const duplicateBudget = catalog?.budgets.find((budget) => budget.id === duplicateScenario?.sourceBudgetId) ?? null;
  const budget = catalog ? resolveScenarioSourceBudget(catalog.budgets, {
    requestedBudgetId,
    selectedBudgetId,
    duplicateSourceBudgetId: duplicateId ? duplicateScenario?.sourceBudgetId ?? null : null,
  }) : null;
  const needsChoice = Boolean(catalog && catalog.budgets.length > 1 && !budget && !duplicateId);
  const invalidRequestedBudget = Boolean(catalog && requestedBudgetId && !requestedBudget && !selectedBudgetId && !duplicateId);
  const missingDuplicateSource = Boolean(catalog && duplicateScenario && !duplicateBudget);

  const budgetsByProcess = catalog?.processes ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!budget) return;
    const targetValueCents = parseBrlToCents(targetValue);
    if (targetValueCents === null) {
      setError("Informe um valor válido em reais, com no máximo dois centavos.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(withOrganization("/api/orcamentos/cenarios", activeOrganizationId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetId: budget.id, name, targetValueCents }),
      });
      const payload = (await response.json()) as { scenario?: ProposalScenarioDto; message?: string };
      if (!response.ok || !payload.scenario) throw new Error(payload.message ?? "Não foi possível criar este cenário.");
      router.push(withOrganization(`/orcamentos/cenarios/${payload.scenario.id}`, activeOrganizationId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar este cenário.");
      setSaving(false);
    }
  }

  const presentation = budget ? lotPresentation(budget.procurementLotTitle, budget.scopeKind) : null;

  return (
    <>
      <BudgetPageHeader isDemonstration={false} />
      <section className="section-grid">
        <div className={styles.page}>
          <div className={styles.sectionTitle}>
            <div>
              <p className={styles.eyebrow}>Cenários de Proposta</p>
              <h2>{needsChoice ? "Escolha o lote da proposta" : duplicateId ? "Duplicar cenário" : "Criar cenário"}</h2>
              <p>Registre um valor de proposta sem alterar o orçamento oficial.</p>
            </div>
            <Link href={withOrganization("/orcamentos", activeOrganizationId)} className={styles.secondary}>Voltar para Orçamentos</Link>
          </div>

          {catalog === undefined || duplicateScenario === undefined ? <div className={styles.loading}>Carregando orçamentos oficiais…</div> : null}
          {catalog === null || catalog?.budgets.length === 0 ? <div className={styles.notice}><strong>Orçamento indisponível</strong>É necessário um orçamento confirmado para criar cenários.</div> : null}
          {invalidRequestedBudget ? <div className={styles.notice} role="alert"><strong>Orçamento não encontrado</strong>A origem informada não está disponível para sua organização. Escolha explicitamente outro lote.</div> : null}
          {missingDuplicateSource ? <div className={styles.notice} role="alert"><strong>Origem indisponível</strong>O cenário não pode ser duplicado porque seu orçamento de origem não está disponível.</div> : null}

          {catalog && catalog.budgets.length > 1 && !duplicateId ? (
            <fieldset className={styles.budgetSelector}>
              <legend>Escolha o lote da proposta</legend>
              {budgetsByProcess.map((process) => (
                <div className={styles.budgetGroup} key={process.procurementCaseId}>
                  <p>{process.title}</p>
                  <div className={styles.selector}>
                    {process.budgets.map((option) => {
                      const optionPresentation = lotPresentation(option.procurementLotTitle, option.scopeKind);
                      return (
                        <label className={styles.choice} key={option.id}>
                          <input
                            type="radio"
                            name="source-budget"
                            value={option.id}
                            checked={budget?.id === option.id}
                            onChange={() => { setSelectedBudgetId(option.id); setError(null); }}
                          />
                          <span><strong>{optionPresentation.title}</strong><span>{optionPresentation.detail ? `${optionPresentation.detail} · ` : ""}{formatCentsPtBr(option.officialValueCents)}</span></span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </fieldset>
          ) : null}

          {budget && !missingDuplicateSource ? (
            <div className={styles.hero}>
              <p className={styles.eyebrow}>Base do cenário</p>
              <h2>Orçamento Oficial — {presentation?.title}</h2>
              {presentation?.detail ? <p className={styles.base}>{presentation.detail}</p> : null}
              <div className={styles.summary}>
                <div className={styles.summaryItem}><span>Orçamento Oficial</span><strong>{formatCentsPtBr(budget.officialValueCents)}</strong></div>
                <div className={styles.summaryItem}><span>Estado</span><strong>Revisado e confirmado</strong></div>
                <div className={styles.summaryItem}><span>Origem</span><strong>{presentation?.title}</strong></div>
              </div>
              {duplicateId ? <div className={styles.notice}><strong>Origem preservada</strong>A cópia permanece vinculada ao mesmo lote do cenário original.</div> : null}
              <form className={styles.form} onSubmit={submit} style={{ marginTop: "1.5rem" }}>
                <div className={styles.field}>
                  <label htmlFor="scenario-name">Nome do cenário</label>
                  <input id="scenario-name" className={styles.input} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required placeholder="Ex.: Cenário A — Competitivo" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="target-value">Valor da proposta</label>
                  <input id="target-value" className={`${styles.input} ${styles.moneyInput}`} value={targetValue} onChange={(event) => setTargetValue(event.target.value)} onBlur={() => { const cents = parseBrlToCents(targetValue); if (cents !== null) setTargetValue(inputValueFromCents(cents)); }} inputMode="decimal" required placeholder="12.200.000,00" aria-describedby="target-help" />
                  <small id="target-help">O valor informado é a autoridade do cenário. O percentual será calculado depois, sem distribuir diferenças entre itens.</small>
                </div>
                {error ? <p className={styles.error} role="alert">{error}</p> : null}
                <div className={styles.actions}>
                  <button className={styles.primary} type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar cenário"}</button>
                  <Link href={withOrganization("/orcamentos", activeOrganizationId)} className={styles.secondary}>Cancelar</Link>
                </div>
              </form>
            </div>
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
