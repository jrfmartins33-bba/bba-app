/**
 * Contrato puro da Sprint 21.4G — Governança de Validação Real e Portões
 * de Evidência. Reaproveita o idioma já estabelecido pelo catálogo de
 * sinais (`budget-document-signal-catalog.types.ts`/`.ts`): um array
 * literal exportado, `as const`, imutável em runtime via `deepFreeze`,
 * com seu próprio teste de integridade estrutural ao lado — nunca um
 * arquivo JSON/YAML externo, nunca um scanner textual da documentação.
 *
 * Localização: `src/architecture/`, não `src/domain/` — esta governança
 * não é domínio de negócio; é a mesma camada transversal que já hospeda
 * os guards de fronteira arquitetural (`*-boundaries.test.ts`). Nenhuma
 * nova camada foi criada (correção estrutural da Sprint 21.4G, §5).
 *
 * Este módulo nunca corrige algoritmo documental, nunca importa nenhum
 * domínio operacional ou de decisão, nunca referencia conteúdo real de
 * documento (apenas metadados estruturais: fingerprint, intervalo de
 * página, resultado esperado/observado em texto livre nunca extenso).
 */

export const REAL_VALIDATION_MATURITY_SCHEMA_VERSION = 2 as const;
export const REAL_VALIDATION_MATURITY_REGISTRY_VERSION = "real-validation-maturity-registry-v2" as const;

// --- eixo 1: nível de evidência (quanto rigor de evidência existe) --------

/**
 * Cinco níveis, em ordem crescente de RIGOR de evidência coletada —
 * nunca de resultado. Um nível alto não implica que o resultado tenha
 * sido positivo (ver `ValidationResult` abaixo e
 * `PERMITTED_LEVEL_RESULT_COMBINATIONS`). Corrigido nesta Sprint: a
 * versão anterior misturava nível e resultado num único eixo de 6
 * valores, incluindo indevidamente "reprovada" como se fosse um nível de
 * evidência.
 */
export const REAL_VALIDATION_MATURITY_LEVELS = [
  "experimental",
  "validada_sinteticamente",
  "caracterizada_em_caso_real",
  "validada_em_caso_real",
  "validada_adversarialmente",
] as const;

export type RealValidationMaturityLevel = (typeof REAL_VALIDATION_MATURITY_LEVELS)[number];

export const REAL_VALIDATION_MATURITY_LEVEL_LABELS_PT: Readonly<Record<RealValidationMaturityLevel, string>> = {
  experimental: "Experimental",
  validada_sinteticamente: "Validada sinteticamente",
  caracterizada_em_caso_real: "Caracterizada em caso real",
  validada_em_caso_real: "Validada em caso real",
  validada_adversarialmente: "Validada adversarialmente",
};

export const REAL_VALIDATION_MATURITY_LEVEL_REQUIREMENTS_PT: Readonly<Record<RealValidationMaturityLevel, string>> = {
  experimental: "Existe uma implementação com contrato definido (tipos, função pública), mas sem suíte de testes sintéticos abrangente.",
  validada_sinteticamente:
    "Suíte de testes sintéticos cobre o comportamento nominal e casos de fronteira — mas nunca foi exercitada contra um documento real (nem mesmo tecnicamente).",
  caracterizada_em_caso_real:
    "A capacidade foi exercitada tecnicamente contra ao menos um documento real (fingerprint registrado). `completed`/`structured`/`evaluated` sozinho NUNCA basta — é preciso ao menos uma observação estrutural registrada e comparada (formalmente ou informalmente) contra alguma expectativa. Este é o nível correto mesmo quando uma comparação formal FOI feita e o resultado saiu reprovado ou inconclusivo — ver `ValidationResult`: 'validada' descreve rigor com resultado positivo confirmado, nunca rigor isolado do resultado.",
  validada_em_caso_real:
    "Existe resultado esperado definido ANTES da execução e resultado observado comparado explicitamente contra ele, e o resultado dessa comparação é `aprovada` (ver combinações permitidas). Se o resultado for `reprovada` ou `inconclusiva`, o nível correto permanece `caracterizada_em_caso_real` — a tentativa formal de validação não confirma, por si, que a capacidade foi validada.",
  validada_adversarialmente:
    "Além de `validada_em_caso_real` com resultado `aprovada`, existe uma matriz de casos adversariais deliberados que a capacidade corretamente rejeita, com resultado `aprovada`. Nível mais alto; não exige `promotionConditionPt` adicional.",
};

