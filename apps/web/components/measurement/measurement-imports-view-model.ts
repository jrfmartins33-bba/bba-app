import type { MeasurementBulletinImportStatus } from "@/lib/bdos/measurement-repository";
import type { MeasurementImportListItem } from "@/lib/bdos/measurement-imports-listing-service";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.1B — tradução de
 * apresentação para a página `/medicoes`. Puramente funcional (sem
 * React, sem fetch) para poder ser testado sem infraestrutura de
 * render/DOM, que este repositório não tem — mesmo espírito de
 * o mesmo padrão de extrair lógica de apresentação para fora do `.tsx`
 * já usado no Project Studio.
 */

export interface ImportStatusPresentation {
  readonly label: string;
  readonly badge: "pending" | "in_progress" | "completed" | "cancelled";
}

// Tradução de interface apenas -- nunca "Aprovado"/"Reprovado"/
// "Certificado" (termos que pertencem ao Decision Brief, não ao
// processo de importação).
const STATUS_PRESENTATION: Record<MeasurementBulletinImportStatus, ImportStatusPresentation> = {
  pending_upload: { label: "Aguardando envio", badge: "pending" },
  uploaded: { label: "Enviado", badge: "pending" },
  processing: { label: "Processando", badge: "in_progress" },
  completed: { label: "Concluído", badge: "completed" },
  failed: { label: "Falha na importação", badge: "cancelled" }
};

export function translateImportStatus(status: MeasurementBulletinImportStatus): ImportStatusPresentation {
  return STATUS_PRESENTATION[status];
}

const FALLBACK_HUMAN_LABEL = "Boletim de Medição";

/** `humanLabel` verbatim quando existe; nunca deriva rótulo do id ou da posição na lista. */
export function resolveHumanLabel(item: Pick<MeasurementImportListItem, "humanLabel">): string {
  return item.humanLabel ?? FALLBACK_HUMAN_LABEL;
}

/**
 * A possibilidade de abrir o Relatório Executivo depende exclusivamente
 * de `analysisAvailable` -- nunca de `status === "completed"` (um
 * import completed pode não ter analysis_result persistido; um failed
 * pode ter, ver finalizeAsFailed em measurement-bulletin-import-service.ts).
 */
export function canOpenReport(item: Pick<MeasurementImportListItem, "analysisAvailable">): boolean {
  return item.analysisAvailable;
}

export function formatImportDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR");
}
