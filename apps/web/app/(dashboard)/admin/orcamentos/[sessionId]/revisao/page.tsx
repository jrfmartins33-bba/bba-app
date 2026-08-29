"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Button } from "@bba/ui";
import { formatBudgetMoneyPtBr, formatBudgetNumberPtBr, formatBudgetPercentPtBr } from "@/lib/bdos/format-budget-number";
import { toHumanReviewActionError } from "@/lib/bdos/to-human-review-error";
import { lotPresentation } from "@/lib/budget/consolidated-budget-catalog";
import { ReviewActionDialog } from "./ReviewActionDialog";
import { getReviewPaginationState } from "./review-pagination";

// Workspace Operacional da Revisão do Orçamento Oficial (Epic 21.5A / Sprint 21.5C.2B Premium)

interface RowFields {
  readonly itemCode: string | null;
  readonly description: string | null;
  readonly sourceCode: string | null;
  readonly sourceFonte: string | null;
  readonly sourceTipo: string | null;
  readonly unit: string | null;
  readonly quantityText: string | null;
  readonly unitCostWithoutBdiText: string | null;
  readonly bdiPercentText: string | null;
  readonly unitPriceWithBdiText: string | null;
  readonly totalPriceText: string | null;
  readonly colFgvDnit: string | null;
  readonly documentalGroupTotalText: string | null;
}

interface ReconciliationDecision {
  readonly status: "AcceptedAsDocumented";
  readonly actor: string;
  readonly justification: string;
  readonly decidedAt: string;
}

interface ReviewRow {
  readonly id: string;
  readonly kind: "Group" | "Subgroup" | "ServiceItem";
  readonly lotReference: string;
  readonly parentRowId: string | null;
  readonly position: number;
  readonly state: "Pendente" | "Confirmado" | "Corrigido" | "NaoPertenceAoOrcamento" | "InseridoManualmente";
  readonly extracted: RowFields | null;
  readonly revised: RowFields;
  readonly page: number | null;
  readonly evidenceText: string | null;
  readonly justification: string | null;
  readonly insertedManually: boolean;
  readonly reconciliationDecision: ReconciliationDecision | null;
}

interface ReviewSession {
  readonly id: string;
  readonly status: "InProgress" | "Consolidated";
  readonly rows: ReadonlyArray<ReviewRow>;
}

interface ReconciliationItem {
  readonly rowId: string;
  readonly status: string;
  readonly differenceCents: number | null;
  readonly derivedTotalCents?: number | null;
  readonly documentedTotalCents?: number | null;
}

interface Reconciliation {
  readonly serviceItems: ReadonlyArray<ReconciliationItem>;
  readonly groups: ReadonlyArray<ReconciliationItem>;
  readonly readiness: { ready: boolean; blockers: ReadonlyArray<string>; pendingRowCount: number; divergentReconciliationCount: number };
}

const STATE_LABELS: Record<ReviewRow["state"], string> = {
  Pendente: "Pendente",
  Confirmado: "Confirmado",
  Corrigido: "Corrigido",
  NaoPertenceAoOrcamento: "Não pertence ao orçamento",
  InseridoManualmente: "Inserido manualmente",
};

interface StateBadgeStyle {
  readonly bg: string;
  readonly border: string;
  readonly text: string;
  readonly dot: string;
}

const STATE_BADGE_STYLES: Record<ReviewRow["state"], StateBadgeStyle> = {
  Pendente: {
    bg: "rgba(245, 158, 11, 0.15)",
    border: "1px solid #f59e0b",
    text: "#fcd34d",
    dot: "#fbbf24",
  },
  Confirmado: {
    bg: "rgba(16, 185, 129, 0.15)",
    border: "1px solid #10b981",
    text: "#6ee7b7",
    dot: "#34d399",
  },
  Corrigido: {
    bg: "rgba(59, 130, 246, 0.15)",
    border: "1px solid #3b82f6",
    text: "#93c5fd",
    dot: "#60a5fa",
  },
  NaoPertenceAoOrcamento: {
    bg: "rgba(239, 68, 68, 0.15)",
    border: "1px solid #ef4444",
    text: "#fca5a5",
    dot: "#f87171",
  },
  InseridoManualmente: {
    bg: "rgba(168, 85, 247, 0.15)",
    border: "1px solid #a855f7",
    text: "#d8b4fe",
    dot: "#c084fc",
  },
};

function StateBadge({ state }: { state: ReviewRow["state"] }) {
  const style = STATE_BADGE_STYLES[state];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.2rem 0.55rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        backgroundColor: style.bg,
        border: style.border,
        color: style.text,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: style.dot }} />
      {STATE_LABELS[state]}
    </span>
  );
}

