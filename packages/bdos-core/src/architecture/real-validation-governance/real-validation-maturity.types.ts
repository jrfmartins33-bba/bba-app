/**
 * Contrato puro da Sprint 21.4G — Governança de Validação Real e Portões
 * de Evidência. Reaproveita o idioma já estabelecido pelo catálogo de
 * sinais (`budget-document-signal-catalog.types.ts`/`.ts`): um array
 * literal exportado, `as const`, imutável em runtime via `deepFreeze`
 * recursivo (não apenas no primeiro nível), com seu próprio teste de
 * integridade estrutural ao lado — nunca um arquivo JSON/YAML externo,
 * nunca um scanner textual da documentação.
 *
 * Localização: `src/architecture/`, não `src/domain/` — esta governança
 * não é domínio de negócio; é a mesma camada transversal que já hospeda
 * os guards de fronteira arquitetural (`*-boundaries.test.ts`).
 *
 * Este módulo nunca corrige algoritmo documental, nunca importa nenhum
 * domínio operacional ou de decisão, nunca referencia conteúdo real de
 * documento (apenas metadados estruturais: fingerprint completo,
 * intervalo de página, resultado esperado/observado em texto livre
 * nunca extenso).
 *
 * Terceira correção (pós-segunda revisão independente): o registro
 * contém tanto capacidades quanto cenários ponta a ponta — os contratos
 * antes nomeados "Capability*" foram renomeados para um vocabulário
 * centrado em alvo (`RealValidationTarget*`), sem alias legado (o código
 * nunca entrou em `main`). Além disso: portões agora declaram sua
 * própria exigência mínima de nível e resultados permitidos (nunca uma
 * exigência universal inventada); evidência real agora exige
 * proveniência auditável da expectativa (definida antes da execução);
 * falhas usam um estado estruturado (`failureAssessment`) em vez de
 * varredura textual pela palavra "nenhuma"; consumidores de portão são
 * estruturados (`consumerKind`); e o histórico ganhou verificações mais
 * profundas de integridade.
 */

export const REAL_VALIDATION_MATURITY_SCHEMA_VERSION = 4 as const;
export const REAL_VALIDATION_MATURITY_REGISTRY_VERSION = "real-validation-maturity-registry-v4" as const;

// --- eixo 1: nível de evidência (profundidade, nunca resultado) ----------

export const REAL_VALIDATION_MATURITY_LEVELS = [
  "experimental",
  "evidenciada_sinteticamente",
  "exercitada_em_caso_real",
  "comparada_formalmente_em_caso_real",
  "submetida_a_teste_adversarial",
] as const;

export type RealValidationMaturityLevel = (typeof REAL_VALIDATION_MATURITY_LEVELS)[number];

export const REAL_VALIDATION_MATURITY_LEVEL_LABELS_PT: Readonly<Record<RealValidationMaturityLevel, string>> = {
  experimental: "Experimental",
  evidenciada_sinteticamente: "Evidenciada sinteticamente",
  exercitada_em_caso_real: "Exercitada em caso real",
  comparada_formalmente_em_caso_real: "Comparada formalmente em caso real",
  submetida_a_teste_adversarial: "Submetida a teste adversarial",
};

export const REAL_VALIDATION_MATURITY_LEVEL_REQUIREMENTS_PT: Readonly<Record<RealValidationMaturityLevel, string>> = {
  experimental: "Existe uma implementação com contrato definido (tipos, função pública), mas sem suíte de testes sintéticos abrangente. Nenhum resultado além de 'não avaliada' é possível neste nível.",
  evidenciada_sinteticamente:
    "Suíte de testes sintéticos cobre o comportamento nominal e casos de fronteira. Ainda não expressa nada sobre documento real — o resultado pode ser 'não avaliada' (suíte existe, não interpretada como portão) ou refletir o veredito da própria suíte sintética.",
  exercitada_em_caso_real:
    "A capacidade foi executada tecnicamente contra ao menos um documento real (fingerprint completo registrado). `completed`/`structured`/`evaluated` sozinho NUNCA basta — é preciso ao menos uma observação estrutural registrada. Não implica nenhum resultado específico: o resultado pode ser 'não avaliada' (executada, nunca interpretada/comparada), 'aprovada', 'reprovada' ou 'inconclusiva'.",
  comparada_formalmente_em_caso_real:
    "Existe resultado esperado com proveniência auditável (`expectationReference`/`expectationDefinedAt`) definida ANTES da execução (`executionReference`), e resultado observado comparado explicitamente contra ele, com divergências (se houver) registradas. Este nível por si só NÃO implica aprovação — uma comparação formal pode legitimamente concluir 'reprovada' (ex.: f.2a) ou 'inconclusiva'. Nunca reconstruir de memória o que supostamente estava congelado antes — se a proveniência não existir, o nível não pode ser reivindicado.",
  submetida_a_teste_adversarial:
    "Além de uma comparação formal com proveniência auditável, existe uma matriz de casos adversariais deliberados (conteúdo não pertencente, mas geometricamente ou estruturalmente semelhante) avaliada contra a capacidade. O resultado da matriz adversarial pode ser 'aprovada' (todos os casos corretamente rejeitados/tratados), 'reprovada' (um caso adversarial revelou falha, ex.: f.2a) ou 'inconclusiva' (a matriz não sustenta conclusão final).",
};