export function isTerminalMaturityLevel(level: RealValidationMaturityLevel): boolean {
  return level === "validada_adversarialmente";
}

// --- eixo 2: resultado da validação (o que a evidência diz) ---------------

/**
 * Quatro resultados possíveis — independente do nível de evidência. Um
 * resultado `reprovada` em `caracterizada_em_caso_real` (ex.: f.2a) é uma
 * combinação válida e esperada; o nível não sobe para `validada_em_caso_real`
 * quando o resultado é negativo (ver requisito do nível acima).
 */
export const VALIDATION_RESULTS = ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"] as const;
export type ValidationResult = (typeof VALIDATION_RESULTS)[number];

export const VALIDATION_RESULT_LABELS_PT: Readonly<Record<ValidationResult, string>> = {
  nao_avaliada: "Não avaliada",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  inconclusiva: "Inconclusiva",
};

/**
 * Combinações permitidas de (nível, resultado) — o guard rejeita
 * qualquer par fora desta lista. `experimental` só combina com
 * `nao_avaliada`; `validada_em_caso_real`/`validada_adversarialmente` só
 * combinam com `aprovada` (por definição do próprio nível); `validada_sinteticamente`
 * combina com `nao_avaliada` (suíte existe, ainda não interpretada como
 * portão) ou `aprovada` (suíte revisada e aprovada); `caracterizada_em_caso_real`
 * é o único nível que aceita os quatro resultados — é exatamente o
 * nível em que uma tentativa real pode sair aprovada, reprovada,
 * inconclusiva, ou ainda não ter sido formalmente lida.
 */
export const PERMITTED_LEVEL_RESULT_COMBINATIONS: Readonly<Record<RealValidationMaturityLevel, ReadonlyArray<ValidationResult>>> = {
  experimental: ["nao_avaliada"],
  validada_sinteticamente: ["nao_avaliada", "aprovada"],
  caracterizada_em_caso_real: ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"],
  validada_em_caso_real: ["aprovada"],
  validada_adversarialmente: ["aprovada"],
};

// --- papéis formais -------------------------------------------------------

/** Papéis formais da Sprint 21.4G — nunca aprovação só pelo relatório do implementador. */
export const GOVERNANCE_ROLES = ["implementador", "revisor_adversarial", "aprovador"] as const;
export type GovernanceRole = (typeof GOVERNANCE_ROLES)[number];

export const GOVERNANCE_ROLE_LABELS_PT: Readonly<Record<GovernanceRole, string>> = {
  implementador: "Implementador",
  revisor_adversarial: "Revisor adversarial",
  aprovador: "Aprovador",
};

/** Valor literal a usar quando um papel não foi formalmente executado nesta avaliação — nunca inventar independência que não existiu. */
export const ROLE_NOT_FORMALIZED = "não formalizado" as const;

// --- portões específicos ---------------------------------------------------

export const DOWNSTREAM_GATE_STATUSES = ["aberto", "bloqueado", "condicional"] as const;
export type DownstreamGateStatus = (typeof DOWNSTREAM_GATE_STATUSES)[number];

/**
 * Um portão por par (consumidor, finalidade) — nunca um único portão
 * genérico por capacidade. Ex.: f.1 pode estar `aberto` para diagnóstico
 * upstream e `bloqueado` para consumo econômico validado, ao mesmo
 * tempo — dois registros de `DownstreamGate` distintos, nunca um único
 * status genérico "aberto"/"bloqueado" para a capacidade inteira.
 */
export interface DownstreamGate {
  /** Capacidade consumidora (id estável) ou classe de consumidor (ex.: "qualquer_consumo_produtivo"). */
  readonly consumerId: string;
  readonly purposePt: string;
  readonly status: DownstreamGateStatus;
  readonly rationalePt: string;
  /** Obrigatório (não vazio) quando `status !== "aberto"`; `null` apenas quando `status === "aberto"`. */
  readonly missingEvidencePt: string | null;
  readonly behaviorWhenBlockedPt: string;
}

// --- evidências -------------------------------------------------------------

export interface RealValidationEvidenceReal {
  readonly sourceFingerprintSha256: string;
  readonly pageOrTraceRange: string;
  readonly expectedResult: string;
  readonly observedResult: string;
  readonly divergences: ReadonlyArray<string>;
  readonly reportReference: string;
}