function ReconciliationBadge({
  item,
  decision,
  onOpenDivergenceDecision,
}: {
  item: ReconciliationItem | undefined;
  decision: ReconciliationDecision | null;
  onOpenDivergenceDecision?: () => void;
}) {
  if (!item || item.status === "insufficient_data" || item.status === "not_applicable") {
    return null;
  }

  if (decision !== null) {
    return (
      <span
        title={`Decisão registrada por ${decision.actor}: "${decision.justification}"`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          padding: "0.15rem 0.45rem",
          borderRadius: "4px",
          fontSize: "0.7rem",
          fontWeight: 600,
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          color: "#34d399",
          whiteSpace: "nowrap",
        }}
      >
        ✓ Diferença aceita
      </span>
    );
  }

  if (item.status === "diverges") {
    const diffAbs = Math.abs(item.differenceCents ?? 0);
    const formattedDiff = formatBudgetMoneyPtBr(diffAbs / 100);
    const label = `Diferença documental · R$ ${formattedDiff}`;

    return (
      <span
        title="Diferença entre o total derivado da fórmula oficial e o valor publicado no documento. Clique para decidir."
        onClick={onOpenDivergenceDecision}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          padding: "0.15rem 0.45rem",
          borderRadius: "4px",
          fontSize: "0.7rem",
          fontWeight: 600,
          backgroundColor: "rgba(245, 158, 11, 0.12)",
          border: "1px solid rgba(245, 158, 11, 0.4)",
          color: "#fbbf24",
          whiteSpace: "nowrap",
          cursor: onOpenDivergenceDecision ? "pointer" : "default",
        }}
      >
        {label}
      </span>
    );
  }

  if (item.status === "matches" || item.status === "source_calculation_unverified") {
    return null;
  }

  return null;
}

const PAGE_SIZE = 50;

interface ReviewContext {
  readonly companyName: string;
  readonly procurementCaseTitle: string;
  readonly procurementCaseReference: string | null;
  readonly procurementLotTitle: string;
  readonly procurementLotReference: string | null;
  readonly originalFileName: string;
  readonly officialBudgetTotalText: string;
}

export type DialogType =
  | "bulkConfirm"
  | "singleConfirm"
  | "divergenceDecision"
  | "singleCorrectRow"
  | "singleAcceptDivergence"
  | "bulkAcceptDivergences"
  | "exclude"
  | "restore"
  | "consolidate";

interface DialogState {
  readonly isOpen: boolean;
  readonly type: DialogType;
  readonly targetRowId?: string;
  readonly title: string;
  readonly description: string;
  readonly requireJustification?: boolean;
  readonly justificationPlaceholder?: string;
  readonly isDestructive?: boolean;
  readonly confirmLabel?: string;
}

interface ToastState {
  readonly type: "success" | "error";
  readonly message: string;
}

