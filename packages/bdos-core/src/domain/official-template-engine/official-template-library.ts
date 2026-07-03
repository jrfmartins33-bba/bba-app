/**
 * Read-only library of reusable official template models. Each entry
 * pairs a document type already known to the catalog (Sprint 11.5.3)
 * with a structural composition (Sprint 11.5.4) and descriptive
 * metadata. The library does not fill in a document, does not know
 * about contracts or engineering, and offers no way to add, update or
 * remove entries at runtime — it is a static, self-validating, purely
 * read-only catalog of *models*.
 *
 * Referencing `official-template-catalog.ts` and
 * `official-template-composition.ts` is intra-domain composition, not
 * cross-domain integration: both are siblings inside
 * `official-template-engine/` and were built precisely to be referenced
 * this way. `official-template-shared.ts` (immutability/blank-string
 * helpers) is the same kind of sibling. Nothing outside this domain is
 * imported.
 */
import {
  OfficialTemplateCatalogDocumentType,
  isSupportedOfficialDocumentType,
} from "./official-template-catalog";
import {
  OfficialTemplateBlockType,
  validateOfficialTemplateComposition,
  type OfficialTemplateBlock,
  type OfficialTemplateComposition,
} from "./official-template-composition";
import { freezeDomainObject, isBlank } from "./official-template-shared";

export interface OfficialTemplateLibraryEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly documentType: OfficialTemplateCatalogDocumentType;
  readonly version: string;
  readonly composition: OfficialTemplateComposition;
  readonly tags: ReadonlyArray<string>;
  readonly active: boolean;
}

export type OfficialTemplateLibrary = ReadonlyArray<OfficialTemplateLibraryEntry>;

export interface OfficialTemplateLibrarySummary {
  readonly totalEntries: number;
  readonly activeEntries: number;
  readonly inactiveEntries: number;
  readonly documentTypesCovered: number;
}

export function getOfficialTemplateLibrary(): OfficialTemplateLibrary {
  return buildLibrary();
}

export function findOfficialTemplateLibraryEntry(id: string): OfficialTemplateLibraryEntry | null {
  const entry = buildLibrary().find((candidate) => candidate.id === id);
  return entry ?? null;
}

export function listActiveOfficialTemplateLibrary(): OfficialTemplateLibrary {
  return Object.freeze(buildLibrary().filter((entry) => entry.active));
}

export function listTemplatesByDocumentType(
  documentType: OfficialTemplateCatalogDocumentType,
): OfficialTemplateLibrary {
  return Object.freeze(buildLibrary().filter((entry) => entry.documentType === documentType));
}

export function summarizeOfficialTemplateLibrary(): OfficialTemplateLibrarySummary {
  const library = buildLibrary();
  const activeEntries = library.filter((entry) => entry.active).length;
  const documentTypesCovered = new Set(library.map((entry) => entry.documentType)).size;

  return {
    totalEntries: library.length,
    activeEntries,
    inactiveEntries: library.length - activeEntries,
    documentTypesCovered,
  };
}

function staticBlock(
  id: string,
  type: OfficialTemplateBlockType,
  name: string,
  order: number,
  required: boolean,
): OfficialTemplateBlock {
  return { id, type, name, order, required, repeatable: false, children: [] };
}

