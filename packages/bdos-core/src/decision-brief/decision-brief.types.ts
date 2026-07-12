import type { ReliabilityIndexResult } from "./reliability-index.types";

/**
 * Epic 20 (Decision Experience), Sprint 20.1A — Decision Brief Core
 * Contract. Contrato de leitura executiva genérico, irmão dos
 * Engines -- nunca depende do Decision Engine (`engines/decision`,
 * `domain/decision`, `domain/decision-case`, `domain/decision-portfolio`,
 * `domain/executive-insight`, `domain/executive-brief`), nunca conhece
 * um domínio produtor específico (boletim de medição, EAP, item de
 * serviço, célula de planilha, cronograma). Ver
 * packages/bdos-core/docs/EPIC_20_SPRINT_1_MEASUREMENT_DECISION_BRIEF_DESIGN.md
 * (Parte III e Parte X) para o desenho completo, a auditoria que
 * motivou cada decisão de nomenclatura, e a segunda rodada de
 * validação (schemaVersion/builderVersion separados, sourceImportId,
 * DecisionBriefSourceReference como localizador, readiness sem
 * semântica de aprovação, nextActions sem criação de aggregate).
 *
 * Este módulo não deve importar nada de `domain/*`, `services/*`,
 * `engines/*`, `advisor/*` ou `capabilities/*` -- ver Rule F em
 * `architecture/engineering-boundaries.test.ts`. Não existirá um
 * `DecisionBriefEngine` central: cada domínio produtor (Medição,
 * Planejamento, Financeiro, Contratos) tem seu próprio builder,
 * importando este contrato e o resultado técnico do seu próprio
 * domínio -- nunca o inverso.
 *
 * Deliberadamente fora deste snapshot: `trend`/`DecisionHistory`/
 * `DecisionTimeline`. Nenhum placeholder "available/unavailable" é
 * mantido no contrato para eles -- um campo estruturalmente vazio em
 * 100% dos casos reais de hoje é uma promessa que o contrato não pode
 * cumprir. Tendência só será modelada quando existirem snapshots
 * históricos versionados, uma regra determinística de comparação e um
 * ownership temporal explícito -- como agregados irmãos, referenciando
 * o mesmo caso por id, nunca como campo deste tipo.
 */

/**
 * Versão estrutural do contrato `DecisionBrief` -- muda em alteração
 * incompatível do shape, nunca por causa de uma regra de negócio que
 * mudou (isso é `DecisionBriefMetadata.builderVersion`, versionado
 * junto ao builder de cada domínio produtor, não aqui).
 */
export const DECISION_BRIEF_SCHEMA_VERSION = "1.0" as const;

/**
 * Prontidão técnica para que um processo humano posterior prossiga --
 * nunca aprovação, certificação, homologação ou aceite contratual
 * consumados. Deriva sempre das regras determinísticas do domínio
 * produtor sobre seu próprio resultado técnico; nunca de um
 * mapeamento automático a partir do nome de um status de outro
 * domínio (ex.: nenhuma regra `Finalized -> ready` existe ou deve
 * existir aqui -- essa interpretação pertence a cada builder).
 */
export type DecisionBriefReadiness = "ready" | "ready_with_reservations" | "not_ready" | "inconclusive";

/**
 * Enumeração runtime dos valores de `DecisionBriefReadiness` -- mesmo
 * padrão de `VALID_PRIORITIES`
 * (`advisor/advisor-response-validator.ts`), preparada para um
 * futuro validador de saída de LLM (Sprint 20.1E) sem duplicar a
 * lista de valores em dois lugares.
 */
export const DECISION_BRIEF_READINESS_VALUES: ReadonlyArray<DecisionBriefReadiness> = [
  "ready",
  "ready_with_reservations",
  "not_ready",
  "inconclusive",
];

export interface DecisionBriefSection {
  readonly title: string;
  readonly body: string;
}

/**
 * Referência de origem genérica -- um localizador, nunca uma nova
 * entidade de evidência. `sourceId` identifica o artefato/importação
 * imutável (ex.: `measurementBulletinImportId`); `locator` localiza
 * dentro dele. O Brief nunca copia nem passa a possuir o documento de
 * origem, nunca guarda o valor original como fonte da verdade -- a UI
 * resolve a navegação usando a referência. Não depende de
 * `fieldEvidenceId` nem substitui `EvidenceReference`
 * (`domain/execution-management`), que continua exclusiva para
 * evidência de campo. Só `spreadsheet_cell` existe nesta Sprint --
 * não modelar variantes especulativas (evidência de campo, documento,
 * geoespacial, transação financeira) sem necessidade real
 * comprovada; o discriminante por `sourceType` deixa o tipo
 * extensível quando essa necessidade existir de fato.
 */
export type DecisionBriefSourceReference = {
  readonly sourceType: "spreadsheet_cell";
  readonly sourceId: string;
  readonly locator: {
    readonly sheetName: string;
    readonly row: number;
    readonly column?: string;
  };
};

export interface DecisionBriefCriticalItem {
  readonly id: string;
  readonly severity: "blocking" | "warning";
  readonly title: string;
  readonly body: string;
  readonly consequenceIfAddressed: string | null;
  readonly consequenceIfIgnored: string | null;
  readonly evidenceReferences: ReadonlyArray<DecisionBriefSourceReference>;
}

/** Métrica genérica label/value -- domínio-agnóstica; um builder de Medição a rotula "Medições" só na tradução de UI, nunca no contrato. */
export interface DecisionBriefKeyMetric {
  readonly label: string;
  readonly value: string;
}

export interface DecisionBriefKeyDecision {
  readonly label: string;
  readonly recommended: boolean;
  readonly rationale: string;
}

/**
 * Recomendação descritiva -- nunca representa `ActionPlan`/`Action`/
 * `ExecutionWorkflow`/`ExecutionTask`/`Recommendation`, nem cria
 * qualquer aggregate persistido como efeito colateral de existir
 * neste array. Uma eventual materialização em execução exige ação
 * explícita do usuário -> Application Service próprio -> aggregate
 * proprietário -> auditoria, nunca implícita aqui.
 */
export interface DecisionBriefNextAction {
  readonly title: string;
  readonly rationale: string;
  readonly evidenceReferences: ReadonlyArray<DecisionBriefSourceReference>;
}

export interface DecisionBriefMetadata {
  /** Versão estrutural do contrato -- ver DECISION_BRIEF_SCHEMA_VERSION. */
  readonly schemaVersion: string;
  /** Versão da regra/builder do domínio produtor que gerou este Brief -- própria de cada builder, nunca compartilhada entre domínios. */
  readonly builderVersion: string;
  /** Identificador do snapshot técnico imutável de origem (ex.: measurementBulletinImportId). */
  readonly sourceImportId: string;
  readonly generatedAt: string;
}

export interface DecisionBrief {
  readonly metadata: DecisionBriefMetadata;
  readonly situation: DecisionBriefSection;
  readonly executiveConclusion: {
    readonly readiness: DecisionBriefReadiness;
    readonly headline: string;
    readonly body: string;
  };
  readonly keyDecisions: ReadonlyArray<DecisionBriefKeyDecision>;
  readonly criticalItems: ReadonlyArray<DecisionBriefCriticalItem>;
  readonly keyMetrics: ReadonlyArray<DecisionBriefKeyMetric>;
  readonly details: DecisionBriefSection;
  readonly nextActions: ReadonlyArray<DecisionBriefNextAction>;
  readonly evidenceReferences: ReadonlyArray<DecisionBriefSourceReference>;
  readonly confidence: ReliabilityIndexResult;
}
