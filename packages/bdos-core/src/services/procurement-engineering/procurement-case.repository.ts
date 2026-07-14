import type { ProcurementCase, ProcurementLot } from "../../domain/procurement-case";

/**
 * Contrato mínimo exigido pelos Serviços de Aplicação de Processo/Lote
 * (Sprint 21.3C, seção 8.1) — representa as necessidades da camada de
 * aplicação, não as tabelas físicas. Não depende de Supabase nem de
 * qualquer tipo físico de banco; implementações concretas (adaptadores)
 * vivem em `apps/web/lib/bdos/*`, nunca aqui.
 *
 * Todo método é Escopado por organização usuária — nenhum método equivalente
 * a `findById(id)` sem esse Escopo é exposto. Um registro de outra
 * organização usuária deve se comportar, para o chamador, como inexistente
 * (`null`), nunca como um erro que revele sua existência.
 */
export interface ProcurementCaseRepository {
  createProcurementCase(
    organizationId: string,
    procurementCase: ProcurementCase,
  ): Promise<ProcurementCase>;

  findProcurementCaseById(
    organizationId: string,
    id: string,
  ): Promise<ProcurementCase | null>;

  createProcurementLot(
    organizationId: string,
    procurementLot: ProcurementLot,
  ): Promise<ProcurementLot>;

  findProcurementLotById(
    organizationId: string,
    procurementCaseId: string,
    id: string,
  ): Promise<ProcurementLot | null>;
}