export function isDeepestMaturityLevel(level: RealValidationMaturityLevel): boolean {
  return level === "submetida_a_teste_adversarial";
}

/** Posição do nível na escala de profundidade (0 = experimental, 4 = submetida_a_teste_adversarial) — usada para comparações de "nível mínimo exigido" pelos portões. */
export function maturityLevelRank(level: RealValidationMaturityLevel): number {
  return REAL_VALIDATION_MATURITY_LEVELS.indexOf(level);
}

/**
 * Piso estrutural: nenhum portão de finalidade `real_validation` ou
 * `productive_use` pode declarar `minimumEvidenceLevel` abaixo deste
 * nível — corrige a lacuna em que uma aprovação meramente sintética
 * (`evidenciada_sinteticamente` + `aprovada`) poderia sustentar um
 * portão real/produtivo aberto por omissão de exigência.
 */
export const MINIMUM_EVIDENCE_LEVEL_FLOOR_FOR_GATED_PURPOSES: RealValidationMaturityLevel = "comparada_formalmente_em_caso_real";

// --- eixo 2: resultado da validação (o que a evidência concluiu) ---------

export const VALIDATION_RESULTS = ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"] as const;
export type ValidationResult = (typeof VALIDATION_RESULTS)[number];

export const VALIDATION_RESULT_LABELS_PT: Readonly<Record<ValidationResult, string>> = {
  nao_avaliada: "Não avaliada",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  inconclusiva: "Inconclusiva",
};

/**
 * Combinações permitidas de (nível, resultado). Nível de evidência nunca
 * implica aprovação — um nível profundo permite resultado negativo:
 * `comparada_formalmente_em_caso_real` + `reprovada` é permitido (f.2a);
 * `submetida_a_teste_adversarial` + `reprovada` é permitido; `submetida_a_teste_adversarial`
 * + `inconclusiva` é permitido quando a matriz adversarial não sustenta
 * conclusão final. Apenas `experimental` fica restrito a `nao_avaliada`
 * (nenhuma evidência foi ainda coletada, logo nenhum resultado pode ser
 * concluído). Os demais níveis aceitam os quatro resultados.
 */
export const PERMITTED_LEVEL_RESULT_COMBINATIONS: Readonly<Record<RealValidationMaturityLevel, ReadonlyArray<ValidationResult>>> = {
  experimental: ["nao_avaliada"],
  evidenciada_sinteticamente: ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"],
  exercitada_em_caso_real: ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"],
  comparada_formalmente_em_caso_real: ["aprovada", "reprovada", "inconclusiva"],
  submetida_a_teste_adversarial: ["aprovada", "reprovada", "inconclusiva"],
};

/**
 * `promotionConditionPt` é obrigatória exceto quando o nível já é o mais
 * profundo E o resultado já é `aprovada` — mesmo no nível mais profundo,
 * um resultado `reprovada`/`inconclusiva` ainda exige um caminho adiante
 * documentado.
 */
export function requiresPromotionCondition(level: RealValidationMaturityLevel, result: ValidationResult): boolean {
  return !(isDeepestMaturityLevel(level) && result === "aprovada");
}

// --- eixo 3: estado estruturado de avaliação de falhas ---------------------