export default function OrcamentoRevisaoPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<ReviewSession | null>(null);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [reviewContext, setReviewContext] = useState<ReviewContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [filterState, setFilterState] = useState<string>("all");
  const [filterLote, setFilterLote] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    type: "singleConfirm",
    title: "",
    description: "",
  });

  const viewportRef = useRef<HTMLDivElement | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orcamentos/revisao/${sessionId}`);
      if (!res.ok) {
        setError(res.status === 403 ? "Acesso restrito ao Admin BBA." : "Sessão de Revisão não encontrada.");
        setSession(null);
        setReviewContext(null);
        return;
      }
      const data = await res.json();
      setSession(data.session);
      setReconciliation(data.reconciliation);
      setReviewContext(data.context ?? null);
    } catch {
      setError("Não foi possível carregar a Sessão de Revisão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionId) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const reconciliationByRowId = useMemo(() => {
    const map = new Map<string, ReconciliationItem>();
    reconciliation?.serviceItems.forEach((r) => map.set(r.rowId, r));
    reconciliation?.groups.forEach((r) => map.set(r.rowId, r));
    return map;
  }, [reconciliation]);

  const lotes = useMemo(() => {
    if (!session) return [];
    return Array.from(new Set(session.rows.map((row) => row.lotReference))).sort();
  }, [session]);

  const filteredRows = useMemo(() => {
    if (!session) return [];
    const term = search.trim().toLowerCase();
    return session.rows.filter((row) => {
      if (filterState !== "all") {
        if (filterState === "divergent") {
          const rec = reconciliationByRowId.get(row.id);
          if (!rec || rec.status !== "diverges") return false;
        } else if (row.state !== filterState) {
          return false;
        }
      }
      if (filterLote !== "all" && row.lotReference !== filterLote) return false;
      if (term.length > 0) {
        const haystack = `${row.revised.itemCode ?? ""} ${row.revised.description ?? ""} ${row.revised.sourceCode ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [session, filterState, filterLote, search, reconciliationByRowId]);

  // Eligible rows for bulk selection in current filter scope
  const eligibleFilteredRows = useMemo(() => {
    return filteredRows.filter((row) => {
      const rec = reconciliationByRowId.get(row.id);
      const isPending = row.state === "Pendente";
      const isDivergent = rec?.status === "diverges" && row.reconciliationDecision === null;
      return isPending || isDivergent;
    });
  }, [filteredRows, reconciliationByRowId]);

  const allEligibleSelected = useMemo(() => {
    if (eligibleFilteredRows.length === 0) return false;
    return eligibleFilteredRows.every((r) => selected.has(r.id));
  }, [eligibleFilteredRows, selected]);

  const someEligibleSelected = useMemo(() => {
    if (eligibleFilteredRows.length === 0) return false;
    return eligibleFilteredRows.some((r) => selected.has(r.id));
  }, [eligibleFilteredRows, selected]);

  // Derived counts for actionable buttons
  const pendingSelectedCount = useMemo(() => {
    if (!session) return 0;
    return Array.from(selected).filter((id) => session.rows.find((r) => r.id === id)?.state === "Pendente").length;
  }, [session, selected]);

  const divergentSelectedCount = useMemo(() => {
    if (!session) return 0;
    return Array.from(selected).filter((id) => {
      const r = session.rows.find((candidate) => candidate.id === id);
      const rec = reconciliationByRowId.get(id);
      return r !== undefined && r.reconciliationDecision === null && rec?.status === "diverges";
    }).length;
  }, [session, selected, reconciliationByRowId]);

  function handleSelectAllFilteredToggle() {
    if (allEligibleSelected) {
      setSelected(new Set());
    } else {
      const next = new Set(selected);
      eligibleFilteredRows.forEach((r) => next.add(r.id));
      setSelected(next);
    }
  }

  function handleClearSelection() {
    setSelected(new Set());
  }

  function handleFilterStateChange(newState: string) {
    setFilterState(newState);
    setPage(0);
    setSelected(new Set());
  }

  function handleFilterLoteChange(newLote: string) {
    setFilterLote(newLote);
    setPage(0);
    setSelected(new Set());
  }

  function handleSearchChange(newSearch: string) {
    setSearch(newSearch);
    setPage(0);
    setSelected(new Set());
  }

  function changePage(newPage: number) {
    setPage(newPage);
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
  }

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagination = getReviewPaginationState(page, totalPages);
  const pageRows = filteredRows.slice(pagination.pageIndex * PAGE_SIZE, (pagination.pageIndex + 1) * PAGE_SIZE);

  async function callAction(body: Record<string, unknown>, successMessage?: string) {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/orcamentos/revisao/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const humanError = toHumanReviewActionError(payload, "Não foi possível concluir a ação solicitada.");
        setToast({ type: "error", message: humanError });
        return false;
      }
      await reload();
      if (successMessage) {
        setToast({ type: "success", message: successMessage });
        setTimeout(() => setToast(null), 5000);
      }
      return true;
    } catch {
      setToast({ type: "error", message: "Ocorreu um erro de comunicação com o servidor." });
      return false;
    } finally {
      setBusy(false);
      setDialog((prev) => ({ ...prev, isOpen: false }));
    }
  }

  function openConfirmRowDialog(rowId: string) {
    const row = session?.rows.find((r) => r.id === rowId);
    const rec = reconciliationByRowId.get(rowId);
    if (rec?.status === "diverges" && row?.reconciliationDecision === null) {
      openDivergenceDecisionDialog(rowId);
      return;
    }
    setDialog({
      isOpen: true,
      type: "singleConfirm",
      targetRowId: rowId,
      title: "Confirmar revisão do item",
      description: "Confirma que os valores revisados do item correspondem ao documento oficial?",
    });
  }

  function openBulkConfirmDialog() {
    if (pendingSelectedCount === 0) return;
    setDialog({
      isOpen: true,
      type: "bulkConfirm",
      title: `Confirmar ${pendingSelectedCount} item(ns) em lote`,
      description: `Serão confirmadas ${pendingSelectedCount} linha(s) com estado 'Pendente'. Esta ação registra sua conferência nos itens selecionados.`,
      confirmLabel: `Confirmar ${pendingSelectedCount} item(ns)`,
    });
  }

  function openDivergenceDecisionDialog(rowId: string) {
    setDialog({
      isOpen: true,
      type: "divergenceDecision",
      targetRowId: rowId,
      title: "Diferença documental",
      description: "Escolha como deseja tratar esta diferença.",
    });
  }

  function openCorrectRowDialog(rowId: string) {
    setDialog({
      isOpen: true,
      type: "singleCorrectRow",
      targetRowId: rowId,
      title: "Corrigir valor da linha",
      description: "Corrigir valores revisados do item.",
    });
  }

  function openAcceptDivergenceDialog(rowId: string) {
    setDialog({
      isOpen: true,
      type: "singleAcceptDivergence",
      targetRowId: rowId,
      title: "Aceitar valor publicado",
      description: "Você está confirmando que o valor publicado no documento oficial deve ser mantido mesmo com esta diferença de cálculo.",
      requireJustification: true,
      justificationPlaceholder: "Ex.: Valor publicado na fonte original apresenta diferença de arredondamento em relação ao cálculo derivado.",
      confirmLabel: "Aceitar valor publicado",
    });
  }

  function openBulkAcceptDivergencesDialog() {
    if (divergentSelectedCount === 0) return;
    setDialog({
      isOpen: true,
      type: "bulkAcceptDivergences",
      title: `Aceitar ${divergentSelectedCount} diferença(s) documentais em lote`,
      description: `${divergentSelectedCount} item(ns) com diferença documental serão aceitos exatamente como publicados. Informe a justificativa técnica para auditoria:`,
      requireJustification: true,
      justificationPlaceholder: "Ex.: Diferenças documentais conferidas na planilha oficial publicada.",
      confirmLabel: `Aceitar ${divergentSelectedCount} diferença(s)`,
    });
  }

  function openExcludeDialog(rowId: string) {
    setDialog({
      isOpen: true,
      type: "exclude",
      targetRowId: rowId,
      title: "Marcar item como não pertencente ao orçamento",
      description: "Este item deixará de compor os totais do orçamento. Informe a justificativa para auditoria:",
      requireJustification: true,
      justificationPlaceholder: "Ex.: Item duplicado ou fora do escopo da licitação.",
      isDestructive: true,
      confirmLabel: "Marcar como não pertencente",
    });
  }

  function openRestoreDialog(rowId: string) {
    setDialog({
      isOpen: true,
      type: "restore",
      targetRowId: rowId,
      title: "Restaurar item no orçamento",
      description: "O item voltará a compor a lista do orçamento como 'Pendente' para revisão.",
      confirmLabel: "Restaurar item",
    });
  }

  function openConsolidateDialog() {
    const lotLabel = lotPresentation(reviewContext?.procurementLotTitle ?? null, "Lot").title;
    setDialog({
      isOpen: true,
      type: "consolidate",
      title: `Confirmar ${lotLabel}`,
      description: `Esta ação finalizará a revisão e confirmará o orçamento oficial do ${lotLabel}. A ação é irreversível.`,
      confirmLabel: `Confirmar ${lotLabel}`,
    });
  }

  async function handleDialogCorrect(fields: Record<string, string | null>, justification: string) {
    if (dialog.targetRowId) {
      await callAction(
        { action: "correct", rowId: dialog.targetRowId, fields, justification },
        "✓ Valor corrigido e registrado na revisão.",
      );
    }
  }

  function handleReviewIndividually() {
    setDialog((prev) => ({ ...prev, isOpen: false }));
    setFilterState("divergent");
    setSelected(new Set());
    setPage(0);
    const firstDivergent = session?.rows.find((r) => {
      const rec = reconciliationByRowId.get(r.id);
      return r.reconciliationDecision === null && rec?.status === "diverges";
    });
    if (firstDivergent) {
      setExpandedRowId(firstDivergent.id);
    }
  }

  async function handleDialogConfirm(justification?: string) {
    if (dialog.type === "singleConfirm" && dialog.targetRowId) {
      await callAction({ action: "confirm", rowId: dialog.targetRowId }, "Item confirmado com sucesso.");
    } else if (dialog.type === "bulkConfirm") {
      if (!session) return;
      const rowIds = Array.from(selected).filter((id) => session.rows.find((row) => row.id === id)?.state === "Pendente");
      const ok = await callAction({ action: "bulkConfirm", rowIds }, `${rowIds.length} item(ns) confirmado(s) com sucesso.`);
      if (ok) setSelected(new Set());
    } else if (dialog.type === "singleAcceptDivergence" && dialog.targetRowId) {
      await callAction({ action: "acceptDivergence", rowId: dialog.targetRowId, justification }, "Diferença documental aceita com sucesso.");
    } else if (dialog.type === "bulkAcceptDivergences") {
      if (!session) return;
      const rowIds = Array.from(selected).filter((id) => {
        const r = session.rows.find((candidate) => candidate.id === id);
        const rec = reconciliationByRowId.get(id);
        return r !== undefined && r.reconciliationDecision === null && rec?.status === "diverges";
      });
      const ok = await callAction({ action: "bulkAcceptDivergences", rowIds, justification }, `${rowIds.length} diferença(s) documental(is) aceita(s) com sucesso.`);
      if (ok) setSelected(new Set());
    } else if (dialog.type === "exclude" && dialog.targetRowId) {
      await callAction({ action: "exclude", rowId: dialog.targetRowId, justification }, "Item marcado como não pertencente.");
    } else if (dialog.type === "restore" && dialog.targetRowId) {
      await callAction({ action: "restore", rowId: dialog.targetRowId }, "Item restaurado com sucesso.");
    } else if (dialog.type === "consolidate") {
      const lotLabel = lotPresentation(reviewContext?.procurementLotTitle ?? null, "Lot").title;
      await callAction({ action: "consolidate" }, `✓ Revisão concluída. ${lotLabel} confirmado.`);
    }
  }

  if (loading) {
    return (
      <section className="page-header">
        <div>
          <h1>Revisão do Orçamento Oficial</h1>
          <p>Carregando workspace de revisão...</p>
        </div>
      </section>
    );
  }

  if (error || !session) {
    return (
      <section className="page-header">
        <div>
          <h1>Revisão do Orçamento Oficial</h1>
          <p>{error ?? "Sessão não encontrada."}</p>
        </div>
      </section>
    );
  }

  const totalRows = session.rows.length;
  const confirmedCount = session.rows.filter((r) => r.state === "Confirmado" || r.state === "Corrigido").length;
  const pendingCount = session.rows.filter((r) => r.state === "Pendente").length;
  const correctedCount = session.rows.filter((r) => r.state === "Corrigido").length;
  const notBudgetCount = session.rows.filter((r) => r.state === "NaoPertenceAoOrcamento").length;

  const thStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "#111827",
    color: "#f3f4f6",
    padding: "0.6rem 0.5rem",
    borderBottom: "2px solid #374151",
    boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
    whiteSpace: "nowrap",
  };

  const divergentCount = Array.from(reconciliationByRowId.values()).filter((r) => r.status === "diverges").length;
  const lotLabel = lotPresentation(reviewContext?.procurementLotTitle ?? null, "Lot").title;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Hero Premium Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          borderRadius: "12px",
          padding: "1.5rem 1.75rem",
          border: "1px solid #334155",
          color: "#ffffff",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1.25rem" }}>
          <div style={{ flex: 1, minWidth: "280px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#f59e0b",
                  backgroundColor: "rgba(245, 158, 11, 0.15)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "4px",
                }}
              >
                Orçamento Oficial
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: session.status === "Consolidated" ? "#34d399" : "#60a5fa",
                  backgroundColor: session.status === "Consolidated" ? "rgba(52, 211, 153, 0.15)" : "rgba(96, 165, 250, 0.15)",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "4px",
                }}
              >
                {session.status === "Consolidated" ? "Confirmado" : "Em revisão"}
              </span>
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.35rem 0", color: "#f8fafc", lineHeight: 1.3 }}>
              {reviewContext?.procurementCaseTitle ?? "Processo de Licitação"}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap", fontSize: "0.875rem", color: "#94a3b8" }}>
              <span>
                <strong style={{ color: "#cbd5e1" }}>Lote:</strong> {reviewContext?.procurementLotTitle ?? "Lote"}
              </span>
              <span>•</span>
              <span>
                <strong style={{ color: "#cbd5e1" }}>Empresa:</strong> {reviewContext?.companyName ?? "BBA"}
              </span>
              <span>•</span>
              <span>
                <strong style={{ color: "#cbd5e1" }}>Arquivo:</strong> {reviewContext?.originalFileName ?? "Planilha.xlsx"}
              </span>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.75)",
              border: "1px solid #334155",
              borderRadius: "10px",
              padding: "0.875rem 1.25rem",
              textAlign: "right",
              minWidth: "220px",
            }}
          >
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#94a3b8", fontWeight: 600, letterSpacing: "0.05em" }}>
              Valor Oficial Identificado
            </div>
            <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#f59e0b", marginTop: "0.2rem", letterSpacing: "-0.02em" }}>
              R$ {formatBudgetMoneyPtBr(reviewContext?.officialBudgetTotalText)}
            </div>
          </div>
        </div>

        {/* Progress Bar & Metrics */}
        <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #334155", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", fontSize: "0.8rem", color: "#94a3b8" }}>
            <span>
              <strong style={{ color: "#f8fafc" }}>Progresso da Revisão:</strong> {confirmedCount} de {totalRows} linhas revisadas ({Math.round((confirmedCount / Math.max(1, totalRows)) * 100)}%)
            </span>
            <div style={{ display: "flex", gap: "1rem" }}>
              <span style={{ color: "#fbbf24" }}>● {pendingCount} pendente(s)</span>
              {divergentCount > 0 && <span style={{ color: "#f87171" }}>⚠ {divergentCount} diferença(s)</span>}
            </div>
          </div>
          <div style={{ height: "6px", width: "100%", backgroundColor: "#334155", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${(confirmedCount / Math.max(1, totalRows)) * 100}%`,
                backgroundColor: "#34d399",
                borderRadius: "3px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      </div>

      {toast && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            backgroundColor: toast.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            border: toast.type === "success" ? "1px solid #10b981" : "1px solid #ef4444",
            color: toast.type === "success" ? "#6ee7b7" : "#fca5a5",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: 500,
            fontSize: "0.875rem",
          }}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1rem" }}
          >
            ✕
          </button>
        </div>
      )}

      <Card title="Resumo">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
          <Stat label="Estado" value={session.status === "Consolidated" ? "Revisado e confirmado" : "Em revisão"} />
          <Stat label="Lotes" value={String(lotes.length)} />
          <Stat label="Linhas" value={String(totalRows)} />
          <Stat label="Revisadas" value={`${confirmedCount} / ${totalRows}`} />
          <Stat label="Pendentes" value={String(pendingCount)} />
          <Stat label="Corrigidas" value={String(correctedCount)} />
          <Stat label="Não pertencem" value={String(notBudgetCount)} />
        </div>
        {session.status === "Consolidated" ? (
          <p style={{ color: "#34d399", fontWeight: 600 }}>✓ Revisão concluída. {lotLabel} confirmado.</p>
        ) : reconciliation ? (
          <div style={{ marginTop: "1rem" }}>
            {reconciliation.readiness.ready ? (
              <p style={{ color: "#34d399", fontWeight: 600 }}>✓ {lotLabel} pronto para confirmação final.</p>
            ) : (
              <div>
                <p style={{ color: "#fca5a5", fontWeight: 600 }}>Pendências para confirmação:</p>
                <ul style={{ margin: "0.25rem 0", paddingLeft: "1.2rem", color: "#d1d5db", fontSize: "0.85rem" }}>
                  {reconciliation.readiness.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ marginTop: "0.75rem" }}>
              <Button disabled={!reconciliation.readiness.ready || busy} onClick={openConsolidateDialog}>
                Confirmar {lotLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card title="Filtros">
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <select value={filterState} onChange={(e) => handleFilterStateChange(e.target.value)}>
            <option value="all">Todos os estados</option>
            <option value="Pendente">Pendente</option>
            <option value="Confirmado">Confirmado</option>
            <option value="Corrigido">Corrigido</option>
            <option value="NaoPertenceAoOrcamento">Não pertence ao orçamento</option>
            <option value="InseridoManualmente">Inserido manualmente</option>
            <option value="divergent">Somente com diferença documental</option>
          </select>
          <select value={filterLote} onChange={(e) => handleFilterLoteChange(e.target.value)}>
            <option value="all">Todos os lotes</option>
            {lotes.map((lote) => (
              <option key={lote} value={lote}>{lote}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Buscar por item, código ou descrição"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ minWidth: "260px" }}
          />
          <span style={{ fontWeight: 500, fontSize: "0.85rem" }}>{filteredRows.length} linha(s) encontrada(s)</span>

          {eligibleFilteredRows.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "auto" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={allEligibleSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someEligibleSelected && !allEligibleSelected;
                  }}
                  onChange={handleSelectAllFilteredToggle}
                />
                Selecionar todos os resultados filtrados ({eligibleFilteredRows.length})
              </label>
            </div>
          )}
        </div>
      </Card>

      {/* DATA GRID WORKSPACE */}
      <Card title="Linhas do Orçamento">
        {/* 1. Selection ActionBar (Always Visible At Top of Workspace) */}
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#1f2937",
            borderRadius: "6px 6px 0 0",
            borderBottom: "1px solid #374151",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          {selected.size === 0 ? (
            <span style={{ fontSize: "0.85rem", color: "#9ca3af", fontStyle: "italic" }}>
              Selecione itens na tabela para realizar ações em lote
            </span>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", width: "100%", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: "#60a5fa", fontSize: "0.9rem" }}>
                {selected.size} item(ns) selecionado(s)
              </span>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <Button disabled={pendingSelectedCount === 0 || busy} onClick={openBulkConfirmDialog}>
                  Confirmar selecionadas ({pendingSelectedCount})
                </Button>
                <Button disabled={divergentSelectedCount === 0 || busy} onClick={openBulkAcceptDivergencesDialog}>
                  Aceitar divergências ({divergentSelectedCount})
                </Button>
                <Button variant="secondary" disabled={busy} onClick={handleClearSelection}>
                  Limpar seleção
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 2. TableScrollViewport (Only this element scrolls vertically & horizontally) */}
        <div
          ref={viewportRef}
          style={{
            maxHeight: "calc(100vh - 280px)",
            minHeight: "380px",
            overflow: "auto",
            position: "relative",
            backgroundColor: "#0f172a",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ ...thStyle, width: "32px" }}></th>
                <th style={thStyle}>Revisão</th>
                <th style={thStyle}>Lote</th>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Descrição</th>
                <th style={thStyle}>Unid.</th>
                <th style={thStyle}>Quant.</th>
                <th style={thStyle}>Custo unit. (R$)</th>
                <th style={thStyle}>BDI</th>
                <th style={thStyle}>Preço unit. (R$)</th>
                <th style={thStyle}>Total (R$)</th>
                <th style={thStyle}>Pág.</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const rec = reconciliationByRowId.get(row.id);
                return (
                  <Fragment key={row.id}>
                    <tr style={{ borderBottom: "1px solid #1f2937" }}>
                      <td style={{ padding: "0.5rem" }}>
                        {(row.state === "Pendente" || (rec?.status === "diverges" && row.reconciliationDecision === null)) && (
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={(e) => {
                              const next = new Set(selected);
                              if (e.target.checked) next.add(row.id);
                              else next.delete(row.id);
                              setSelected(next);
                            }}
                          />
                        )}
                      </td>
                      <td style={{ padding: "0.5rem" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                          <StateBadge state={row.state} />
                          <ReconciliationBadge
                            item={rec}
                            decision={row.reconciliationDecision}
                            onOpenDivergenceDecision={() => openDivergenceDecisionDialog(row.id)}
                          />
                        </div>
                      </td>
                      <td style={{ padding: "0.5rem" }}>{row.lotReference}</td>
                      <td style={{ padding: "0.5rem" }}>{row.revised.itemCode ?? "—"}</td>
                      <td style={{ padding: "0.5rem", fontWeight: row.kind !== "ServiceItem" ? 700 : 400, maxWidth: "320px" }}>{row.revised.description ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{row.revised.unit ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>{formatBudgetNumberPtBr(row.revised.quantityText)}</td>
                      <td style={{ padding: "0.5rem" }}>{formatBudgetMoneyPtBr(row.revised.unitCostWithoutBdiText)}</td>
                      <td style={{ padding: "0.5rem" }}>{formatBudgetPercentPtBr(row.revised.bdiPercentText)}</td>
                      <td style={{ padding: "0.5rem" }}>{formatBudgetMoneyPtBr(row.revised.unitPriceWithBdiText)}</td>
                      <td style={{ padding: "0.5rem" }}>{formatBudgetMoneyPtBr(row.revised.totalPriceText ?? row.revised.documentalGroupTotalText)}</td>
                      <td style={{ padding: "0.5rem" }}>{row.page ?? "—"}</td>
                      <td style={{ padding: "0.5rem" }}>
                        <Button variant="secondary" onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}>
                          {expandedRowId === row.id ? "Fechar" : "Ver"}
                        </Button>
                      </td>
                    </tr>
                    {expandedRowId === row.id && (
                      <tr>
                        <td colSpan={13} style={{ background: "#1f2937", padding: "1rem" }}>
                          <RowDetail
                            row={row}
                            reconciliationItem={rec}
                            onConfirm={() => openConfirmRowDialog(row.id)}
                            onExclude={() => openExcludeDialog(row.id)}
                            onRestore={() => openRestoreDialog(row.id)}
                            onAcceptDivergence={() => openAcceptDivergenceDialog(row.id)}
                            onCorrectRow={() => openCorrectRowDialog(row.id)}
                            busy={busy}
                            sessionInProgress={session.status === "InProgress"}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 3. PaginationBar (Always Visible At Bottom of Workspace) */}
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#1f2937",
            borderRadius: "0 0 6px 6px",
            borderTop: "1px solid #374151",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button disabled={pagination.firstDisabled} onClick={() => changePage(pagination.firstPageIndex)}>
              ⏮ Primeira
            </Button>
            <Button disabled={pagination.previousDisabled} onClick={() => changePage(pagination.previousPageIndex)}>
              ← Anterior
            </Button>
          </div>
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
            Página {pagination.pageIndex + 1} de {pagination.totalPages}
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button disabled={pagination.nextDisabled} onClick={() => changePage(pagination.nextPageIndex)}>
              Próxima →
            </Button>
            <Button disabled={pagination.lastDisabled} onClick={() => changePage(pagination.lastPageIndex)}>
              Última ⏭
            </Button>
          </div>
        </div>
      </Card>

      {/* Action Dialog Modal (Replaces browser alert/confirm/prompt) */}
      <ReviewActionDialog
        isOpen={dialog.isOpen}
        dialogState={dialog}
        row={session?.rows.find((r) => r.id === dialog.targetRowId) ?? null}
        reconciliationItem={dialog.targetRowId ? reconciliationByRowId.get(dialog.targetRowId) : null}
        divergentSelectedCount={divergentSelectedCount}
        busy={busy}
        onClose={() => setDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleDialogConfirm}
        onCorrect={handleDialogCorrect}
        onOpenAcceptDivergence={openAcceptDivergenceDialog}
        onOpenCorrectRow={openCorrectRowDialog}
        onReviewIndividually={handleReviewIndividually}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{label}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function RowDetail({
  row,
  reconciliationItem,
  onConfirm,
  onExclude,
  onRestore,
  onAcceptDivergence,
  onCorrectRow,
  busy,
  sessionInProgress,
}: {
  row: ReviewRow;
  reconciliationItem: ReconciliationItem | undefined;
  onConfirm: () => void;
  onExclude: () => void;
  onRestore: () => void;
  onAcceptDivergence: () => void;
  onCorrectRow: () => void;
  busy: boolean;
  sessionInProgress: boolean;
}) {
  const hasUnresolvedDivergence = reconciliationItem?.status === "diverges" && row.reconciliationDecision === null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <strong>Valor extraído (imutável)</strong>
          {row.extracted ? <FieldsTable fields={row.extracted} /> : <p>Linha inserida manualmente — sem valor extraído original.</p>}
        </div>
        <div>
          <strong>Valor revisado (atual)</strong>
          <FieldsTable fields={row.revised} />
        </div>
      </div>

      {reconciliationItem && reconciliationItem.status === "diverges" && (
        <div
          style={{
            background: row.reconciliationDecision ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
            border: row.reconciliationDecision ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
            padding: "0.75rem",
            borderRadius: "6px",
          }}
        >
          <strong>Diferença documental</strong>
          {row.reconciliationDecision ? (
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem" }}>
              Aceita como documentada por {row.reconciliationDecision.actor} em {new Date(row.reconciliationDecision.decidedAt).toLocaleString("pt-BR")}: “{row.reconciliationDecision.justification}”. Os valores foram preservados exatamente como publicados.
            </p>
          ) : (
            <div style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <p style={{ margin: 0 }}>
                O total derivado ({formatBudgetMoneyPtBr((reconciliationItem.derivedTotalCents ?? 0) / 100)}) difere do total publicado ({formatBudgetMoneyPtBr((reconciliationItem.documentedTotalCents ?? 0) / 100)}).
              </p>
              <p style={{ margin: 0, fontStyle: "italic", color: "#9ca3af" }}>
                Os valores acima correspondem ao documento oficial. A diferença decorre da relação entre os valores publicados.
              </p>
            </div>
          )}
        </div>
      )}

      {row.evidenceText && (
        <div>
          <strong>Evidência (texto de origem)</strong>
          <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#d1d5db" }}>{row.evidenceText}</p>
        </div>
      )}

      {row.justification && (
        <div>
          <strong>Justificativa</strong>
          <p style={{ fontSize: "0.85rem" }}>{row.justification}</p>
        </div>
      )}

      {row.page && <p style={{ fontSize: "0.85rem" }}>Página fonte: {row.page}</p>}

      {sessionInProgress && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
          {row.state === "Pendente" && (
            <Button disabled={busy} onClick={onConfirm}>Confirmar item</Button>
          )}
          {row.state !== "NaoPertenceAoOrcamento" && (
            <Button disabled={busy} onClick={onExclude}>Marcar como não pertencente</Button>
          )}
          {row.state === "NaoPertenceAoOrcamento" && (
            <Button disabled={busy} onClick={onRestore}>Restaurar item</Button>
          )}
          {hasUnresolvedDivergence && (
            <>
              <Button variant="secondary" disabled={busy} onClick={onCorrectRow}>✏️ Corrigir valor</Button>
              <Button disabled={busy} onClick={onAcceptDivergence}>✓ Aceitar valor publicado</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FieldsTable({ fields }: { fields: RowFields }) {
  const entries: Array<[string, string | null]> = [
    ["Código", fields.sourceCode],
    ["Fonte", fields.sourceFonte],
    ["Tipo", fields.sourceTipo],
    ["Unidade", fields.unit],
    ["Quantidade", formatBudgetNumberPtBr(fields.quantityText)],
    ["Custo unit. s/BDI", formatBudgetMoneyPtBr(fields.unitCostWithoutBdiText)],
    ["BDI", formatBudgetPercentPtBr(fields.bdiPercentText)],
    ["Preço unit. c/BDI", formatBudgetMoneyPtBr(fields.unitPriceWithBdiText)],
    ["Total", formatBudgetMoneyPtBr(fields.totalPriceText)],
    ["Total documental (grupo)", formatBudgetMoneyPtBr(fields.documentalGroupTotalText)],
    ["Col. FGV-DNIT", fields.colFgvDnit],
  ];
  return (
    <table style={{ fontSize: "0.8rem" }}>
      <tbody>
        {entries.map(([label, value]) => (
          <tr key={label}>
            <td style={{ color: "#9ca3af", paddingRight: "0.5rem" }}>{label}</td>
            <td>{value ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
