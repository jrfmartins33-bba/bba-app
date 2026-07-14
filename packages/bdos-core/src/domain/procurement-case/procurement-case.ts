import type {
  CreateLotScopeInput,
  CreateProcurementCaseFailure,
  CreateProcurementCaseInput,
  CreateProcurementCaseResult,
  CreateProcurementCaseSuccess,
  CreateProcurementLotFailure,
  CreateProcurementLotInput,
  CreateProcurementLotResult,
  CreateProcurementLotSuccess,
  CreateProcurementScopeFailure,
  CreateProcurementScopeResult,
  CreateProcurementScopeSuccess,
  CreateWholeCaseScopeInput,
  ProcurementCaseError,
  ProcurementCaseErrorCode,
  ProcurementCaseMetadata,
} from "./procurement-case.types";
import { ProcurementScopeKind } from "./procurement-case.types";
import type { ProcurementScope } from "./procurement-case.types";

export function createProcurementCase(input: CreateProcurementCaseInput): CreateProcurementCaseResult {
  const metadata = createCaseMetadata(input);
  const errors: ProcurementCaseError[] = [];

  if (isBlank(input.id)) {
    errors.push(createCaseError("missing_id", "id", "Identity is required.", metadata));
  }

  if (isBlank(input.organizationId)) {
    errors.push(createCaseError("missing_organization_id", "organizationId", "Organization id is required.", metadata));
  }

  if (isBlank(input.title)) {
    errors.push(createCaseError("missing_title", "title", "Title is required.", metadata));
  }

  if (errors.length > 0) {
    return freezeDomainObject<CreateProcurementCaseFailure>({
      success: false,
      procurementCase: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<CreateProcurementCaseSuccess>({
    success: true,
    procurementCase: {
      id: input.id,
      organizationId: input.organizationId,
      title: input.title,
      externalReference: input.externalReference ?? null,
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

export function createProcurementLot(input: CreateProcurementLotInput): CreateProcurementLotResult {
  const metadata = createLotMetadata(input);
  const errors: ProcurementCaseError[] = [];

  if (isBlank(input.id)) {
    errors.push(createCaseError("missing_id", "id", "Identity is required.", metadata));
  }

  if (input.procurementCase === undefined || input.procurementCase === null) {
    errors.push(
      createCaseError("missing_procurement_case", "procurementCase", "A Processo de Licitação e Contratação is required.", metadata),
    );
  }

  if (isBlank(input.title)) {
    errors.push(createCaseError("missing_title", "title", "Title is required.", metadata));
  }

  if (errors.length > 0) {
    return freezeDomainObject<CreateProcurementLotFailure>({
      success: false,
      procurementLot: null,
      errors,
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<CreateProcurementLotSuccess>({
    success: true,
    procurementLot: {
      id: input.id,
      procurementCaseId: input.procurementCase.id,
      organizationId: input.procurementCase.organizationId,
      title: input.title,
      externalReference: input.externalReference ?? null,
      metadata,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Escopo do processo inteiro — nunca exige um lote. É a representação
 * correta de "processo inteiro" (ADR-002 §K); nenhum `ProcurementLot`
 * artificial é criado para o mesmo fim.
 */
export function createWholeCaseScope(input: CreateWholeCaseScopeInput): CreateProcurementScopeResult {
  const metadata: ProcurementCaseMetadata = { procurementCaseId: input.procurementCase.id };

  return freezeDomainObject<CreateProcurementScopeSuccess>({
    success: true,
    scope: { kind: ProcurementScopeKind.WholeCase, procurementCaseId: input.procurementCase.id },
    errors: [],
    warnings: [],
    metadata,
  });
}

/** Escopo de um lote específico — o lote precisa pertencer ao mesmo Processo. */
export function createLotScope(input: CreateLotScopeInput): CreateProcurementScopeResult {
  const metadata: ProcurementCaseMetadata = {
    procurementCaseId: input.procurementCase.id,
    procurementLotId: input.procurementLot.id,
  };

  if (input.procurementLot.organizationId !== input.procurementCase.organizationId) {
    return freezeDomainObject<CreateProcurementScopeFailure>({
      success: false,
      scope: null,
      errors: [
        createCaseError(
          "organization_mismatch",
          "procurementLot",
          "A lot from a different organização usuária cannot define a scope for this case.",
          metadata,
        ),
      ],
      warnings: [],
      metadata,
    });
  }

  if (input.procurementLot.procurementCaseId !== input.procurementCase.id) {
    return freezeDomainObject<CreateProcurementScopeFailure>({
      success: false,
      scope: null,
      errors: [
        createCaseError(
          "invalid_scope_lot",
          "procurementLot",
          "A lot from a different Processo de Licitação e Contratação cannot define a scope for this case.",
          metadata,
        ),
      ],
      warnings: [],
      metadata,
    });
  }

  return freezeDomainObject<CreateProcurementScopeSuccess>({
    success: true,
    scope: {
      kind: ProcurementScopeKind.Lot,
      procurementCaseId: input.procurementCase.id,
      procurementLotId: input.procurementLot.id,
    },
    errors: [],
    warnings: [],
    metadata,
  });
}

/**
 * Proibição de Escopo estrutural arbitrário: um `ProcurementScope` só é
 * bem-formado quando corresponde exatamente a uma das duas formas
 * aprovadas — processo inteiro (`kind` + `procurementCaseId` não vazio,
 * nada mais) ou lote específico (`kind` + `procurementCaseId` +
 * `procurementLotId`, ambos não vazios, nada mais). Um valor com campos a
 * mais, a menos, em branco, ou de tipo incorreto — ainda que
 * estruturalmente compatível o suficiente para escapar à checagem de tipos
 * em algum ponto de passagem — é rejeitado em tempo de execução, não
 * apenas em tempo de compilação.
 *
 * Esta função é **apenas** validação estrutural: confirma a forma do
 * valor, não que o Processo existe, que o lote existe, que o lote
 * pertence ao Processo, ou que pertence à mesma organização usuária. Não é,
 * isoladamente, proteção suficiente contra um Escopo de lote fabricado —
 * para isso, os consumidores (ex.: `budget-version`) exigem o objeto
 * `ProcurementLot` real correspondente e confrontam seus fatos.
 */
export function isWellFormedProcurementScope(scope: ProcurementScope): boolean {
  if (scope === null || typeof scope !== "object") {
    return false;
  }

  if (scope.kind === ProcurementScopeKind.WholeCase) {
    const keys = Object.keys(scope).sort();
    return (
      keys.length === 2 &&
      keys[0] === "kind" &&
      keys[1] === "procurementCaseId" &&
      typeof scope.procurementCaseId === "string" &&
      !isBlank(scope.procurementCaseId)
    );
  }

  if (scope.kind === ProcurementScopeKind.Lot) {
    const keys = Object.keys(scope).sort();
    return (
      keys.length === 3 &&
      keys[0] === "kind" &&
      keys[1] === "procurementCaseId" &&
      keys[2] === "procurementLotId" &&
      typeof scope.procurementCaseId === "string" &&
      typeof scope.procurementLotId === "string" &&
      !isBlank(scope.procurementCaseId) &&
      !isBlank(scope.procurementLotId)
    );
  }

  return false;
}

function createCaseError(
  code: ProcurementCaseErrorCode,
  field: string,
  message: string,
  metadata: ProcurementCaseMetadata,
): ProcurementCaseError {
  return { code, field, message, metadata };
}

function createCaseMetadata(input: CreateProcurementCaseInput): ProcurementCaseMetadata {
  return {
    ...(input.metadata ?? {}),
    caseId: input.id,
    organizationId: input.organizationId,
    ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    ...(input.createdBy !== undefined ? { createdBy: input.createdBy } : {}),
    ...(input.sourceSystem !== undefined ? { sourceSystem: input.sourceSystem } : {}),
  };
}

function createLotMetadata(input: CreateProcurementLotInput): ProcurementCaseMetadata {
  return {
    ...(input.metadata ?? {}),
    lotId: input.id,
    procurementCaseId: input.procurementCase?.id ?? null,
    ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    ...(input.createdBy !== undefined ? { createdBy: input.createdBy } : {}),
    ...(input.sourceSystem !== undefined ? { sourceSystem: input.sourceSystem } : {}),
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
