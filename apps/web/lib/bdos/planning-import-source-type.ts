import type { PlanningImportSourceType } from "@bba/bdos-core/services/bba-project-import";

// Epic 18 — extraído de apps/web/app/api/bba-project/import/route.ts
// (função privada `detectSourceType`) para ser reaproveitado sem
// duplicação nos 3 pontos que agora precisam dele: a rota antiga
// (inalterada em comportamento), `prepare-upload` (só extensão/MIME —
// ainda não há bytes) e `process` (extensão/MIME + sniffing de bytes,
// recuperando a robustez que o prepare-upload sozinho não sustenta —
// ver RESILIENT_PLANNING_IMPORT.md, Ajuste 2).
//
// `bytes` omitido = modo "leve" (só extensão/MIME, usado no
// prepare-upload, antes do upload existir). `bytes` presente = modo
// completo (usado no process, depois do download real) — mesmo
// algoritmo de sniffing de sempre: .xlsx é sempre um ZIP ("PK" nos 2
// primeiros bytes), um XML sempre começa com "<".
export function detectPlanningImportSourceType(
  fileName: string,
  mimeType: string,
  bytes?: Uint8Array
): PlanningImportSourceType | null {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".xml") || mimeType === "text/xml" || mimeType === "application/xml") {
    return "ms-project-xml";
  }

  if (lowerName.endsWith(".xlsx") || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return "excel";
  }

  if (!bytes) {
    return null;
  }

  return sniffPlanningImportSourceTypeFromBytes(bytes);
}

// Epic 18, Ajuste 2 — usado por `process` para validar o conteúdo REAL
// do arquivo contra o `source_type` declarado no `prepare-upload`.
// Deliberadamente separado de `detectPlanningImportSourceType`: aquela
// função dá prioridade à extensão/MIME (correto para a decisão inicial,
// quando ainda não há motivo para desconfiar do nome do arquivo) — mas
// isso a torna inadequada para detectar um mismatch, porque um arquivo
// chamado "relatorio.xlsx" que na verdade contém XML sempre "ganharia"
// pela extensão antes mesmo de olhar os bytes. Esta função nunca olha
// para nome/MIME — só para o conteúdo, a única fonte que não pode ser
// forjada por um nome de arquivo enganoso.
export function sniffPlanningImportSourceTypeFromBytes(bytes: Uint8Array): PlanningImportSourceType | null {
  if (bytes.length < 2) {
    return null;
  }

  // .xlsx é sempre um ZIP ("PK" nos dois primeiros bytes); um XML
  // sempre começa com "<".
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return "excel";
  }

  if (bytes[0] === 0x3c) {
    return "ms-project-xml";
  }

  return null;
}
