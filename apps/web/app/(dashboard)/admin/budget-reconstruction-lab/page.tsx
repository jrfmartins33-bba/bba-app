"use client";

import { useMemo, useState } from "react";
import { useBbaStore } from "@bba/lib";
import { Card, StatusBadge } from "@bba/ui";
import {
  buildBudgetReconstructionLabViewModel,
  validateBudgetReconstructionLabInput,
} from "@/lib/budget/budget-reconstruction-lab-view-model";
import type { BudgetReconstructionLabViewModel } from "@/lib/budget/budget-reconstruction-lab-view-model";
import {
  INITIAL_RECONSTRUCTION_FILTERS,
  ReconstructionFilters,
} from "@/components/budget-reconstruction-lab/reconstruction-filters";
import type { ReconstructionFiltersState } from "@/components/budget-reconstruction-lab/reconstruction-filters";
import { ReconstructionSummary } from "@/components/budget-reconstruction-lab/reconstruction-summary";
import { ReconstructionTable } from "@/components/budget-reconstruction-lab/reconstruction-table";
import { ReconstructionRecordDetail } from "@/components/budget-reconstruction-lab/reconstruction-record-detail";
import { ReconstructionDiagnostics } from "@/components/budget-reconstruction-lab/reconstruction-diagnostics";

// Laboratório de Reconstrução Orçamentária (Epic 21) — ferramenta interna
// para VISUALIZAR e AUDITAR, dentro do próprio BBA App, um resultado
// canônico já produzido pelo Motor Determinístico de Reconstrução
// Orçamentária (packages/bdos-core/src/domain/budget-table-reconstruction/,
// PR #83, congelada). Esta página NÃO executa o motor: recebe um arquivo
// JSON já gerado pelo executor (run-budget-table-reconstruction-v1.ts),
// valida sua forma superficialmente e projeta os campos já existentes
// para exibição -- nenhum valor econômico é recalculado (quantity/
// unitCost/bdiRate/unitPrice/totalPrice são sempre o `rawText` que o
// motor já produziu). O arquivo é processado inteiramente no navegador:
// sem upload, sem API nova, sem persistência no Supabase. Mesmo raciocínio
// do Advisor Lab e do Measurement Import Lab (ferramenta interna, não a UI
// final do produto) -- não substitui nem altera /orcamentos.

export default function BudgetReconstructionLabPage() {
  const profile = useBbaStore((state) => state.profile);
  const isAdmin = profile.role === "bba_admin";

  const [fileName, setFileName] = useState<string | null>(null);
  const [viewModel, setViewModel] = useState<BudgetReconstructionLabViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<ReconstructionFiltersState>(INITIAL_RECONSTRUCTION_FILTERS);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const handleFileSelected = (file: File) => {
    setLoading(true);
    setError(null);
    setViewModel(null);
    setSelectedRecordId(null);
    setFilters(INITIAL_RECONSTRUCTION_FILTERS);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : "";
        const parsed: unknown = JSON.parse(text);
        const outcome = validateBudgetReconstructionLabInput(parsed);
        if (!outcome.valid) {
          setError(outcome.message);
          setLoading(false);
          return;
        }
        setViewModel(buildBudgetReconstructionLabViewModel(outcome.result));
        setFileName(file.name);
      } catch {
        setError("Este arquivo não parece ser um resultado válido do Motor Determinístico.");
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Não foi possível ler o arquivo selecionado.");
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const availablePages = useMemo(() => {
    if (viewModel === null) return [];
    return [...new Set(viewModel.records.map((record) => record.pageNumber))].sort((left, right) => left - right);
  }, [viewModel]);

  const filteredRecords = useMemo(() => {
    if (viewModel === null) return [];
    const search = filters.search.trim().toLowerCase();
    return viewModel.records.filter((record) => {
      if (!filters.includeUnclassified && record.kind === "unclassified") return false;
      if (filters.status !== "all" && record.status !== filters.status) return false;
      if (filters.kind !== "all" && record.kind !== filters.kind) return false;
      if (filters.page !== "all" && record.pageNumber !== filters.page) return false;
      if (search.length > 0) {
        const haystack = `${record.itemCode ?? ""} ${record.description ?? ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [viewModel, filters]);

  const selectedRecord =
    viewModel !== null && selectedRecordId !== null
      ? viewModel.records.find((record) => record.recordId === selectedRecordId) ?? null
      : null;

  // profile.role defaults to "client" (both the signed-out and demo store
  // states) until a real bba_admin session hydrates, so this check fails
  // closed by default -- the Lab body below never renders on the same pass
  // that could show it to a non-admin. No new API route: this is the same
  // client-only gate shape the rest of this Studio-less admin area uses
  // (BbaDashboardShell only authenticates the session, it doesn't gate by
  // role), so route-level enforcement stays local to this page.
  if (!isAdmin) {
    return (
      <section className="page-header">
        <div>
          <h1>Laboratório de Reconstrução Orçamentária</h1>
          <p>Acesso restrito ao Admin BBA.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Laboratório de Reconstrução Orçamentária</h1>
          <p>
            Ferramenta interna para visualizar e auditar resultados produzidos pelo Motor Determinístico de
            Reconstrução Orçamentária.
          </p>
        </div>
        <StatusBadge status="pending">Somente diagnóstico</StatusBadge>
      </section>

      <section className="section-grid">
        <Card className="span-12" title="Carregar resultado do motor">
          <input
            accept=".json,application/json"
            type="file"
            disabled={loading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFileSelected(file);
              event.target.value = "";
            }}
          />
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
            Selecione um arquivo JSON já gerado pelo executor do motor. O arquivo é lido inteiramente no navegador —
            nada é enviado a um servidor ou persistido.
          </p>
          {loading ? <p style={{ marginTop: "8px" }}>Carregando...</p> : null}
          {error ? (
            <div className="form-error fiscal-alert" role="alert" style={{ marginTop: "12px" }}>
              {error}
            </div>
          ) : null}
        </Card>
      </section>

      {viewModel ? (
        <>
          <section className="section-grid">
            <ReconstructionSummary summary={viewModel.summary} fileName={fileName ?? "—"} />
          </section>

          {selectedRecord ? (
            <section className="section-grid">
              <ReconstructionRecordDetail record={selectedRecord} onClose={() => setSelectedRecordId(null)} />
            </section>
          ) : null}

          <section className="section-grid">
            <Card className="span-12" title={`Planilha reconstruída (${filteredRecords.length})`}>
              <ReconstructionFilters
                filters={filters}
                onChange={setFilters}
                availablePages={availablePages}
                unclassifiedCount={viewModel.summary.unclassifiedCount}
              />
              <ReconstructionTable records={filteredRecords} onSelectRecord={setSelectedRecordId} />
            </Card>
          </section>

          <section className="section-grid">
            <ReconstructionDiagnostics viewModel={viewModel} />
          </section>
        </>
      ) : null}
    </>
  );
}
