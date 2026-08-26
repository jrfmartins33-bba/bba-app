"use client";

import { useEffect, useState } from "react";
import { Button } from "@bba/ui";

export interface MeasurementRefusalDialogProps {
  readonly onClose: () => void;
}

const MINIMUM_REASON_LENGTH = 3;

/**
 * "Recusar / devolver para correção" -- item 9 da especificação:
 * verificado (Explore, medição/measurement-workflow.ts,
 * bulletin-generator.types.ts, e as migrations de measurement_bulletins/
 * measurement_cycles/measurement_workspaces) que HOJE não existe
 * nenhuma transição de domínio segura para devolução/recusa de um
 * boletim já Finalized -- nem um valor "Returned"/"Rejected" no enum
 * de status, nem uma função SQL equivalente às de certificação. Este
 * componente implementa o fluxo visual completo (motivo obrigatório,
 * Cancelar/Confirmar devolução) e PARA antes de qualquer persistência:
 * "Confirmar devolução" nunca chama uma API -- não existe uma para
 * chamar -- só informa objetivamente a lacuna, sem fingir sucesso e
 * sem recusa silenciosa.
 */
export function MeasurementRefusalDialog({ onClose }: MeasurementRefusalDialogProps) {
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleConfirm() {
    if (reason.trim().length < MINIMUM_REASON_LENGTH) {
      setValidationError("O motivo da devolução é obrigatório.");
      return;
    }
    setValidationError(null);
    // Nenhuma chamada de API acontece aqui -- ver nota acima.
    setAcknowledged(true);
  }

  return (
    <div aria-modal="true" className="measurement-dialog-overlay" role="dialog">
      <div className="measurement-dialog measurement-dialog--refuse">
        <div className="measurement-dialog__header">
          <h3>Recusar / devolver para correção</h3>
        </div>

        {acknowledged ? (
          <>
            <p className="measurement-dialog__notice">
              Este boletim já foi finalizado e, hoje, não existe no domínio de Medições uma transição segura de devolução/recusa para um
              boletim finalizado. Nenhuma escrita foi realizada.
            </p>
            <div className="measurement-dialog__actions">
              <Button onClick={onClose}>Fechar</Button>
            </div>
          </>
        ) : (
          <>
            <div className="measurement-dialog__field">
              <label htmlFor="measurement-refusal-reason">
                Motivo da devolução <span className="measurement-dialog__required">*</span>
              </label>
              <textarea
                id="measurement-refusal-reason"
                onChange={(event) => {
                  setReason(event.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Descreva o motivo pelo qual esta medição está sendo devolvida para correção."
                rows={4}
                value={reason}
              />
              {validationError ? <span className="measurement-dialog__field-error">{validationError}</span> : null}
            </div>

            <div className="measurement-dialog__actions">
              <Button onClick={onClose} variant="secondary">
                Cancelar
              </Button>
              <Button onClick={handleConfirm} variant="danger">
                Confirmar devolução
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
