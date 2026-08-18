"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { BudgetPageHeader } from "@/components/budget/budget-page-header";
import styles from "@/components/budget/proposal-scenarios.module.css";
import {
  formatCentsPtBr,
  inputValueFromCents,
  parseBrlToCents,
  type ConsolidatedBudgetSummaryDto,
  type ProposalScenarioDto,
} from "@/lib/proposal-scenarios";

export default function NewProposalScenarioPage() {
  return <Suspense fallback={<div className={styles.loading}>Preparando criação…</div>}><NewProposalScenarioContent /></Suspense>;
}

function NewProposalScenarioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedBudgetId = searchParams.get("orcamento");
  const duplicateId = searchParams.get("duplicar");
  const [budget, setBudget] = useState<ConsolidatedBudgetSummaryDto | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/orcamentos/consolidado/resumo", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar o orçamento oficial.");
        const payload = (await response.json()) as { budget: ConsolidatedBudgetSummaryDto | null };
        return payload.budget;
      })
      .then((summary) => setBudget(summary))
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") {
          setError(cause.message);
          setBudget(null);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!duplicateId) return;
    const controller = new AbortController();
    fetch(`/api/orcamentos/cenarios/${duplicateId}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível abrir o cenário de referência.");
        return (await response.json()) as { scenario: ProposalScenarioDto };
      })
      .then(({ scenario }) => {
        setName(`Cópia de ${scenario.name}`.slice(0, 120));
        setTargetValue(inputValueFromCents(scenario.targetValueCents));
      })
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setError(cause.message);
      });
    return () => controller.abort();
  }, [duplicateId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!budget) return;
    const targetValueCents = parseBrlToCents(targetValue);
    if (targetValueCents === null) {
      setError("Informe um valor válido em reais, com no máximo dois centavos.");
      return;
    }
    if (requestedBudgetId && requestedBudgetId !== budget.id) {
      setError("O orçamento selecionado não é mais o orçamento oficial consolidado disponível.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/orcamentos/cenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetId: budget.id, name, targetValueCents }),
      });
      const payload = (await response.json()) as { scenario?: ProposalScenarioDto; message?: string };
      if (!response.ok || !payload.scenario) throw new Error(payload.message ?? "Não foi possível criar este cenário.");
      router.push(`/orcamentos/cenarios/${payload.scenario.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar este cenário.");
      setSaving(false);
    }
  }

  return (
    <>
      <BudgetPageHeader isDemonstration={false} />
      <section className="section-grid">
        <div className={styles.page}>
          <div className={styles.sectionTitle}>
            <div>
              <p className={styles.eyebrow}>Cenários de Proposta</p>
              <h2>Criar cenário</h2>
              <p>Registre um valor de proposta sem alterar o orçamento oficial.</p>
            </div>
            <Link href="/orcamentos" className={styles.secondary}>Voltar ao orçamento</Link>
          </div>

          {budget === undefined ? <div className={styles.loading}>Carregando orçamento oficial…</div> : null}
          {budget === null ? <div className={styles.notice}><strong>Orçamento indisponível</strong>É necessário um orçamento consolidado para criar cenários.</div> : null}
          {budget ? (
            <div className={styles.hero}>
              <div className={styles.summary}>
                <div className={styles.summaryItem}><span>Orçamento Oficial</span><strong>{formatCentsPtBr(budget.officialValueCents)}</strong></div>
                <div className={styles.summaryItem}><span>Estado</span><strong>Revisado e consolidado</strong></div>
                <div className={styles.summaryItem}><span>Regra desta criação</span><strong>Valor-alvo em centavos exatos</strong></div>
              </div>
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
                  <Link href="/orcamentos" className={styles.secondary}>Cancelar</Link>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
