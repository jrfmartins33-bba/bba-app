import { ProcurementScopeKind } from "../procurement-case";
import type { ProcurementScope } from "../procurement-case";
import { isValidMoneyCents, sumCents } from "./budget-version-money";
import type { MoneyCents } from "./budget-version-money";
import type {
  AddBudgetLineInput,
  BudgetLine,
  BudgetVersion,
  BudgetVersionError,
  BudgetVersionErrorCode,
  BudgetVersionFailure,
  BudgetVersionMetadata,
  BudgetVersionResult,
  BudgetVersionSuccess,
  ConsolidateBudgetVersionInput,
  CreateBudgetVersionInput,
  LineageRelation,
  UpdateBudgetLinePositionInput,
} from "./budget-version.types";
import { BudgetLineKind, BudgetVersionStatus, LineageRelationNature } from "./budget-version.types";

export function createBudgetVersion(input: CreateBudgetVersionInput): BudgetVersionResult {
  const metadata = createVersionMetadata(input);
  const errors: BudgetVersionError[] = [];

  if (isBlank(input.organizationId)) {
    errors.push(createVersionError("missing_organization_id", "organizationId", "Organization id is required.", metadata));
  }

  if (isBlank(input.procurementCaseId)) {
    errors.push(
      createVersionError("missing_procurement_case_id", "procurementCaseId", "Processo de Licitação e Contratação id is required.", metadata),
    );
  }

  if (input.origin.kind === "DocumentaryOpaqueReference" && isBlank(input.origin.reference)) {
    errors.push(
      createVersionError("invalid_origin_reference", "origin.reference", "Documentary opaque reference must not be blank.", metadata),
    );
  }

  if (errors.length > 0) {
    return freezeDomainObject<BudgetVersionFailure>({
      success: false,
      budgetVersion: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  const originLineage: LineageRelation = {
    id: `${input.id}-origin-lineage`,
    organizationId: input.organizationId,
    nature: LineageRelationNature.Origin,
    origin: input.origin,
    destinationBudgetVersionId: input.id,
    metadata,
  };

  return freezeDomainObject<BudgetVersionSuccess>({
    success: true,
    budgetVersion: {
      id: input.id,
      organizationId: input.organizationId,
      procurementCaseId: input.procurementCaseId,
      scope: input.scope,
      status: BudgetVersionStatus.Draft,
      originLineage,
      lines: [],
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Adiciona (ou reorganiza, via nova chamada) uma Linha do Orçamento —
 * somente permitido enquanto a Versão estiver em rascunho (ADR-003 §F.2).
 * Grupo nunca possui pai; Subgrupo sempre possui Grupo como pai; Item de
 * Serviço possui Grupo ou Subgrupo como pai. Código externo é sempre
 * opcional — o caso real `COT-015` (Item de Serviço sem código) é
 * representável sem exceção especial.
 */
export function addBudgetLine(input: AddBudgetLineInput): BudgetVersionResult {
  const { budgetVersion } = input;
  const metadata = createLineMetadata(input);

  if (budgetVersion.status === BudgetVersionStatus.Consolidated) {
    return immutableVersionFailure(budgetVersion, "budgetVersion", metadata);
  }

  const errors: BudgetVersionError[] = [];

  if (isBlank(input.description)) {
    errors.push(createVersionError("missing_description", "description", "Description is required.", metadata));
  }

  if (budgetVersion.lines.some((line) => line.id === input.id)) {
    errors.push(createVersionError("duplicate_line_id", "id", `A line with id "${input.id}" already exists in this version.`, metadata));
  }

  if (input.parentLineId === input.id) {
    errors.push(createVersionError("self_parent", "parentLineId", "A line cannot be its own parent.", metadata));
  }

  const parentErrors = validateParent(budgetVersion, input);
  errors.push(...parentErrors);

  const scopeErrors = validateLineScope(budgetVersion.scope, input.scope, metadata);
  errors.push(...scopeErrors);

  const totalErrors = validateLineTotal(input, metadata);
  errors.push(...totalErrors);

  if (budgetVersion.lines.some((line) => line.parentLineId === (input.parentLineId ?? null) && line.position === input.position)) {
    errors.push(
      createVersionError(
        "duplicate_position",
        "position",
        `Position ${input.position} is already used by a sibling line.`,
        metadata,
      ),
    );
  }

  if (errors.length > 0) {
    return freezeDomainObject<BudgetVersionFailure>({
      success: false,
      budgetVersion: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  const newLine: BudgetLine = {
    id: input.id,
    budgetVersionId: budgetVersion.id,
    kind: input.kind,
    description: input.description,
    externalCode: input.externalCode ?? null,
    parentLineId: input.parentLineId ?? null,
    position: input.position,
    scope: input.scope,
    totalCents: input.kind === BudgetLineKind.ServiceItem ? (input.totalCents ?? null) : null,
    metadata,
  };

  return freezeDomainObject<BudgetVersionSuccess>({
    success: true,
    budgetVersion: {
      ...budgetVersion,
      lines: [...budgetVersion.lines, newLine],
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/** Reordenação — permitida somente em rascunho (ADR-003 §F.2 / mapa §H). */
export function updateBudgetLinePosition(input: UpdateBudgetLinePositionInput): BudgetVersionResult {
  const { budgetVersion, lineId, position } = input;
  const metadata: BudgetVersionMetadata = { ...budgetVersion.metadata, lineId, position };

  if (budgetVersion.status === BudgetVersionStatus.Consolidated) {
    return immutableVersionFailure(budgetVersion, "budgetVersion", metadata);
  }

  const target = budgetVersion.lines.find((line) => line.id === lineId);

  if (target === undefined) {
    return freezeDomainObject<BudgetVersionFailure>({
      success: false,
      budgetVersion: null,
      errors: [createVersionError("unknown_line", "lineId", `No line with id "${lineId}" exists in this version.`, metadata)],
      warnings: [],
      metadata,
    });
  }

  const conflict = budgetVersion.lines.some(
    (line) => line.id !== lineId && line.parentLineId === target.parentLineId && line.position === position,
  );

  if (conflict) {
    return freezeDomainObject<BudgetVersionFailure>({
      success: false,
      budgetVersion: null,
      errors: [
        createVersionError("duplicate_position", "position", `Position ${position} is already used by a sibling line.`, metadata),
      ],
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<BudgetVersionSuccess>({
    success: true,
    budgetVersion: {
      ...budgetVersion,
      lines: budgetVersion.lines.map((line) => (line.id === lineId ? { ...line, position } : line)),
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Consolidação explícita (ADR-003 §F.2). Idempotente: consolidar uma versão
 * já consolidada apenas a retorna inalterada — nunca cria uma nova versão.
 */
export function consolidateBudgetVersion(input: ConsolidateBudgetVersionInput): BudgetVersionResult {
  const { budgetVersion } = input;
  const metadata: BudgetVersionMetadata = { ...budgetVersion.metadata, budgetVersionId: budgetVersion.id };

  if (budgetVersion.status === BudgetVersionStatus.Consolidated) {
    return freezeDomainObject<BudgetVersionSuccess>({
      success: true,
      budgetVersion,
      errors: [],
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<BudgetVersionSuccess>({
    success: true,
    budgetVersion: { ...budgetVersion, status: BudgetVersionStatus.Consolidated },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Ordenação estável entre irmãos — determinística por `position`, nunca
 * pela ordem de inserção no array.
 */
export function orderedChildren(lines: ReadonlyArray<BudgetLine>, parentLineId: BudgetLine["parentLineId"]): ReadonlyArray<BudgetLine> {
  return lines.filter((line) => line.parentLineId === parentLineId).slice().sort((a, b) => a.position - b.position);
}

/**
 * Totalização determinística (ADR-004 §não-duplicidade / mapa §12.3).
 * Somente Item de Serviço contribui como folha econômica; Grupo e Subgrupo
 * nunca são somados como parcelas independentes (evita dupla contagem por
 * construção). Quando `scope` é informado, respeita o Escopo consultado.
 */
export function calculateBudgetVersionTotal(budgetVersion: BudgetVersion, scope?: ProcurementScope): MoneyCents {
  const effectiveScope = scope ?? budgetVersion.scope;

  const applicableServiceItems = budgetVersion.lines.filter(
    (line) => line.kind === BudgetLineKind.ServiceItem && isScopeCompatible(effectiveScope, line.scope),
  );

  return sumCents(applicableServiceItems.map((line) => line.totalCents ?? 0));
}

/**
 * Total derivado de uma linha específica (Grupo ou Subgrupo), somando
 * recursivamente os Itens de Serviço descendentes. Nunca soma o total de um
 * Grupo/Subgrupo como se fosse, ele próprio, uma parcela — apenas os Itens
 * de Serviço são folhas econômicas.
 */
export function calculateLineTotal(lines: ReadonlyArray<BudgetLine>, lineId: BudgetLine["id"]): MoneyCents {
  const line = lines.find((candidate) => candidate.id === lineId);

  if (line === undefined) {
    return 0;
  }

  if (line.kind === BudgetLineKind.ServiceItem) {
    return line.totalCents ?? 0;
  }

  const children = lines.filter((candidate) => candidate.parentLineId === lineId);
  return sumCents(children.map((child) => calculateLineTotal(lines, child.id)));
}

/**
 * Detecção defensiva de ciclo hierárquico — nunca alcançável por
 * `addBudgetLine` (que só permite referenciar um pai já existente), mas
 * mantida como salvaguarda estrutural, no mesmo espírito defensivo já usado
 * em `schedule-management.calculateCriticalPath`.
 */
export function hasHierarchyCycle(lines: ReadonlyArray<BudgetLine>): boolean {
  const byId = new Map(lines.map((line) => [line.id, line]));

  return lines.some((line) => {
    const visited = new Set<string>([line.id]);
    let current = line.parentLineId;

    while (current !== null) {
      if (visited.has(current)) {
        return true;
      }

      visited.add(current);
      const parent = byId.get(current);
      current = parent?.parentLineId ?? null;
    }

    return false;
  });
}

function validateParent(budgetVersion: BudgetVersion, input: AddBudgetLineInput): ReadonlyArray<BudgetVersionError> {
  const metadata = createLineMetadata(input);
  const parentLineId = input.parentLineId ?? null;

  if (input.kind === BudgetLineKind.Group) {
    if (parentLineId !== null) {
      return [createVersionError("incompatible_parent_kind", "parentLineId", "Grupo must not have a parent line.", metadata)];
    }
    return [];
  }

  if (parentLineId === null) {
    return [createVersionError("missing_parent_line", "parentLineId", `${input.kind} requires a parent line.`, metadata)];
  }

  const parent = budgetVersion.lines.find((line) => line.id === parentLineId);

  if (parent === undefined) {
    return [createVersionError("missing_parent_line", "parentLineId", `No line with id "${parentLineId}" exists in this version.`, metadata)];
  }

  if (parent.budgetVersionId !== budgetVersion.id) {
    return [
      createVersionError("parent_from_another_version", "parentLineId", "The parent line belongs to a different Versão do Orçamento.", metadata),
    ];
  }

  if (input.kind === BudgetLineKind.Subgroup && parent.kind !== BudgetLineKind.Group) {
    return [createVersionError("incompatible_parent_kind", "parentLineId", "Subgrupo must have a Grupo as parent.", metadata)];
  }

  if (
    input.kind === BudgetLineKind.ServiceItem &&
    parent.kind !== BudgetLineKind.Group &&
    parent.kind !== BudgetLineKind.Subgroup
  ) {
    return [
      createVersionError("incompatible_parent_kind", "parentLineId", "Item de Serviço must have a Grupo or Subgrupo as parent.", metadata),
    ];
  }

  return [];
}

/**
 * Regras mínimas de aplicabilidade entre o Escopo da Versão e o Escopo da
 * Linha (mapa §11): mesmo Processo sempre exigido; Versão de processo
 * inteiro aceita linhas do processo inteiro ou de qualquer lote válido
 * daquele processo; Versão de lote só aceita linhas do mesmo lote. A
 * existência do próprio lote é responsabilidade de `procurement-case`
 * (`createLotScope`), consultado antes desta chamada.
 */
function isScopeCompatible(versionScope: ProcurementScope, lineScope: ProcurementScope): boolean {
  if (lineScope.procurementCaseId !== versionScope.procurementCaseId) {
    return false;
  }

  if (versionScope.kind === ProcurementScopeKind.WholeCase) {
    return true;
  }

  return lineScope.kind === ProcurementScopeKind.Lot && lineScope.procurementLotId === versionScope.procurementLotId;
}

function validateLineScope(
  versionScope: ProcurementScope,
  lineScope: ProcurementScope,
  metadata: BudgetVersionMetadata,
): ReadonlyArray<BudgetVersionError> {
  if (isScopeCompatible(versionScope, lineScope)) {
    return [];
  }

  return [
    createVersionError(
      "line_scope_incompatible",
      "scope",
      "The line's Escopo da Licitação is not compatible with the Versão do Orçamento's Escopo.",
      metadata,
    ),
  ];
}

function validateLineTotal(input: AddBudgetLineInput, metadata: BudgetVersionMetadata): ReadonlyArray<BudgetVersionError> {
  if (input.kind !== BudgetLineKind.ServiceItem) {
    if (input.totalCents !== undefined && input.totalCents !== null) {
      return [
        createVersionError(
          "invalid_total_cents",
          "totalCents",
          "Grupo and Subgrupo totals are always derived from descendants, never stored as their own parcel.",
          metadata,
        ),
      ];
    }
    return [];
  }

  if (input.totalCents === undefined || input.totalCents === null || !isValidMoneyCents(input.totalCents)) {
    return [
      createVersionError("invalid_total_cents", "totalCents", "Item de Serviço requires a valid non-negative integer totalCents.", metadata),
    ];
  }

  return [];
}

function immutableVersionFailure(budgetVersion: BudgetVersion, field: string, metadata: BudgetVersionMetadata): BudgetVersionFailure {
  return freezeDomainObject<BudgetVersionFailure>({
    success: false,
    budgetVersion: null,
    errors: [
      createVersionError(
        "consolidated_version_immutable",
        field,
        `Versão do Orçamento "${budgetVersion.id}" is consolidated and cannot be altered.`,
        metadata,
      ),
    ],
    warnings: [],
    metadata,
  });
}

function createVersionError(
  code: BudgetVersionErrorCode,
  field: string,
  message: string,
  metadata: BudgetVersionMetadata,
): BudgetVersionError {
  return { code, field, message, metadata };
}

function createVersionMetadata(input: CreateBudgetVersionInput): BudgetVersionMetadata {
  return {
    ...(input.metadata ?? {}),
    budgetVersionId: input.id,
    organizationId: input.organizationId,
    procurementCaseId: input.procurementCaseId,
    correlationId: input.correlationId,
    createdBy: input.createdBy,
    sourceSystem: input.sourceSystem,
  };
}

function createLineMetadata(input: AddBudgetLineInput): BudgetVersionMetadata {
  return {
    ...(input.metadata ?? {}),
    budgetVersionId: input.budgetVersion.id,
    lineId: input.id,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [key, cloneDomainValue(property)]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as Record<string, unknown>).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