export interface RealValidationEvidenceAdversarial {
  readonly adversarialCasesSummary: string;
  readonly outcomeSummary: string;
  readonly reportReference: string;
}

// --- histórico de avaliações -------------------------------------------------

/**
 * Um registro imutável por avaliação — nunca sobrescrito, apenas
 * anexado. Nenhuma infraestrutura de eventos/banco: apenas um array
 * `ReadonlyArray` dentro do próprio registro estático.
 */
export interface CapabilityEvaluationHistoryEntry {
  readonly evaluationId: string;
  readonly date: string;
  /** Revisão do código avaliado (f.0-g.3) — nunca o commit que contém o próprio registro de governança. */
  readonly evaluatedRevision: string;
  readonly previousLevel: RealValidationMaturityLevel | null;
  readonly previousResult: ValidationResult | null;
  readonly newLevel: RealValidationMaturityLevel;
  readonly newResult: ValidationResult;
  readonly evidenceConsideredPt: ReadonlyArray<string>;
  readonly limitationsPt: ReadonlyArray<string>;
  readonly knownFailuresPt: ReadonlyArray<string>;
  /** Quem implementou — nunca "IA independente" quando não foi o caso. */
  readonly implementer: string;
  /** `ROLE_NOT_FORMALIZED` quando nenhuma revisão adversarial formal e independente ocorreu. */
  readonly adversarialReviewer: string;
  /** `ROLE_NOT_FORMALIZED` até que o responsável humano pelo produto aprove formalmente. */
  readonly approver: string;
  readonly decisionPt: string;
  readonly justificationPt: string;
}

// --- registro por capacidade --------------------------------------------------

export interface CapabilityMaturityRecord {
  readonly id: string;
  readonly namePt: string;
  readonly stageId: string;
  readonly descriptionPt: string;
  readonly currentLevel: RealValidationMaturityLevel;
  readonly currentResult: ValidationResult;
  /** Preenchido apenas quando `currentResult === "inconclusiva"` — a causa da inconclusão (ex.: entrada degradada por falha upstream). `null` nos demais casos. */
  readonly inconclusiveCausePt: string | null;
  readonly syntheticEvidenceSummaryPt: string;
  readonly realEvidence: RealValidationEvidenceReal | null;
  readonly adversarialEvidence: RealValidationEvidenceAdversarial | null;
  readonly knownLimitationsPt: ReadonlyArray<string>;
  readonly knownFailuresPt: ReadonlyArray<string>;
  readonly promotionConditionPt: string | null;
  /** Revisão do código avaliado (f.0-g.3) — nunca o commit que contém o próprio registro de governança. */
  readonly evaluatedRevision: string;
  readonly lastEvaluatedDate: string;
  readonly technicalReportOwner: string;
  /** Múltiplos portões específicos (consumidor + finalidade) — nunca um único status genérico. */
  readonly downstreamGates: ReadonlyArray<DownstreamGate>;
  readonly evaluationHistory: ReadonlyArray<CapabilityEvaluationHistoryEntry>;
  readonly registryVersion: typeof REAL_VALIDATION_MATURITY_REGISTRY_VERSION;
}

export type CapabilityMaturityRegistry = ReadonlyArray<CapabilityMaturityRecord>;

export type CapabilityMaturityIssueCode =
  | "duplicate_id"
  | "unrecognized_level"
  | "unrecognized_result"
  | "disallowed_level_result_combination"
  | "missing_real_evidence"
  | "missing_adversarial_evidence"
  | "missing_limitations_declaration"
  | "missing_promotion_condition"
  | "missing_inconclusive_cause"
  | "unexpected_inconclusive_cause"
  | "gate_missing_consumer_or_purpose"
  | "gate_missing_evidence_when_not_open"
  | "upstream_failure_not_blocking_downstream"
  | "missing_evaluation_history"
  | "history_entry_missing_roles"
  | "suspicious_local_path_in_evidence"
  | "missing_fingerprint"
  | "missing_expected_or_observed_result"
  | "reprovada_without_known_failures"
  | "inconclusiva_without_cause"
  | "aprovada_with_known_failure"
  | "gate_open_for_blocked_upstream_purpose";

export interface CapabilityMaturityIssue {
  readonly code: CapabilityMaturityIssueCode;
  readonly recordId: string;
  readonly message: string;
}
