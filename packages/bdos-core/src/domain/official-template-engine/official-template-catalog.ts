/**
 * Institutional knowledge catalog of the generic official document types
 * BDOS is aware of. This is deliberately independent from the
 * `OfficialDocumentType` enum modeled by the `OfficialTemplate` aggregate
 * (Sprint 11.5.1): the aggregate's enum describes what a *concrete
 * template instance* was created as, while this catalog describes what
 * document types the *system itself* recognizes as institutional
 * knowledge — a distinct concept, intentionally not wired together here
 * ("Esta sprint NÃO faz integração").
 *
 * The catalog does not represent real documents, files, or any specific
 * public body's rules — only a static, deterministic list of generic
 * document kinds and illustrative (non-binding) recommendations.
 */
import { freezeDomainObject } from "./official-template-shared";

export enum OfficialTemplateCatalogDocumentType {
  MeasurementBulletin = "MEASUREMENT_BULLETIN",
  PhotoReport = "PHOTO_REPORT",
  TechnicalReport = "TECHNICAL_REPORT",
  WorkOrder = "WORK_ORDER",
  ReceivingTerm = "RECEIVING_TERM",
  TechnicalOpinion = "TECHNICAL_OPINION",
  OfficialLetter = "OFFICIAL_LETTER",
  ProjectCover = "PROJECT_COVER",
  ExecutionReport = "EXECUTION_REPORT",
  Checklist = "CHECKLIST",
  InspectionReport = "INSPECTION_REPORT",
  FieldReport = "FIELD_REPORT",
}

export interface OfficialTemplateCatalogEntry {
  readonly documentType: OfficialTemplateCatalogDocumentType;
  readonly displayName: string;
  readonly description: string;
  readonly defaultVersion: string;
  readonly recommendedSections: ReadonlyArray<string>;
  readonly recommendedRequiredFields: ReadonlyArray<string>;
  readonly active: boolean;
}

export type OfficialTemplateCatalog = ReadonlyArray<OfficialTemplateCatalogEntry>;

export interface OfficialTemplateCatalogSummary {
  readonly totalEntries: number;
  readonly activeEntries: number;
  readonly inactiveEntries: number;
}

