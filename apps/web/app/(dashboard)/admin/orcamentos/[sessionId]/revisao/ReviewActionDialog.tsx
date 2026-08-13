"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@bba/ui";

interface ReviewActionDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly isDestructive?: boolean;
  readonly requireJustification?: boolean;
  readonly justificationPlaceholder?: string;
  readonly busy?: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (justification?: string) => void;
}

export function ReviewActionDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  isDestructive = false,
  requireJustification = false,
  justificationPlaceholder = "Informe a justificativa técnica...",
  busy = false,
  onClose,
  onConfirm,
}: ReviewActionDialogProps) {
  const [justification, setJustification] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const initialFocusRef = useRef<HTMLTextAreaElement | HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setJustification("");
      setValidationError(null);
      setTimeout(() => {
        initialFocusRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

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

  function handleSubmit() {
    if (requireJustification) {
      if (justification.trim().length < 3) {
        setValidationError("A justificativa técnica é obrigatória (mínimo de 3 caracteres).");
        return;
      }
    }
    onConfirm(requireJustification ? justification.trim() : undefined);
  }

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
        backdropFilter: "blur(4px)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#111827",
          border: "1px solid #374151",
          borderRadius: "8px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          color: "#f3f4f6",
        }}
      >
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
                backgroundColor: "#1f2937",
                border: validationError ? "1px solid #ef4444" : "1px solid #4b5563",
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
            {cancelLabel}
          </Button>
          <Button
            disabled={busy}
            onClick={handleSubmit}
            style={
              isDestructive
                ? { backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }
                : undefined
            }
          >
            {busy ? "Processando..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