const librarySource: ReadonlyArray<OfficialTemplateLibraryEntry> = [
  {
    id: "lib-measurement-bulletin-v1",
    name: "Boletim de Medicao Padrao",
    description: "Modelo reutilizavel para o registro periodico do avanco fisico e financeiro de uma obra.",
    documentType: OfficialTemplateCatalogDocumentType.MeasurementBulletin,
    version: "1.0.0",
    tags: ["medicao", "obra"],
    active: true,
    composition: {
      rootBlocks: [
        staticBlock("block-header", OfficialTemplateBlockType.Header, "Cabecalho", 1, true),
        staticBlock("block-measurement-table", OfficialTemplateBlockType.MeasurementTable, "Tabela de Medicao", 2, true),
        staticBlock("block-signature", OfficialTemplateBlockType.Signature, "Assinaturas", 3, true),
      ],
    },
  },
  {
    id: "lib-photo-report-v1",
    name: "Relatorio Fotografico Padrao",
    description: "Modelo reutilizavel para compilar registros fotograficos datados de uma obra.",
    documentType: OfficialTemplateCatalogDocumentType.PhotoReport,
    version: "1.0.0",
    tags: ["fotos", "evidencia"],
    active: true,
    composition: {
      rootBlocks: [
        staticBlock("block-header", OfficialTemplateBlockType.Header, "Cabecalho", 1, true),
        staticBlock("block-photo-gallery", OfficialTemplateBlockType.PhotoGallery, "Galeria de Fotos", 2, true),
        staticBlock("block-footer", OfficialTemplateBlockType.Footer, "Rodape", 3, false),
      ],
    },
  },
  {
    id: "lib-technical-report-v1",
    name: "Relatorio Tecnico Padrao",
    description: "Modelo reutilizavel para descricao tecnica detalhada de uma situacao observada em campo.",
    documentType: OfficialTemplateCatalogDocumentType.TechnicalReport,
    version: "1.0.0",
    tags: ["tecnico"],
    active: true,
    composition: {
      rootBlocks: [
        staticBlock("block-header", OfficialTemplateBlockType.Header, "Cabecalho", 1, true),
        staticBlock("block-text", OfficialTemplateBlockType.Text, "Analise Tecnica", 2, true),
        staticBlock("block-signature", OfficialTemplateBlockType.Signature, "Assinaturas", 3, true),
      ],
    },
  },
  {
    id: "lib-work-order-v1",
    name: "Ordem de Servico Padrao",
    description: "Modelo reutilizavel para o instrumento formal que autoriza o inicio da execucao de um servico.",
    documentType: OfficialTemplateCatalogDocumentType.WorkOrder,
    version: "1.0.0",
    tags: ["ordem-de-servico"],
    active: true,
    composition: {
      rootBlocks: [
        staticBlock("block-header", OfficialTemplateBlockType.Header, "Cabecalho", 1, true),
        staticBlock("block-execution-info", OfficialTemplateBlockType.ExecutionInformation, "Escopo Autorizado", 2, true),
        staticBlock("block-signature", OfficialTemplateBlockType.Signature, "Assinaturas", 3, true),
      ],
    },
  },
  {
    id: "lib-receiving-term-v1",
    name: "Termo de Recebimento Padrao",
    description: "Modelo reutilizavel para formalizar a aceitacao provisoria ou definitiva do objeto contratado.",
    documentType: OfficialTemplateCatalogDocumentType.ReceivingTerm,
    version: "1.0.0",
    tags: ["recebimento"],
    active: true,
    composition: {
      rootBlocks: [
        staticBlock("block-header", OfficialTemplateBlockType.Header, "Cabecalho", 1, true),
        staticBlock("block-observation", OfficialTemplateBlockType.Observation, "Condicoes de Recebimento", 2, true),
        staticBlock("block-signature", OfficialTemplateBlockType.Signature, "Assinaturas", 3, true),
      ],
    },
  },
  {
    id: "lib-technical-opinion-v1",
    name: "Parecer Tecnico Padrao",
    description: "Modelo reutilizavel para uma manifestacao tecnica fundamentada sobre um assunto especifico.",
    documentType: OfficialTemplateCatalogDocumentType.TechnicalOpinion,
    version: "1.0.0",
    tags: ["parecer"],
    active: true,
    composition: {
      rootBlocks: [
        staticBlock("block-header", OfficialTemplateBlockType.Header, "Cabecalho", 1, true),
        staticBlock("block-text", OfficialTemplateBlockType.Text, "Fundamentacao e Conclusao", 2, true),
        staticBlock("block-signature", OfficialTemplateBlockType.Signature, "Assinaturas", 3, true),
      ],
    },
  },
  {
    id: "lib-official-letter-v1",
    name: "Oficio Padrao",
    description: "Modelo reutilizavel para correspondencia oficial entre partes de um processo administrativo.",
    documentType: OfficialTemplateCatalogDocumentType.OfficialLetter,
    version: "1.0.0",
    tags: ["correspondencia"],
    active: true,
    composition: {
      rootBlocks: [
        staticBlock("block-header", OfficialTemplateBlockType.Header, "Cabecalho", 1, true),
        staticBlock("block-text", OfficialTemplateBlockType.Text, "Corpo do Texto", 2, true),
        staticBlock("block-footer", OfficialTemplateBlockType.Footer, "Fecho", 3, true),
      ],
    },
  },
  {
    id: "lib-project-cover-v1",
    name: "Capa de Projeto Padrao",
    description: "Modelo reutilizavel para a folha de rosto que identifica um processo ou projeto.",
    documentType: OfficialTemplateCatalogDocumentType.ProjectCover,
    version: "1.0.0",
    tags: ["capa"],
    active: true,
    composition: {
      rootBlocks: [
        staticBlock("block-header", OfficialTemplateBlockType.Header, "Cabecalho", 1, true),
        staticBlock("block-project-info", OfficialTemplateBlockType.ProjectInformation, "Identificacao do Processo", 2, true),
      ],
    },
  },
  {
    id: "lib-execution-report-v1",
    name: "Relatorio de Execucao Padrao",
    description: "Modelo reutilizavel para consolidacao periodica do andamento fisico de uma obra.",
    documentType: OfficialTemplateCatalogDocumentType.ExecutionReport,
    version: "1.0.0",
    tags: ["execucao"],
    active: true,
    composition: {
      rootBlocks: [
        staticBlock("block-header", OfficialTemplateBlockType.Header, "Cabecalho", 1, true),
        staticBlock("block-execution-info", OfficialTemplateBlockType.ExecutionInformation, "Avanco Fisico", 2, true),
        staticBlock("block-text", OfficialTemplateBlockType.Text, "Observacoes", 3, false),
      ],
    },
  },
  {
    id: "lib-checklist-v1",
    name: "Checklist Padrao",
    description: "Modelo reutilizavel para lista estruturada de itens de verificacao de conformidade.",
    documentType: OfficialTemplateCatalogDocumentType.Checklist,
    version: "1.0.0",
    tags: ["checklist"],
    active: false,
    composition: {
      rootBlocks: [
        staticBlock("block-header", OfficialTemplateBlockType.Header, "Cabecalho", 1, true),
        staticBlock("block-text", OfficialTemplateBlockType.Text, "Itens de Verificacao", 2, true),
        staticBlock("block-signature", OfficialTemplateBlockType.Signature, "Assinaturas", 3, true),
      ],
    },
  },
  {
    id: "lib-inspection-report-v1",
    name: "Relatorio de Inspecao Padrao",
    description: "Modelo reutilizavel para o registro formal de constatacoes de uma inspecao tecnica.",
    documentType: OfficialTemplateCatalogDocumentType.InspectionReport,
    version: "1.0.0",
    tags: ["inspecao"],
    active: true,
    composition: {
      rootBlocks: [
        staticBlock("block-header", OfficialTemplateBlockType.Header, "Cabecalho", 1, true),
        staticBlock("block-observation", OfficialTemplateBlockType.Observation, "Constatacoes", 2, true),
        staticBlock("block-signature", OfficialTemplateBlockType.Signature, "Assinaturas", 3, true),
      ],
    },
  },
  {
    id: "lib-field-report-v1",
    name: "Relatorio de Campo Padrao",
    description: "Modelo reutilizavel para o registro descritivo de observacoes coletadas em campo.",
    documentType: OfficialTemplateCatalogDocumentType.FieldReport,
    version: "1.0.0",
    tags: ["campo"],
    active: true,
    composition: {
      rootBlocks: [
        staticBlock("block-header", OfficialTemplateBlockType.Header, "Cabecalho", 1, true),
        staticBlock("block-observation", OfficialTemplateBlockType.Observation, "Observacoes de Campo", 2, true),
      ],
    },
  },
];

