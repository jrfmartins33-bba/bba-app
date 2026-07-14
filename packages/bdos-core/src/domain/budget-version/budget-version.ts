import { ProcurementScopeKind, isWellFormedProcurementScope } from "../procurement-case";
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
  RegisterLineageRelationInput,
  RemoveBudgetLineInput,
  UpdateBudgetLineInput,
  UpdateBudgetLinePositionInput,
} from "./budget-version.types";
import { BudgetLineKind, BudgetVersionStatus, LineageRelationNature } from "./budget-version.types";

export function createBudgetVersion(input: CreateBudgetVersionInput): BudgetVersionResult {
  const metadata = createVersionMetadata(input);
  const errors: BudgetVersionError[] = [];

  if (isBlank(input.id)) {
    errors.push(createVersionError("missing_id", "id", "Identity is required.", metadata));
  }

  if (isBlank(input.organizationId)) {
    errors.push(createVersionError("missing_organization_id", "organizationId", "Organization id is required.", metadata));
  }

  if (isBlank(input.procurementCaseId)) {
    errors.push(
      createVersionError("missing_procurement_case_id", "procurementCaseId", "Processo de Licitação e Contratação id is required.", metadata),
    );
  }

  if (!isWellFormedProcurementScope(input.scope)) {
    errors.push(createVersionError("malformed_scope", "scope", "Escopo da Licitação must be a well-formed WholeCase or Lot scope.", metadata));
  } else if (!isBlank(input.procurementCaseId) && input.scope.procurementCaseId !== input.procurementCaseId) {
    errors.push(
      createVersionError(
        "scope_case_mismatch",
        "scope",
        "The Escopo da Licitação must belong to the same Processo de Licitação e Contratação as the Versão do Orçamento.",
        metadata,
      ),
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
 * Registro posterior (ou substituição) da origem/Relação de Rastreabilidade
 * da Versão — somente em rascunho (mapa §13). Substitui `originLineage` por
 * um novo registro; não acumula uma coleção de relações nesta Sprint.
 */
export function registerLineageRelation(input: RegisterLineageRelationInput): BudgetVersionResult {
  const { budgetVersion } = input;
  const metadata: BudgetVersionMetadata = { ...budgetVersion.metadata, budgetVersionId: budgetVersion.id };

  if (budgetVersion.status === BudgetVersionStatus.Consolidated) {
    return immutableVersionFailure(budgetVersion, "budgetVersion", metadata);
  }

  if (input.origin.kind === "DocumentaryOpaqueReference" && isBlank(input.origin.reference)) {
    return freezeDomainObject<BudgetVersionFailure>({
      success: false,
      budgetVersion: null,
      errors: [
        createVersionError("invalid_origin_reference", "origin.reference", "Documentary opaque reference must not be blank.", metadata),
      ],
      warnings: [],
      metadata,
    });
  }

  const originLineage: LineageRelation = {
    id: `${budgetVersion.id}-origin-lineage`,
    organizationId: budgetVersion.organizationId,
    nature: LineageRelationNature.Origin,
    origin: input.origin,
    destinationBudgetVersionId: budgetVersion.id,
    metadata,
  };

  return freezeDomainObject<BudgetVersionSuccess>({
    success: true,
    budgetVersion: { ...budgetVersion, originLineage },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Adiciona uma Linha do Orçamento — somente permitido enquanto a Versão
 * estiver em rascunho (ADR-003 §F.2). Grupo nunca possui pai; Subgrupo
 * sempre possui Grupo como pai; Item de Serviço possui Grupo ou Subgrupo
 * como pai. Código externo é sempre opcional — o caso real `COT-015` (Item
 * de Serviço sem código) é representável sem exceção especial.
 */
export function addBudgetLine(input: AddBudgetLineInput): BudgetVersionResult {
  const { budgetVersion } = input;
  const metadata = createLineMetadata(input);

  if (budgetVersion.status === BudgetVersionStatus.Consolidated) {
    return immutableVersionFailure(budgetVersion, "budgetVersion", metadata);
  }

  const errors: BudgetVersionError[] = [];

  if (isBlank(input.id)) {
    errors.push(createVersionError("missing_id", "id", "Identity is required.", metadata));
  }

  if (isBlank(input.description)) {
    errors.push(createVersionError("missing_description", "description", "Description is required.", metadata));
  }

  if (budgetVersion.lines.some((line) => line.id === input.id)) {
    errors.push(createVersionError("duplicate_line_id", "id", `A line with id "${input.id}" already exists in this version.`, metadata));
  }

  if (input.parentLineId === input.id) {
    errors.push(createVersionError("self_parent", "parentLineId", "A line cannot be its own parent.", metadata));
  }

  const parentErrors = validateParent(budgetVersion, input.kind, input.parentLineId ?? null, metadata);
  errors.push(...parentErrors);

  if (!isWellFormedProcurementScope(input.scope)) {
    errors.push(createVersionError("malformed_scope", "scope", "Escopo da Licitação must be a well-formed WholeCase or Lot scope.", metadata));
  } else {
    errors.push(...validateLineScope(budgetVersion.scope, input.scope, metadata));
    errors.push(...validateParentChildScope(budgetVersion, input.parentLineId ?? null, input.scope, metadata));
  }

  const totalErrors = validateLineTotal(input.kind, input.totalCents, metadata);
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

/**
 * Alteração controlada de campos de uma Linha existente (descrição, código
 * externo, escopo, total) — somente em rascunho. Reaplica as mesmas
 * validações de `addBudgetLine` para os campos alterados (compatibilidade
 * de escopo com a Versão e com o pai, validade do total econômico).
 */
export function updateBudgetLine(input: UpdateBudgetLineInput): BudgetVersionResult {
  const { budgetVersion, lineId } = input;
  const metadata: BudgetVersionMetadata = { ...budgetVersion.metadata, budgetVersionId: budgetVersion.id, lineId };

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

  const errors: BudgetVersionError[] = [];

  if (input.description !== undefined && isBlank(input.description)) {
    errors.push(createVersionError("missing_description", "description", "Description is required.", metadata));
  }

  const nextScope = input.scope ?? target.scope;

  if (input.scope !== undefined) {
    if (!isWellFormedProcurementScope(input.scope)) {
      errors.push(createVersionError("malformed_scope", "scope", "Escopo da Licitação must be a well-formed WholeCase or Lot scope.", metadata));
    } else {
      errors.push(...validateLineScope(budgetVersion.scope, input.scope, metadata));
      errors.push(...validateParentChildScope(budgetVersion, target.parentLineId, input.scope, metadata));
      errors.push(...validateChildrenScopeAgainstNewParentScope(budgetVersion, lineId, input.scope, metadata));
    }
  }

  const nextTotalCents = input.totalCents !== undefined ? input.totalCents : target.totalCents;
  errors.push(...validateLineTotal(target.kind, nextTotalCents, metadata));

  if (errors.length > 0) {
    return freezeDomainObject<BudgetVersionFailure>({
      success: false,
      budgetVersion: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  const updatedLine: BudgetLine = {
    ...target,
    description: input.description ?? target.description,
    externalCode: input.externalCode !== undefined ? input.externalCode : target.externalCode,
    scope: nextScope,
    totalCents: target.kind === BudgetLineKind.ServiceItem ? nextTotalCents : null,
  };

  return freezeDomainObject<BudgetVersionSuccess>({
    success: true,
    budgetVersion: {
      ...budgetVersion,
      lines: budgetVersion.lines.map((line) => (line.id === lineId ? updatedLine : line)),
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Remoção controlada de uma Linha — somente em rascunho, e somente quando a
 * Linha não possui filhos (remover uma Linha com descendentes exige
 * removê-los primeiro; nenhuma remoção em cascata é inventada aqui).
 */
export function removeBudgetLine(input: RemoveBudgetLineInput): BudgetVersionResult {
  const { budgetVersion, lineId } = input;
  const metadata: BudgetVersionMetadata = { ...budgetVersion.metadata, budgetVersionId: budgetVersion.id, lineId };

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

  const hasChildren = budgetVersion.lines.some((line) => line.parentLineId === lineId);

  if (hasChildren) {
    return freezeDomainObject<BudgetVersionFailure>({
      success: false,
      budgetVersion: null,
      errors: [
        createVersionError("line_has_children", "lineId", `Line "${lineId}" has children and cannot be removed before they are.`, metadata),
      ],
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<BudgetVersionSuccess>({
    success: true,
    budgetVersion: {
      ...budgetVersion,
      lines: budgetVersion.lines.filter((line) => line.id !== lineId),
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
 * Consolidação explícita (ADR-003 §F.2). Reinvocar sobre uma versão já
 * consolidada apenas a retorna inalterada — um no-op de nível de domínio
 * (nunca cria uma nova versão, nunca lança erro). Isso é uma salvaguarda de
 * domínio, não um mecanismo físico de idempotência: não envolve execução
 * concorrente, identificador de execução, nem persistência — a questão de
 * idempotência física (ex.: duas requisições de consolidação simultâneas
 * contra o mesmo registro persistido) pertence à Sprint 21.3C.
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

function validateParent(
  budgetVersion: BudgetVersion,
  kind: BudgetLineKind,
  parentLineId: BudgetLine["id"] | null,
  metadata: BudgetVersionMetadata,
): ReadonlyArray<BudgetVersionError> {
  if (kind === BudgetLineKind.Group) {
    if (parentLineId !== null) {
      return [createVersionError("incompatible_parent_kind", "parentLineId", "Grupo must not have a parent line.", metadata)];
    }
    return [];
  }

  if (parentLineId === null) {
    return [createVersionError("missing_parent_line", "parentLineId", `${kind} requires a parent line.`, metadata)];
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

  if (kind === BudgetLineKind.Subgroup && parent.kind !== BudgetLineKind.Group) {
    return [createVersionError("incompatible_parent_kind", "parentLineId", "Subgrupo must have a Grupo as parent.", metadata)];
  }

  if (kind === BudgetLineKind.ServiceItem && parent.kind !== BudgetLineKind.Group && parent.kind !== BudgetLineKind.Subgroup) {
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
 * (`createLotScope`), consultado antes desta chamada. A mesma função
 * também governa a compatibilidade de Escopo entre uma Linha-pai e sua
 * Linha-filha (o Escopo do pai age como teto, exatamente como o Escopo da
 * Versão age como teto para uma Linha de nível superior).
 */
function isScopeCompatible(ceilingScope: ProcurementScope, candidateScope: ProcurementScope): boolean {
  if (candidateScope.procurementCaseId !== ceilingScope.procurementCaseId) {
    return false;
  }

  if (ceilingScope.kind === ProcurementScopeKind.WholeCase) {
    return true;
  }

  return candidateScope.kind === ProcurementScopeKind.Lot && candidateScope.procurementLotId === ceilingScope.procurementLotId;
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

/** Compatibilidade de Escopo entre pai e filho: o Escopo do pai é o teto do filho. */
function validateParentChildScope(
  budgetVersion: BudgetVersion,
  parentLineId: BudgetLine["id"] | null,
  childScope: ProcurementScope,
  metadata: BudgetVersionMetadata,
): ReadonlyArray<BudgetVersionError> {
  if (parentLineId === null) {
    return [];
  }

  const parent = budgetVersion.lines.find((line) => line.id === parentLineId);

  if (parent === undefined || !isScopeCompatible(parent.scope, childScope)) {
    if (parent === undefined) {
      return [];
    }
    return [
      createVersionError(
        "child_scope_incompatible_with_parent",
        "scope",
        "The line's Escopo da Licitação is not compatible with its parent line's Escopo.",
        metadata,
      ),
    ];
  }

  return [];
}

/** Ao alterar o Escopo de uma Linha, seus filhos existentes precisam continuar compatíveis. */
function validateChildrenScopeAgainstNewParentScope(
  budgetVersion: BudgetVersion,
  lineId: BudgetLine["id"],
  newScope: ProcurementScope,
  metadata: BudgetVersionMetadata,
): ReadonlyArray<BudgetVersionError> {
  const incompatibleChild = budgetVersion.lines.find(
    (line) => line.parentLineId === lineId && !isScopeCompatible(newScope, line.scope),
  );

  if (incompatibleChild === undefined) {
    return [];
  }

  return [
    createVersionError(
      "child_scope_incompatible_with_parent",
      "scope",
      `Changing this line's Escopo would make existing child line "${incompatibleChild.id}" incompatible.`,
      metadata,
    ),
  ];
}

function validateLineTotal(
  kind: BudgetLineKind,
  totalCents: MoneyCents | null | undefined,
  metadata: BudgetVersionMetadata,
): ReadonlyArray<BudgetVersionError> {
  if (kind !== BudgetLineKind.ServiceItem) {
    if (totalCents !== undefined && totalCents !== null) {
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

  if (totalCents === undefined || totalCents === null || !isValidMoneyCents(totalCents)) {
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
