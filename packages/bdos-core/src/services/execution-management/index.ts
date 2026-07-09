export * from "./execution-management-service";
export * from "./execution-management-service.types";

// Fase 16.5 — apps/web nunca importa domain/* diretamente
// (PLATFORM_ARCHITECTURE.md §4); este é o único subpath autorizado a
// carregar o restante do domain model (transições de ciclo de vida:
// startExecutionTask/blockExecutionTask/unblockExecutionTask/
// attachEvidenceReference/completeExecutionTask/cancelExecutionTask +
// todos os tipos) para o repository de apps/web usar. Reexporta
// exatamente o que domain/execution-management/index.ts já decidiu
// expor como sua própria API pública — nenhuma superfície nova aqui.
export * from "../../domain/execution-management";