/**
 * Terceira correção: substitui `NO_KNOWN_FAILURE_MARKER` e toda busca
 * textual pela palavra "nenhuma" em `knownFailuresPt`. Nenhuma decisão
 * do guard pode depender de substring em texto livre — o estado de
 * avaliação de falhas é declarado explicitamente neste campo estruturado.
 *
 * - `none_known`: falhas foram genuinamente avaliadas e nenhuma foi
 *   encontrada (compatível apenas com resultado `aprovada`).
 * - `confirmed`: ao menos uma falha concreta foi identificada e está
 *   detalhada em `knownFailuresPt` (compatível apenas com `reprovada` ou,
 *   quando a falha é conhecida mas o impacto pleno ainda não foi
 *   determinado, `inconclusiva`).
 * - `not_assessable`: a capacidade nunca foi genuinamente exercitada
 *   contra condições que permitissem avaliar a presença de falhas (ex.:
 *   entrada degradada por dependência upstream reprovada, ou nível ainda
 *   não avaliado) — nunca usado para expressar "sem falhas".
 */
export const FAILURE_ASSESSMENTS = ["none_known", "confirmed", "not_assessable"] as const;
export type FailureAssessment = (typeof FAILURE_ASSESSMENTS)[number];

export const FAILURE_ASSESSMENT_LABELS_PT: Readonly<Record<FailureAssessment, string>> = {
  none_known: "Nenhuma falha conhecida (genuinamente avaliada)",
  confirmed: "Falha confirmada",
  not_assessable: "Não avaliável nas condições atuais",
};

// --- discriminador de alvo: capacidade vs. cenário ponta a ponta ----------

/**
 * Correção de revisão independente: uma capacidade isolada (ex.:
 * caracterização econômica) nunca deve carregar o veredito de um
 * cenário ponta a ponta (ex.: a extração real completa) quando a
 * evidência demonstra apenas que a capacidade recebeu entrada inválida
 * — o defeito pertence à capacidade upstream real (f.2a) e ao cenário
 * ponta a ponta como um todo, nunca à capacidade downstream que apenas
 * nunca teve a chance de processar entrada válida.
 */
export const TARGET_KINDS = ["capability", "end_to_end_scenario"] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

// --- papéis formais -------------------------------------------------------

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
 * Finalidade estruturada do portão — o guard decide bloqueios
 * EXCLUSIVAMENTE por `purposeKind`, nunca por varredura de palavras em
 * `purposePt` (correção de revisão independente: a versão anterior
 * procurava substrings como "econôm"/"produtiv" em texto livre, frágil
 * e não estruturado).
 *
 * - `diagnostic`: uso apenas para observação/inspeção, nunca produção.
 * - `development`: uso em desenvolvimento/investigação técnica.
 * - `technical_chaining`: encadeamento técnico entre etapas, sem
 *   reivindicar validação de conteúdo.
 * - `real_validation`: uso como evidência de validação real.
 * - `productive_use`: uso produtivo (ex.: criação de rascunho de Versão
 *   do Orçamento).
 */
export const GATE_PURPOSE_KINDS = ["diagnostic", "development", "technical_chaining", "real_validation", "productive_use"] as const;
export type GatePurposeKind = (typeof GATE_PURPOSE_KINDS)[number];

export const GATE_PURPOSE_KIND_LABELS_PT: Readonly<Record<GatePurposeKind, string>> = {
  diagnostic: "Diagnóstico",
  development: "Desenvolvimento",
  technical_chaining: "Encadeamento técnico",
  real_validation: "Validação real",
  productive_use: "Uso produtivo",
};

/** `real_validation` e `productive_use` são as finalidades que o grafo de dependências pode bloquear/condicionar; `diagnostic`/`development`/`technical_chaining` nunca são bloqueadas por reprovação upstream. */
export function isGatedByDependencyOutcome(purposeKind: GatePurposeKind): boolean {
  return purposeKind === "real_validation" || purposeKind === "productive_use";
}

/**
 * Terceira correção: consumidor estruturado do portão.
 * - `registered_target`: `consumerId` deve ser um id existente neste
 *   mesmo registro, e o alvo produtor (dono do portão) deve aparecer no
 *   fecho transitivo de dependências desse consumidor — nunca um
 *   consumidor interno "solto" sem relação de dependência declarada.
 * - `external_action`: uma ação fora deste registro (ex.: exportação
 *   manual, script de diagnóstico ad-hoc) — declarada explicitamente,
 *   nunca tratada como alvo interno.
 * - `consumer_class`: uma classe/categoria de consumidores (ex.:
 *   "qualquer_consumo_produtivo") — também nunca tratada como alvo
 *   interno.
 */
export const CONSUMER_KINDS = ["registered_target", "external_action", "consumer_class"] as const;
export type ConsumerKind = (typeof CONSUMER_KINDS)[number];

