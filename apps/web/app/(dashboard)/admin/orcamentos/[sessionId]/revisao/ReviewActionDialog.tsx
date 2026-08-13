"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@bba/ui";
import { formatBudgetMoneyPtBr, formatBudgetNumberPtBr, formatBudgetPercentPtBr } from "@/lib/bdos/format-budget-number";

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

export interface DialogState {
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

export interface ReviewRowFields {
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

export interface DialogRow {
  readonly id: string;
  readonly kind: "Group" | "Subgroup" | "ServiceItem";
  readonly state: string;
  readonly extracted: ReviewRowFields | null;
  readonly revised: ReviewRowFields;
}

export interface DialogReconciliationItem {
  readonly rowId: string;
  readonly status: string;
  readonly differenceCents: number | null;
  readonly derivedTotalCents?: number | null;
  readonly documentedTotalCents?: number | null;
}

interface ReviewActionDialogProps {
  readonly isOpen: boolean;
  readonly dialogState: DialogState;
  readonly row?: DialogRow | null;
  readonly reconciliationItem?: DialogReconciliationItem | null;
  readonly divergentSelectedCount?: number;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (justification?: string) => void;
  readonly onCorrect: (fields: Record<string, string | null>, justification: string) => void;
  readonly onOpenAcceptDivergence: (rowId: string) => void;
  readonly onOpenCorrectRow: (rowId: string) => void;
  readonly onReviewIndividually: () => void;

  // Legacy prop fallbacks for compatibility
  readonly title?: string;
  readonly description?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly isDestructive?: boolean;
  readonly requireJustification?: boolean;
  readonly justificationPlaceholder?: string;
}

export function ReviewActionDialog({
  isOpen,
  dialogState,
  row,
  reconciliationItem,
  divergentSelectedCount = 0,
  busy = false,
  onClose,
  onConfirm,
  onCorrect,
  onOpenAcceptDivergence,
  onOpenCorrectRow,
  onReviewIndividually,
  // Fallbacks
  title: legacyTitle,
  description: legacyDescription,
  confirmLabel: legacyConfirmLabel,
  isDestructive: legacyIsDestructive,
  requireJustification: legacyRequireJustification,
  justificationPlaceholder: legacyJustificationPlaceholder,
}: ReviewActionDialogProps) {
  const [justification, setJustification] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState<Record<string, string | null>>({});

  const initialFocusRef = useRef<HTMLTextAreaElement | HTMLInputElement | HTMLButtonElement | null>(null);

  // Derive active dialog props
  const type = dialogState?.type ?? "singleConfirm";
  const title = dialogState?.title ?? legacyTitle ?? "";
  const description = dialogState?.description ?? legacyDescription ?? "";
  const confirmLabel = dialogState?.confirmLabel ?? legacyConfirmLabel ?? "Confirmar";
  const isDestructive = dialogState?.isDestructive ?? legacyIsDestructive ?? false;
  const requireJustification = dialogState?.requireJustification ?? legacyRequireJustification ?? false;
  const justificationPlaceholder =
    dialogState?.justificationPlaceholder ?? legacyJustificationPlaceholder ?? "Informe a justificativa técnica...";

  // Initialize state on open
  useEffect(() => {
    if (isOpen) {
      setJustification("");
      setValidationError(null);
      if (row) {
        setEditedFields({
          itemCode: row.revised.itemCode ?? "",
          description: row.revised.description ?? "",
          sourceCode: row.revised.sourceCode ?? null,
          sourceFonte: row.revised.sourceFonte ?? null,
          sourceTipo: row.revised.sourceTipo ?? null,
          unit: row.revised.unit ?? "",
          quantityText: row.revised.quantityText ?? "",
          unitCostWithoutBdiText: row.revised.unitCostWithoutBdiText ?? "",
          bdiPercentText: row.revised.bdiPercentText ?? "",
          unitPriceWithBdiText: row.revised.unitPriceWithBdiText ?? "",
          totalPriceText: row.revised.totalPriceText ?? "",
          colFgvDnit: row.revised.colFgvDnit ?? null,
          documentalGroupTotalText: row.revised.documentalGroupTotalText ?? "",
        });
      }
      setTimeout(() => {
        initialFocusRef.current?.focus();
      }, 50);
    }
  }, [isOpen, row, type]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen || busy) return;
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  function handleStandardSubmit() {
    if (requireJustification) {
      if (justification.trim().length < 3) {
        setValidationError("A justificativa técnica é obrigatória (mínimo de 3 caracteres).");
        return;
      }
    }
    onConfirm(requireJustification ? justification.trim() : undefined);
  }

  function handleCorrectionSubmit() {
    if (justification.trim().length < 3) {
      setValidationError("A justificativa técnica para a correção é obrigatória (mínimo de 3 caracteres).");
      return;
    }
    if (!row) return;

    // Check if any field changed
    const hasChange = Object.keys(editedFields).some((key) => {
      const orig = row.revised[key as keyof ReviewRowFields] ?? "";
      const val = editedFields[key] ?? "";
      return String(orig).trim() !== String(val).trim();
    });

    if (!hasChange) {
      setValidationError("Nenhum valor foi alterado em relação aos valores revisados atuais.");
      return;
    }

    onCorrect(editedFields, justification.trim());
  }

  // Derived values for divergence display
  const derivedCents = reconciliationItem?.derivedTotalCents ?? 0;
  const documentedCents = reconciliationItem?.documentedTotalCents ?? 0;
  const diffCents = Math.abs(reconciliationItem?.differenceCents ?? 0);
  const formattedDerived = formatBudgetMoneyPtBr(derivedCents / 100);
  const formattedDocumented = formatBudgetMoneyPtBr(documentedCents / 100);
  const formattedDiff = formatBudgetMoneyPtBr(diffCents / 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: type === "singleCorrectRow" ? "680px" : "520px",
          backgroundColor: "#0f172a",
          border: "1px solid #334155",
          borderRadius: "12px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          padding: "1.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          color: "#f8fafc",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* ================= MODE 1: DIVERGENCE DECISION (3 CHOICES) ================= */}
        {type === "divergenceDecision" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#fbbf24",
                    backgroundColor: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "4px",
                  }}
                >
                  Diferença Documental
                </span>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                  Item {row?.revised.itemCode ?? "—"}
                </span>
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0.25rem 0 0 0", color: "#ffffff" }}>
                {row?.revised.description ?? "Diferença no item"}
              </h3>
            </div>