function buildLibrary(): OfficialTemplateLibrary {
  const sorted = [...librarySource].sort((left, right) => left.name.localeCompare(right.name));
  const validationErrors = validateLibrarySource(sorted);

  if (validationErrors.length > 0) {
    throw new Error(
      `Official Template Library failed to build due to invalid static data: ${validationErrors.join("; ")}`,
    );
  }

  return freezeDomainObject<OfficialTemplateLibrary>(sorted);
}

function validateLibrarySource(entries: ReadonlyArray<OfficialTemplateLibraryEntry>): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  entries.forEach((entry) => {
    if (isBlank(entry.id)) {
      errors.push("A library entry has a blank id.");
    } else if (seenIds.has(entry.id)) {
      errors.push(`Duplicate library entry id: ${entry.id}.`);
    } else {
      seenIds.add(entry.id);
    }

    if (isBlank(entry.name)) {
      errors.push(`Library entry ${entry.id} has a blank name.`);
    } else if (seenNames.has(entry.name)) {
      errors.push(`Duplicate library entry name: ${entry.name}.`);
    } else {
      seenNames.add(entry.name);
    }

    if (isBlank(entry.description)) {
      errors.push(`Library entry ${entry.id} has a blank description.`);
    }

    if (isBlank(entry.version)) {
      errors.push(`Library entry ${entry.id} has a blank version.`);
    }

    if (!Array.isArray(entry.tags)) {
      errors.push(`Library entry ${entry.id} has a null or invalid tags collection.`);
    }

    if (!isSupportedOfficialDocumentType(entry.documentType)) {
      errors.push(`Library entry ${entry.id} references a document type unknown to the catalog: ${entry.documentType}.`);
    }

    const compositionResult = validateOfficialTemplateComposition(entry.composition);
    if (!compositionResult.valid) {
      const compositionMessages = compositionResult.errors.map((error) => error.message).join(", ");
      errors.push(`Library entry ${entry.id} has an invalid composition: ${compositionMessages}.`);
    }
  });

  return errors;
}