export interface DownstreamGate {
  /** Capacidade/cenário consumidor (id estável), ação externa, ou classe de consumidor — ver `consumerKind`. */
  readonly consumerId: string;
  readonly consumerKind: ConsumerKind;
  readonly purposePt: string;
  readonly purposeKind: GatePurposeKind;
  readonly status: DownstreamGateStatus;
  /**
   * Nível mínimo de evidência exigido, DO PRÓPRIO ALVO E de toda
   * dependência transitiva necessária, para que este portão possa ficar
   * `aberto`. Nunca omitido — mesmo finalidades de baixa exigência
   * (`diagnostic`/`development`/`technical_chaining`) declaram
   * explicitamente seu piso (tipicamente `experimental`), para que o
   * guard sempre verifique contra um valor real, nunca um padrão
   * implícito. `real_validation`/`productive_use` nunca podem declarar
   * um piso abaixo de `MINIMUM_EVIDENCE_LEVEL_FLOOR_FOR_GATED_PURPOSES`.
   */
  readonly minimumEvidenceLevel: RealValidationMaturityLevel;
  /**
   * Resultados aceitos (do próprio alvo e de toda dependência transitiva
   * necessária) para que este portão possa ficar `aberto`. Nunca vazio —
   * um resultado fora desta lista bloqueia o portão.
   */
  readonly allowedResults: ReadonlyArray<ValidationResult>;
  readonly rationalePt: string;
  /** Obrigatório (não vazio) quando `status !== "aberto"`; `null` apenas quando `status === "aberto"`. */
  readonly missingEvidencePt: string | null;
  readonly behaviorWhenBlockedPt: string;
}

// --- evidências -------------------------------------------------------------

/** Regex de validação de SHA-256 completo — usada pelo guard, nunca aceita reticências/truncamento. */
export const FULL_SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** Regex de validação de revisão Git completa (40 caracteres hexadecimais) — nunca um hash abreviado. */
export const GIT_REVISION_PATTERN = /^[0-9a-f]{40}$/;

export interface RealValidationEvidenceReal {
  /** SHA-256 completo (64 caracteres hexadecimais) — nunca truncado, nunca reconstruído de memória. */
  readonly sourceFingerprintSha256: string;
  readonly pageOrTraceRange: string;
  readonly expectedResult: string;
  readonly observedResult: string;
  readonly divergences: ReadonlyArray<string>;
  readonly reportReference: string;
  /**
   * Data ISO em que a expectativa (`expectedResult`) foi genuinamente
   * definida — DEVE ser anterior à execução relatada em
   * `executionReference`. Obrigatória a partir de
   * `comparada_formalmente_em_caso_real`. Nunca preenchida de memória:
   * se não houver um documento/commit/checkpoint anterior comprovando a
   * data, o nível não pode reivindicar comparação formal.
   */
  readonly expectationDefinedAt: string | null;
  /**
   * Referência (documento, commit ou checkpoint) que comprova que a
   * expectativa existia ANTES da execução — nunca um relatório escrito
   * depois, redescrevendo o que "deveria" ter acontecido. Obrigatória a
   * partir de `comparada_formalmente_em_caso_real`.
   */
  readonly expectationReference: string | null;
  /** Referência (commit/checkpoint) da execução real que produziu `observedResult`. */
  readonly executionReference: string;
}

export interface RealValidationEvidenceAdversarial {
  readonly adversarialCasesSummary: string;
  readonly outcomeSummary: string;
  readonly reportReference: string;
}

// --- histórico de avaliações -------------------------------------------------

