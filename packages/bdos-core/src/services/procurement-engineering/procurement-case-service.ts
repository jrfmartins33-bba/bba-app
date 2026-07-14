import { createProcurementCase, createProcurementLot } from "../../domain/procurement-case";
import type { ApplicationContext } from "./application-context";
import { toInfrastructureErrorMessage } from "./application-context";
import type { ProcurementCaseRepository } from "./procurement-case.repository";
import type {
  CreateProcurementCaseCommand,
  CreateProcurementCaseServiceResult,
  RegisterProcurementLotCommand,
  RegisterProcurementLotServiceResult,
} from "./procurement-case-service.types";

/**
 * Cria o Processo de Licitação e Contratação (seção 9.1 da instrução): a
 * identidade interna é atribuída aqui — nunca derivada do número do edital
 * (`externalReference`), nunca gerada automaticamente a partir de um
 * identificador externo. `organizationId` vem sempre do contexto, nunca de
 * um campo do comando.
 */
export async function createProcurementCaseService(
  context: ApplicationContext,
  command: CreateProcurementCaseCommand,
  repository: ProcurementCaseRepository,
): Promise<CreateProcurementCaseServiceResult> {
  const domainResult = createProcurementCase({
    id: crypto.randomUUID(),
    organizationId: context.organizationId,
    title: command.title,
    externalReference: command.externalReference ?? null,
    correlationId: context.correlationId,
    createdBy: context.actor,
    sourceSystem: context.sourceSystem,
    metadata: command.metadata,
  });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  try {
    const procurementCase = await repository.createProcurementCase(context.organizationId, context.actor, domainResult.procurementCase);
    return { outcome: "created", procurementCase };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}

/**
 * Registra o Lote da Licitação (seção 9.2): carrega o Processo na
 * organização do contexto primeiro — falha explicitamente se o Processo não
 * existir ali (inclusive quando ele existe, mas em outra organização
 * usuária, caso em que se comporta como inexistente). Nunca cria um lote
 * artificial.
 */
export async function registerProcurementLotService(
  context: ApplicationContext,
  command: RegisterProcurementLotCommand,
  repository: ProcurementCaseRepository,
): Promise<RegisterProcurementLotServiceResult> {
  const procurementCase = await repository.findProcurementCaseById(context.organizationId, command.procurementCaseId);

  if (procurementCase === null) {
    return { outcome: "procurement_case_not_found" };
  }

  const domainResult = createProcurementLot({
    id: crypto.randomUUID(),
    procurementCase,
    title: command.title,
    externalReference: command.externalReference ?? null,
    correlationId: context.correlationId,
    createdBy: context.actor,
    sourceSystem: context.sourceSystem,
    metadata: command.metadata,
  });

  if (!domainResult.success) {
    return { outcome: "domain_error", errors: domainResult.errors };
  }

  try {
    const procurementLot = await repository.createProcurementLot(context.organizationId, context.actor, domainResult.procurementLot);
    return { outcome: "created", procurementLot };
  } catch (error) {
    return { outcome: "persistence_failure", message: toInfrastructureErrorMessage(error) };
  }
}
