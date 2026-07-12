export * from "./measurement-bulletin-import.types";

// Único subpath autorizado a expor o parser do Boletim de Medição e
// seus tipos para fora de bdos-core (PLATFORM_ARCHITECTURE.md §4:
// apps/web nunca importa domain/* diretamente) -- mesmo papel que
// services/execution-management/index.ts já cumpre para aquele
// domínio. Reexporta exatamente o que o Application Service de
// apps/web (Sprint 4D.2) precisa para chamar o parser e interpretar
// ParsedMeasurementBulletin -- nenhuma superfície nova além disso.
export { importBulletinExcel } from "../../domain/measurement-workspace/adapters/excel-import/bulletin-import";
export type {
  BulletinImportInput,
  BulletinImportResult,
  MeasurementImportIssue,
  MeasurementImportIssueCode,
  MeasurementImportIssueSeverity,
  ParsedManagedServiceItem,
  ParsedMeasurementLine,
  ParsedMeasurementLineSourceLocation,
  ParsedSkippedSheet,
  ParsedSkippedSheetReason,
  ParsedWorkPackage
} from "../../domain/measurement-workspace/adapters/excel-import/bulletin-import.types";

// canAdvanceStatus (validação pura de transição de estado, Sprint
// 4D.2) -- o Application Service precisa validar Draft -> InProgress
// sem reconstruir o aggregate rico de measurement-workspace.ts.
export { canAdvanceStatus } from "../../domain/measurement-workspace/measurement-workspace";
export { MeasurementWorkspaceStatus } from "../../domain/measurement-workspace/measurement-workspace.types";