export interface RealValidationTargetEvaluationHistoryEntry {
  readonly evaluationId: string;
  /** Data ISO (AAAA-MM-DD). */
  readonly date: string;
  /** Revisão do código avaliado (f.0-g.3) — nunca o commit que contém o próprio registro de governança. Formato de commit Git completo (40 hex). */
  readonly evaluatedRevision: string;
  readonly previousLevel: RealValidationMaturityLevel | null;
  readonly previousResult: ValidationResult | null;
  readonly newLevel: RealValidationMaturityLevel;
  readonly newResult: ValidationResult;
  /** Preenchida apenas quando `newResult === "inconclusiva"` — deve corresponder a `inconclusiveCausePt` do registro quando esta é a última entrada. */
  readonly inconclusiveCausePt: string | null;
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

// --- registro por alvo (capacidade ou cenário ponta a ponta) ------------------

export interface RealValidationTargetRecord {
  readonly id: string;
  readonly namePt: string;
  readonly targetKind: TargetKind;
  readonly stageId: string;
  readonly descriptionPt: string;
  readonly currentLevel: RealValidationMaturityLevel;
  readonly currentResult: ValidationResult;
  /** Preenchido apenas quando `currentResult === "inconclusiva"` — a causa da inconclusão (ex.: entrada degradada por falha upstream). `null` nos demais casos. */
  readonly inconclusiveCausePt: string | null;
  readonly syntheticEvidenceSummaryPt: string;
  readonly realEvidence: RealValidationEvidenceReal | null;
  readonly adversarialEvidence: RealValidationEvidenceAdversarial | null;
  /** Estado estruturado da avaliação de falhas — nunca inferido por busca textual. */
  readonly failureAssessment: FailureAssessment;
  readonly knownLimitationsPt: ReadonlyArray<string>;
  readonly knownFailuresPt: ReadonlyArray<string>;
  readonly promotionConditionPt: string | null;
  /** Revisão do código avaliado (f.0-g.3) — nunca o commit que contém o próprio registro de governança. Formato de commit Git completo (40 hex). */
  readonly evaluatedRevision: string;
  readonly lastEvaluatedDate: string;
  readonly technicalReportOwner: string;
  /** Múltiplos portões específicos (consumidor + finalidade estruturada) — nunca um único status genérico. */
  readonly downstreamGates: ReadonlyArray<DownstreamGate>;
  /** Ids de outros alvos deste mesmo registro dos quais este alvo depende — nunca um caminho local, sempre um id estável já registrado. */
  readonly dependsOnTargetIds: ReadonlyArray<string>;
  readonly evaluationHistory: ReadonlyArray<RealValidationTargetEvaluationHistoryEntry>;
  readonly registryVersion: typeof REAL_VALIDATION_MATURITY_REGISTRY_VERSION;
}

export type RealValidationTargetRegistry = ReadonlyArray<RealValidationTargetRecord>;

export type RealValidationTargetIssueCode =
  | "duplicate_id"
  | "unrecognized_level"
  | "unrecognized_result"
  | "unrecognized_target_kind"
  | "unrecognized_failure_assessment"
  | "disallowed_level_result_combination"
  | "missing_real_evidence"
  | "missing_adversarial_evidence"
  | "missing_limitations_declaration"
  | "missing_promotion_condition"
  | "missing_inconclusive_cause"
  | "unexpected_inconclusive_cause"
  | "missing_technical_report_owner"
  | "invalid_evaluated_revision_format"
  | "reprovada_requires_confirmed_failure_assessment"
  | "aprovada_forbids_confirmed_failure_assessment"
  | "inconclusiva_requires_assessable_failure_state"
  | "missing_expectation_provenance"
  | "invalid_expectation_defined_at"
  | "gate_missing_consumer_or_purpose"
  | "gate_unrecognized_purpose_kind"
  | "unrecognized_consumer_kind"
  | "gate_invalid_status"
  | "gate_open_requires_null_missing_evidence"
  | "gate_missing_evidence_when_not_open"
  | "gate_unrecognized_minimum_evidence_level"
  | "gate_invalid_allowed_results"
  | "gate_minimum_evidence_level_too_low_for_purpose"
  | "gate_open_despite_insufficient_evidence_level"
  | "gate_open_despite_disallowed_result"
  | "gate_open_despite_unresolved_dependency"
  | "gate_aberto_requires_no_unresolved_dependency"
  | "gate_consumer_not_registered"
  | "gate_producer_not_in_consumer_dependencies"
  | "duplicate_or_contradictory_gate"
  | "dangling_dependency"
  | "self_dependency"
  | "dependency_cycle"
  | "end_to_end_scenario_missing_dependencies"
  | "missing_evaluation_history"
  | "history_entry_missing_roles"
  | "history_entry_missing_evidence_considered"
  | "history_first_entry_has_previous_state"
  | "history_previous_state_unrecognized"
  | "duplicate_evaluation_id"
  | "history_last_entry_mismatch"
  | "history_chain_broken"
  | "history_invalid_date"
  | "history_dates_not_ordered"
  | "history_disallowed_combination"
  | "suspicious_local_path_in_evidence"
  | "missing_fingerprint"
  | "invalid_fingerprint_format"
  | "missing_expected_or_observed_result";

export interface RealValidationTargetIssue {
  readonly code: RealValidationTargetIssueCode;
  readonly recordId: string;
  readonly message: string;
}
