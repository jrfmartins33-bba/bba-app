import { WorkPackageType, type GeospatialWorkPackageInput } from "@bba/bdos-core/services/geospatial-product-integration";

export interface TimelineStageDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly asOf: string;
  readonly workPackages: ReadonlyArray<GeospatialWorkPackageInput>;
}

const FRENTE_A: GeospatialWorkPackageInput = {
  id: "wp-frente-a",
  code: "FR-A",
  name: "Frente A — Fundação da Comporta",
  type: WorkPackageType.ExecutionFront,
  sequence: 1
};

const TRECHO_1: GeospatialWorkPackageInput = {
  id: "wp-trecho-1",
  code: "FR-A.1",
  name: "Trecho 1 — Bloco de Fundação",
  type: WorkPackageType.ExecutionFront,
  parentWorkPackageId: "wp-frente-a",
  sequence: 1
};

const TRECHO_2: GeospatialWorkPackageInput = {
  id: "wp-trecho-2",
  code: "FR-A.2",
  name: "Trecho 2 — Bloco de Fundação",
  type: WorkPackageType.ExecutionFront,
  parentWorkPackageId: "wp-frente-a",
  sequence: 2
};

const FRENTE_B: GeospatialWorkPackageInput = {
  id: "wp-frente-b",
  code: "FR-B",
  name: "Frente B — Vertedouro",
  type: WorkPackageType.ExecutionFront,
  sequence: 2
};

/**
 * EPIC 05, Objetivo 3 — Replay Temporal. Cada estágio simula um
 * momento da obra através de um roster diferente de `WorkPackage`s —
 * nunca por data real — representando quantas frentes/trechos já
 * estão sob acompanhamento espacial nesta fase. Cada estágio chama a
 * mesma `buildGeospatialProductSnapshot` real e inalterada (ver
 * `page.tsx`); substituir por snapshots de produção reais no futuro
 * significa apenas trocar o roster de cada estágio, nunca a
 * arquitetura desta tela.
 */
export const TIMELINE_STAGES: ReadonlyArray<TimelineStageDefinition> = [
  {
    id: "planejamento",
    label: "Planejamento",
    description: "Apenas a primeira frente de execução foi identificada.",
    asOf: "03/07/2026",
    workPackages: [FRENTE_A]
  },
  {
    id: "execucao-inicial",
    label: "Execução inicial",
    description: "O primeiro trecho da Frente A entrou em acompanhamento.",
    asOf: "04/07/2026",
    workPackages: [FRENTE_A, TRECHO_1]
  },
  {
    id: "execucao-intermediaria",
    label: "Execução intermediária",
    description: "O segundo trecho da Frente A entrou em acompanhamento.",
    asOf: "05/07/2026",
    workPackages: [FRENTE_A, TRECHO_1, TRECHO_2]
  },
  {
    id: "execucao-consolidada",
    label: "Execução consolidada",
    description: "Uma nova frente de execução (Frente B) entrou em acompanhamento.",
    asOf: "06/07/2026",
    workPackages: [FRENTE_A, TRECHO_1, TRECHO_2, FRENTE_B]
  }
];