            {/* Difference Breakdown Card */}
            <div
              style={{
                backgroundColor: "rgba(30, 41, 59, 0.8)",
                border: "1px solid #334155",
                borderRadius: "8px",
                padding: "1rem 1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.4 }}>
                O valor publicado no documento oficial difere do valor total derivado.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", textAlign: "center", paddingTop: "0.5rem", borderTop: "1px solid #334155" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>Total Calculado</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#cbd5e1", marginTop: "0.15rem" }}>R$ {formattedDerived}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>Total Publicado</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#cbd5e1", marginTop: "0.15rem" }}>R$ {formattedDocumented}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "#fbbf24", textTransform: "uppercase", fontWeight: 700 }}>Diferença</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#f59e0b", marginTop: "0.15rem" }}>R$ {formattedDiff}</div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f1f5f9" }}>
              Escolha como deseja tratar esta diferença:
            </div>

            {/* 3 Explicit Action Choices */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* Option A: Corrigir Valor (Secondary Outlined Premium Button) */}
              <button
                type="button"
                disabled={busy}
                onClick={() => row && onOpenCorrectRow(row.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.875rem 1.25rem",
                  backgroundColor: "rgba(59, 130, 246, 0.08)",
                  border: "1px solid rgba(59, 130, 246, 0.4)",
                  borderRadius: "8px",
                  color: "#93c5fd",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: busy ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#60a5fa" }}>Corrigir valor</div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 400, color: "#94a3b8", marginTop: "0.15rem" }}>
                    Editar a quantidade, custo unitário, BDI ou total revisado
                  </div>
                </div>
                <span style={{ fontSize: "1.2rem" }}>✏️</span>
              </button>

              {/* Option B: Aceitar Valor Publicado (Gold BBA Primary Button) */}
              <button
                type="button"
                disabled={busy}
                onClick={() => row && onOpenAcceptDivergence(row.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.875rem 1.25rem",
                  background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: busy ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 12px rgba(217, 119, 6, 0.3)",
                  transition: "all 0.15s ease",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#ffffff" }}>Aceitar valor publicado</div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 400, color: "rgba(255, 255, 255, 0.85)", marginTop: "0.15rem" }}>
                    Manter os valores publicados no documento oficial com justificativa
                  </div>
                </div>
                <span style={{ fontSize: "1.2rem" }}>✓</span>
              </button>
            </div>

            {/* Option C: Revisar depois (Tertiary Text Link Action) */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: "0.5rem" }}>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: "0.4rem 0.8rem",
                }}
              >
                Revisar depois
              </button>
            </div>
          </>
        )}

        {/* ================= MODE 2: CORRIGIR VALOR (EDITOR FORM) ================= */}
        {type === "singleCorrectRow" && row && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#ffffff" }}>
                Corrigir valor da linha
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
                Item <strong>{row.revised.itemCode ?? "—"}</strong> — {row.revised.description ?? "Sem descrição"}
              </p>
            </div>

            {/* Side-by-Side Comparison Editor Grid */}
            <div
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                overflow: "hidden",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr", backgroundColor: "#0f172a", borderBottom: "1px solid #334155", padding: "0.6rem 0.8rem", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <div style={{ color: "#94a3b8" }}>Campo</div>
                <div style={{ color: "#64748b" }}>Publicado (Imutável)</div>
                <div style={{ color: "#f59e0b" }}>Revisado (Editável)</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {row.kind === "ServiceItem" ? (
                  <>
                    <EditorRow
                      label="Código"
                      extracted={row.extracted?.itemCode}
                      value={editedFields.itemCode ?? ""}
                      onChange={(val) => setEditedFields((prev) => ({ ...prev, itemCode: val }))}
                      disabled={busy}
                    />
                    <EditorRow
                      label="Unidade"
                      extracted={row.extracted?.unit}
                      value={editedFields.unit ?? ""}
                      onChange={(val) => setEditedFields((prev) => ({ ...prev, unit: val }))}
                      disabled={busy}
                    />
                    <EditorRow
                      label="Quantidade"
                      extracted={formatBudgetNumberPtBr(row.extracted?.quantityText)}
                      value={editedFields.quantityText ?? ""}
                      onChange={(val) => setEditedFields((prev) => ({ ...prev, quantityText: val }))}
                      isNumeric
                      disabled={busy}
                    />
                    <EditorRow
                      label="Custo unit. (R$)"
                      extracted={formatBudgetMoneyPtBr(row.extracted?.unitCostWithoutBdiText)}
                      value={editedFields.unitCostWithoutBdiText ?? ""}
                      onChange={(val) => setEditedFields((prev) => ({ ...prev, unitCostWithoutBdiText: val }))}
                      isNumeric
                      disabled={busy}
                    />
                    <EditorRow
                      label="BDI (%)"
                      extracted={formatBudgetPercentPtBr(row.extracted?.bdiPercentText)}
                      value={editedFields.bdiPercentText ?? ""}
                      onChange={(val) => setEditedFields((prev) => ({ ...prev, bdiPercentText: val }))}
                      isNumeric
                      disabled={busy}
                    />
                    <EditorRow
                      label="Preço unit. (R$)"
                      extracted={formatBudgetMoneyPtBr(row.extracted?.unitPriceWithBdiText)}
                      value={editedFields.unitPriceWithBdiText ?? ""}
                      onChange={(val) => setEditedFields((prev) => ({ ...prev, unitPriceWithBdiText: val }))}
                      isNumeric
                      disabled={busy}
                    />
                    <EditorRow
                      label="Preço Total (R$)"
                      extracted={formatBudgetMoneyPtBr(row.extracted?.totalPriceText)}
                      value={editedFields.totalPriceText ?? ""}
                      onChange={(val) => setEditedFields((prev) => ({ ...prev, totalPriceText: val }))}
                      isNumeric
                      disabled={busy}
                    />
                  </>
                ) : (
                  <>
                    <EditorRow
                      label="Código"
                      extracted={row.extracted?.itemCode}
                      value={editedFields.itemCode ?? ""}
                      onChange={(val) => setEditedFields((prev) => ({ ...prev, itemCode: val }))}
                      disabled={busy}
                    />
                    <EditorRow
                      label="Descrição"
                      extracted={row.extracted?.description}
                      value={editedFields.description ?? ""}
                      onChange={(val) => setEditedFields((prev) => ({ ...prev, description: val }))}
                      disabled={busy}
                    />
                    <EditorRow
                      label="Total (R$)"
                      extracted={formatBudgetMoneyPtBr(row.extracted?.documentalGroupTotalText)}
                      value={editedFields.documentalGroupTotalText ?? ""}
                      onChange={(val) => setEditedFields((prev) => ({ ...prev, documentalGroupTotalText: val }))}
                      isNumeric
                      disabled={busy}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Mandatory Technical Justification */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#d1d5db" }}>
                Justificativa técnica <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea
                ref={(el) => {
                  if (el) initialFocusRef.current = el;
                }}
                rows={3}
                value={justification}
                onChange={(e) => {
                  setJustification(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Ex.: Total corrigido após conferência da composição publicada."
                disabled={busy}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "6px",
                  backgroundColor: "#1e293b",
                  border: validationError ? "1px solid #ef4444" : "1px solid #475569",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
              {validationError && (
                <span style={{ fontSize: "0.75rem", color: "#f87171", fontWeight: 500 }}>{validationError}</span>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => (reconciliationItem?.status === "diverges" ? onOpenAcceptDivergence(row.id) : onClose())}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Voltar
              </button>
              <Button
                disabled={busy}
                onClick={handleCorrectionSubmit}
                style={{
                  background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                  borderColor: "#d97706",
                  color: "#ffffff",
                  fontWeight: 700,
                }}
              >
                {busy ? "Salvando..." : "Salvar correção"}
              </Button>
            </div>
          </>
        )}

        {/* ================= MODE 3: SINGLE ACCEPT DIVERGENCE ================= */}
        {type === "singleAcceptDivergence" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#ffffff" }}>
                Aceitar valor publicado
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>
                Você está confirmando que o valor publicado no documento oficial deve ser mantido mesmo com esta diferença de cálculo.
              </p>
            </div>

            {row && (
              <div style={{ backgroundColor: "#1e293b", padding: "0.75rem", borderRadius: "6px", fontSize: "0.85rem", color: "#cbd5e1" }}>
                <strong>Item {row.revised.itemCode ?? "—"}:</strong> {row.revised.description ?? ""}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#d1d5db" }}>
                Justificativa técnica <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea
                ref={(el) => {
                  if (el) initialFocusRef.current = el;
                }}
                rows={3}
                value={justification}
                onChange={(e) => {
                  setJustification(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Ex.: Valor publicado na fonte original apresenta diferença de arredondamento em relação ao cálculo derivado."
                disabled={busy}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "6px",
                  backgroundColor: "#1e293b",
                  border: validationError ? "1px solid #ef4444" : "1px solid #475569",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
              {validationError && (
                <span style={{ fontSize: "0.75rem", color: "#f87171", fontWeight: 500 }}>{validationError}</span>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => (reconciliationItem?.status === "diverges" ? onOpenAcceptDivergence(row?.id ?? "") : onClose())}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Voltar
              </button>
              <Button
                disabled={busy}
                onClick={handleStandardSubmit}
                style={{
                  background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                  borderColor: "#d97706",
                  color: "#ffffff",
                  fontWeight: 700,
                }}
              >
                {busy ? "Processando..." : "Aceitar valor publicado"}
              </Button>
            </div>
          </>
        )}

        {/* ================= MODE 4: BULK ACCEPT DIVERGENCES ================= */}
        {type === "bulkAcceptDivergences" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#ffffff" }}>
                Aceitar {divergentSelectedCount} diferença(s) documentais em lote
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>
                {divergentSelectedCount} item(ns) com diferença documental serão aceitos exatamente como publicados. Informe a justificativa técnica para auditoria:
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#d1d5db" }}>
                Justificativa técnica <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea
                ref={(el) => {
                  if (el) initialFocusRef.current = el;
                }}
                rows={3}
                value={justification}
                onChange={(e) => {
                  setJustification(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Ex.: Diferenças documentais conferidas na planilha oficial publicada."
                disabled={busy}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "6px",
                  backgroundColor: "#1e293b",
                  border: validationError ? "1px solid #ef4444" : "1px solid #475569",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
              {validationError && (
                <span style={{ fontSize: "0.75rem", color: "#f87171", fontWeight: 500 }}>{validationError}</span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <Button variant="secondary" disabled={busy} onClick={onReviewIndividually}>
                  Revisar individualmente
                </Button>
                <Button
                  disabled={busy}
                  onClick={handleStandardSubmit}
                  style={{
                    background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                    borderColor: "#d97706",
                    color: "#ffffff",
                    fontWeight: 700,
                  }}
                >
                  {busy ? "Processando..." : `Aceitar ${divergentSelectedCount} diferença(s)`}
                </Button>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Revisar depois
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================= MODE 5: STANDARD ACTION DIALOG ================= */}
        {type !== "divergenceDecision" &&
          type !== "singleCorrectRow" &&
          type !== "singleAcceptDivergence" &&
          type !== "bulkAcceptDivergences" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, color: "#ffffff" }}>{title}</h3>
                <p style={{ fontSize: "0.875rem", color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>{description}</p>
              </div>

              {requireJustification && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#d1d5db" }}>
                    Justificativa técnica <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <textarea
                    ref={(el) => {
                      if (el) initialFocusRef.current = el;
                    }}
                    rows={3}
                    value={justification}
                    onChange={(e) => {
                      setJustification(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder={justificationPlaceholder}
                    disabled={busy}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "6px",
                      backgroundColor: "#1e293b",
                      border: validationError ? "1px solid #ef4444" : "1px solid #475569",
                      color: "#ffffff",
                      fontSize: "0.85rem",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                  {validationError && (
                    <span style={{ fontSize: "0.75rem", color: "#f87171", fontWeight: 500 }}>{validationError}</span>
                  )}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <Button variant="secondary" disabled={busy} onClick={onClose}>
                  {dialogState?.type === "bulkConfirm" ? "Revisar depois" : "Cancelar"}
                </Button>
                <Button
                  disabled={busy}
                  onClick={handleStandardSubmit}
                  style={
                    isDestructive
                      ? { backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }
                      : undefined
                  }
                >
                  {busy ? "Processando..." : confirmLabel}
                </Button>
              </div>
            </>
          )}
      </div>
    </div>
  );
}

function EditorRow({
  label,
  extracted,
  value,
  onChange,
  isNumeric = false,
  disabled = false,
}: {
  label: string;
  extracted?: string | null;
  value: string;
  onChange: (val: string) => void;
  isNumeric?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr 1fr",
        alignItems: "center",
        padding: "0.4rem 0.8rem",
        borderBottom: "1px solid #334155",
        gap: "0.5rem",
      }}
    >
      <div style={{ color: "#94a3b8", fontWeight: 600, fontSize: "0.8rem" }}>{label}</div>
      <div style={{ color: "#64748b", fontStyle: extracted ? "normal" : "italic" }}>
        {extracted ?? "—"}
      </div>
      <div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{
            width: "100%",
            backgroundColor: "#0f172a",
            border: "1px solid #475569",
            borderRadius: "4px",
            padding: "0.35rem 0.5rem",
            color: "#ffffff",
            fontSize: "0.85rem",
            textAlign: isNumeric ? "right" : "left",
            fontFamily: "inherit",
          }}
        />
      </div>
    </div>
  );
}