const catalogSource: ReadonlyArray<OfficialTemplateCatalogEntry> = [
  {
    documentType: OfficialTemplateCatalogDocumentType.MeasurementBulletin,
    displayName: "Boletim de Medicao",
    description: "Registro periodico do avanco fisico e financeiro dos servicos executados em uma obra.",
    defaultVersion: "1.0.0",
    recommendedSections: ["Identificacao da Obra", "Itens Medidos", "Totais", "Assinaturas"],
    recommendedRequiredFields: ["Responsavel Tecnico", "Periodo de Medicao"],
    active: true,
  },
  {
    documentType: OfficialTemplateCatalogDocumentType.PhotoReport,
    displayName: "Relatorio Fotografico",
    description: "Compilacao de registros fotograficos datados que evidenciam a execucao dos servicos.",
    defaultVersion: "1.0.0",
    recommendedSections: ["Identificacao da Obra", "Registros Fotograficos"],
    recommendedRequiredFields: ["Data do Registro"],
    active: true,
  },
  {
    documentType: OfficialTemplateCatalogDocumentType.TechnicalReport,
    displayName: "Relatorio Tecnico",
    description: "Descricao tecnica detalhada de uma situacao, servico ou condicao observada em campo.",
    defaultVersion: "1.0.0",
    recommendedSections: ["Identificacao", "Analise Tecnica", "Conclusao"],
    recommendedRequiredFields: ["Responsavel Tecnico"],
    active: true,
  },
  {
    documentType: OfficialTemplateCatalogDocumentType.WorkOrder,
    displayName: "Ordem de Servico",
    description: "Instrumento formal que autoriza e delimita o inicio da execucao de um servico ou obra.",
    defaultVersion: "1.0.0",
    recommendedSections: ["Identificacao do Contrato", "Escopo Autorizado"],
    recommendedRequiredFields: ["Data de Emissao"],
    active: true,
  },
  {
    documentType: OfficialTemplateCatalogDocumentType.ReceivingTerm,
    displayName: "Termo de Recebimento",
    description: "Documento que formaliza a aceitacao, provisoria ou definitiva, do objeto contratado.",
    defaultVersion: "1.0.0",
    recommendedSections: ["Identificacao do Contrato", "Condicoes de Recebimento"],
    recommendedRequiredFields: ["Data de Recebimento"],
    active: true,
  },
  {
    documentType: OfficialTemplateCatalogDocumentType.TechnicalOpinion,
    displayName: "Parecer Tecnico",
    description: "Manifestacao tecnica fundamentada emitida por um responsavel qualificado sobre um assunto especifico.",
    defaultVersion: "1.0.0",
    recommendedSections: ["Identificacao", "Fundamentacao", "Conclusao"],
    recommendedRequiredFields: ["Responsavel Tecnico"],
    active: true,
  },
  {
    documentType: OfficialTemplateCatalogDocumentType.OfficialLetter,
    displayName: "Oficio",
    description: "Correspondencia oficial usada para comunicacao formal entre partes de um processo administrativo.",
    defaultVersion: "1.0.0",
    recommendedSections: ["Cabecalho", "Corpo do Texto", "Fecho"],
    recommendedRequiredFields: ["Destinatario"],
    active: true,
  },
  {
    documentType: OfficialTemplateCatalogDocumentType.ProjectCover,
    displayName: "Capa de Projeto",
    description: "Folha de rosto que identifica um processo, contrato ou projeto e seus dados administrativos basicos.",
    defaultVersion: "1.0.0",
    recommendedSections: ["Identificacao do Processo"],
    recommendedRequiredFields: ["Numero do Processo"],
    active: true,
  },
  {
    documentType: OfficialTemplateCatalogDocumentType.ExecutionReport,
    displayName: "Relatorio de Execucao",
    description: "Consolidacao periodica do andamento fisico da execucao de uma obra ou servico.",
    defaultVersion: "1.0.0",
    recommendedSections: ["Identificacao da Obra", "Avanco Fisico", "Observacoes"],
    recommendedRequiredFields: ["Periodo de Referencia"],
    active: true,
  },
  {
    documentType: OfficialTemplateCatalogDocumentType.Checklist,
    displayName: "Checklist",
    description: "Lista estruturada de itens de verificacao usada para conferencia sistematica de conformidade.",
    defaultVersion: "1.0.0",
    recommendedSections: ["Itens de Verificacao"],
    recommendedRequiredFields: ["Responsavel pela Verificacao"],
    active: false,
  },
  {
    documentType: OfficialTemplateCatalogDocumentType.InspectionReport,
    displayName: "Relatorio de Inspecao",
    description: "Registro formal das observacoes e constatacoes feitas durante uma inspecao tecnica.",
    defaultVersion: "1.0.0",
    recommendedSections: ["Identificacao", "Constatacoes", "Recomendacoes"],
    recommendedRequiredFields: ["Data da Inspecao"],
    active: true,
  },
  {
    documentType: OfficialTemplateCatalogDocumentType.FieldReport,
    displayName: "Relatorio de Campo",
    description: "Registro descritivo de observacoes coletadas diretamente no local de execucao dos servicos.",
    defaultVersion: "1.0.0",
    recommendedSections: ["Identificacao", "Observacoes de Campo"],
    recommendedRequiredFields: ["Data da Visita"],
    active: true,
  },
];

export function getOfficialTemplateCatalog(): OfficialTemplateCatalog {
  return buildCatalog();
}

export function findOfficialTemplateCatalogEntry(
  documentType: OfficialTemplateCatalogDocumentType,
): OfficialTemplateCatalogEntry | null {
  const entry = buildCatalog().find((candidate) => candidate.documentType === documentType);
  return entry ?? null;
}

export function listActiveOfficialTemplateCatalogEntries(): OfficialTemplateCatalog {
  return buildCatalog().filter((entry) => entry.active);
}

export function isSupportedOfficialDocumentType(value: string): boolean {
  return catalogSource.some((entry) => entry.documentType === value);
}

export function summarizeOfficialTemplateCatalog(): OfficialTemplateCatalogSummary {
  const catalog = buildCatalog();
  const activeEntries = catalog.filter((entry) => entry.active).length;

  return {
    totalEntries: catalog.length,
    activeEntries,
    inactiveEntries: catalog.length - activeEntries,
  };
}

function buildCatalog(): OfficialTemplateCatalog {
  const sorted = [...catalogSource].sort((left, right) =>
    left.documentType.localeCompare(right.documentType),
  );

  return freezeDomainObject<OfficialTemplateCatalog>(sorted);
}

