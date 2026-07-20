import { REAL_VALIDATION_TARGET_REGISTRY } from "./capability-maturity-registry";
import {
  CONSUMER_KINDS,
  FAILURE_ASSESSMENTS,
  FULL_SHA256_PATTERN,
  GATE_PURPOSE_KINDS,
  GIT_REVISION_PATTERN,
  isGatedByDependencyOutcome,
  maturityLevelRank,
  MINIMUM_EVIDENCE_LEVEL_FLOOR_FOR_GATED_PURPOSES,
  PERMITTED_LEVEL_RESULT_COMBINATIONS,
  REAL_VALIDATION_MATURITY_LEVELS,
  DOWNSTREAM_GATE_STATUSES,
  requiresPromotionCondition,
  ROLE_NOT_FORMALIZED,
  TARGET_KINDS,
  VALIDATION_RESULTS,
} from "./real-validation-maturity.types";
import type { RealValidationTargetIssue, RealValidationTargetRecord, RealValidationTargetRegistry, DownstreamGate, ValidationResult } from "./real-validation-maturity.types";

/**
 * Guarda automatizado da Sprint 21.4G (terceira correção, pós-segunda
 * revisão independente) — valida exclusivamente a ESTRUTURA do registro
 * (o registro estruturado é a fonte atual de maturidade), nunca um
 * scanner textual da prosa de documentação. Bloqueios por finalidade de
 * portão são decididos EXCLUSIVAMENTE por `purposeKind` estruturado, pelo
 * grafo de `dependsOnTargetIds`, e agora também pela exigência mínima
 * (`minimumEvidenceLevel`/`allowedResults`) que cada portão declara — o
 * guard verifica o próprio alvo e as dependências transitivas
 * necessárias contra essa exigência, nunca contra um piso universal
 * inventado. Nenhuma decisão depende de substring em texto livre — nem
 * para bloqueio de portão, nem para avaliação de falhas
 * (`failureAssessment` estruturado substitui toda busca pela palavra
 * "nenhuma").
 *
 * `validateRegistry` é exportada para que os testes negativos
 * permanentes (final deste arquivo) possam construir registros
 * deliberadamente inválidos e comprovar que cada classe de violação é
 * rejeitada — sem depender do registro real. Todo teste negativo parte
 * de `baseRecord()`/`baseGate()` (comprovadamente neutros — ver o teste
 * "NEGATIVO — baseRecord() é totalmente válido" abaixo) e introduz
 * exatamente a mudança deliberada necessária para exercitar a violação
 * sob teste.
 */

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(actual: boolean, message: string): void {
  if (!actual) {
    throw new Error(message);
  }
}

const SUSPICIOUS_LOCAL_PATH_PATTERNS: ReadonlyArray<RegExp> = [/_local-documents/i, /^[a-zA-Z]:[\\/]/, /\.pdf$/i, /\.xlsx?$/i, /[\\/]{2,}/];

function containsSuspiciousLocalPath(value: string): boolean {
  return SUSPICIOUS_LOCAL_PATH_PATTERNS.some((pattern) => pattern.test(value));
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Terceira correção: além do parse, exige o round-trip
 * `toISOString().slice(0, 10) === value` — rejeita datas que o JavaScript
 * normaliza silenciosamente (ex.: 2026-02-30 vira 2026-03-02), que o
 * parse isolado (sem round-trip) aceitaria incorretamente.
 */
function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/** Ordem de severidade para agregação de dependências: reprovada > (inconclusiva | nao_avaliada) > aprovada. */
function resultSeverity(result: ValidationResult): number {
  if (result === "reprovada") return 2;
  if (result === "inconclusiva" || result === "nao_avaliada") return 1;
  return 0; // aprovada
}

/** Varredura de todas as dependências transitivas (incluindo o próprio alvo), tolerante a ciclos (nunca entra em loop infinito). */
function collectTransitiveClosure(targetId: string, byId: ReadonlyMap<string, RealValidationTargetRecord>): ReadonlySet<string> {
  const visited = new Set<string>();
  const stack = [targetId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const record = byId.get(current);
    if (!record) continue;
    for (const dep of record.dependsOnTargetIds) {
      if (!visited.has(dep)) stack.push(dep);
    }
  }
  return visited;
}

/** Detecção de ciclo via DFS com pilha de visita corrente — retorna os ids envolvidos em ao menos um ciclo. */
function detectCycleMembers(byId: ReadonlyMap<string, RealValidationTargetRecord>): ReadonlySet<string> {
  const cyclic = new Set<string>();
  const state = new Map<string, "visiting" | "done">();

  function visit(id: string, path: ReadonlyArray<string>): void {
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") {
      const cycleStart = path.indexOf(id);
      for (const member of path.slice(cycleStart)) cyclic.add(member);
      return;
    }
    state.set(id, "visiting");
    const record = byId.get(id);
    if (record) {
      for (const dep of record.dependsOnTargetIds) {
        visit(dep, [...path, id]);
      }
    }
    state.set(id, "done");
  }

  for (const id of byId.keys()) visit(id, []);
  return cyclic;
}

export function validateRegistry(registry: RealValidationTargetRegistry): ReadonlyArray<RealValidationTargetIssue> {
  const issues: RealValidationTargetIssue[] = [];
  const seenIds = new Set<string>();
  const byId = new Map(registry.map((record) => [record.id, record]));
  const seenEvaluationIds = new Set<string>();

  const cyclicIds = detectCycleMembers(byId);

  for (const record of registry) {
    if (seenIds.has(record.id)) {
      issues.push({ code: "duplicate_id", recordId: record.id, message: `identificador duplicado: ${record.id}` });
    }
    seenIds.add(record.id);

    if (!(REAL_VALIDATION_MATURITY_LEVELS as ReadonlyArray<string>).includes(record.currentLevel)) {
      issues.push({ code: "unrecognized_level", recordId: record.id, message: `nível não reconhecido: ${record.currentLevel}` });
    }
    if (!(VALIDATION_RESULTS as ReadonlyArray<string>).includes(record.currentResult)) {
      issues.push({ code: "unrecognized_result", recordId: record.id, message: `resultado não reconhecido: ${record.currentResult}` });
    }
    if (!(TARGET_KINDS as ReadonlyArray<string>).includes(record.targetKind)) {
      issues.push({ code: "unrecognized_target_kind", recordId: record.id, message: `targetKind não reconhecido: ${record.targetKind}` });
    }
    if (!(FAILURE_ASSESSMENTS as ReadonlyArray<string>).includes(record.failureAssessment)) {
      issues.push({ code: "unrecognized_failure_assessment", recordId: record.id, message: `failureAssessment não reconhecido: ${record.failureAssessment}` });
    }

    const permitted = PERMITTED_LEVEL_RESULT_COMBINATIONS[record.currentLevel];
    if (permitted && !permitted.includes(record.currentResult)) {
      issues.push({ code: "disallowed_level_result_combination", recordId: record.id, message: `combinação não permitida: nível=${record.currentLevel}, resultado=${record.currentResult}` });
    }

    // --- estado estruturado de falhas (nunca inferido por texto) ---------
    if (record.currentResult === "reprovada" && (record.failureAssessment !== "confirmed" || record.knownFailuresPt.length === 0)) {
      issues.push({ code: "reprovada_requires_confirmed_failure_assessment", recordId: record.id, message: "resultado reprovada exige failureAssessment 'confirmed' e ao menos uma falha detalhada em knownFailuresPt" });
    }
    if (record.currentResult === "aprovada" && record.failureAssessment !== "none_known") {
      issues.push({ code: "aprovada_forbids_confirmed_failure_assessment", recordId: record.id, message: `resultado aprovada exige failureAssessment 'none_known', obteve '${record.failureAssessment}'` });
    }
    if (record.currentResult === "inconclusiva" && record.failureAssessment === "none_known") {
      issues.push({ code: "inconclusiva_requires_assessable_failure_state", recordId: record.id, message: "resultado inconclusiva nunca pode declarar failureAssessment 'none_known' — exige 'confirmed' ou 'not_assessable'" });
    }
    if (record.currentResult === "nao_avaliada" && record.failureAssessment !== "not_assessable") {
      issues.push({ code: "inconclusiva_requires_assessable_failure_state", recordId: record.id, message: `resultado não avaliada exige failureAssessment 'not_assessable', obteve '${record.failureAssessment}'` });
    }

    if (record.currentResult === "inconclusiva" && (record.inconclusiveCausePt === null || record.inconclusiveCausePt.trim().length === 0)) {
      issues.push({ code: "missing_inconclusive_cause", recordId: record.id, message: "resultado inconclusiva sem inconclusiveCausePt" });
    }
    if (record.currentResult !== "inconclusiva" && record.inconclusiveCausePt !== null) {
      issues.push({ code: "unexpected_inconclusive_cause", recordId: record.id, message: "inconclusiveCausePt preenchido fora de resultado inconclusiva" });
    }

    if (record.technicalReportOwner.trim().length === 0) {
      issues.push({ code: "missing_technical_report_owner", recordId: record.id, message: "technicalReportOwner vazio" });
    }
    if (!GIT_REVISION_PATTERN.test(record.evaluatedRevision)) {
      issues.push({ code: "invalid_evaluated_revision_format", recordId: record.id, message: `evaluatedRevision não é uma revisão Git completa (40 hex): "${record.evaluatedRevision}"` });
    }

    const requiresRealEvidence = record.currentLevel !== "experimental" && record.currentLevel !== "evidenciada_sinteticamente";
    if (requiresRealEvidence && record.realEvidence === null) {
      issues.push({ code: "missing_real_evidence", recordId: record.id, message: "nível exige realEvidence, mas está null" });
    }
    if (record.currentLevel === "submetida_a_teste_adversarial" && record.adversarialEvidence === null) {
      issues.push({ code: "missing_adversarial_evidence", recordId: record.id, message: "'submetida_a_teste_adversarial' exige adversarialEvidence, independente do resultado" });
    }

    if (record.knownLimitationsPt.length === 0) {
      issues.push({ code: "missing_limitations_declaration", recordId: record.id, message: "knownLimitationsPt vazio — declare ao menos a ausência explícita" });
    }

    if (requiresPromotionCondition(record.currentLevel, record.currentResult) && (record.promotionConditionPt === null || record.promotionConditionPt.trim().length === 0)) {
      issues.push({ code: "missing_promotion_condition", recordId: record.id, message: "combinação (nível, resultado) exige promotionConditionPt" });
    }

    if (record.targetKind === "end_to_end_scenario" && record.dependsOnTargetIds.length === 0) {
      issues.push({ code: "end_to_end_scenario_missing_dependencies", recordId: record.id, message: "cenário ponta a ponta sem nenhuma dependência declarada" });
    }

    // --- proveniência da expectativa (nunca reconstruída de memória) ------
    const requiresExpectationProvenance = record.currentLevel === "comparada_formalmente_em_caso_real" || record.currentLevel === "submetida_a_teste_adversarial";
    if (requiresExpectationProvenance && record.realEvidence !== null) {
      const { expectationDefinedAt, expectationReference } = record.realEvidence;
      if (expectationReference === null || expectationReference.trim().length === 0 || expectationDefinedAt === null || expectationDefinedAt.trim().length === 0) {
        issues.push({ code: "missing_expectation_provenance", recordId: record.id, message: "nível exige expectationReference e expectationDefinedAt, comprovando proveniência anterior à execução" });
      } else if (!isValidIsoDate(expectationDefinedAt)) {
        issues.push({ code: "invalid_expectation_defined_at", recordId: record.id, message: `expectationDefinedAt não é uma data ISO válida: "${expectationDefinedAt}"` });
      }
    }

    // --- dependências: dangling, auto-dependência, ciclo ------------------
    for (const depId of record.dependsOnTargetIds) {
      if (depId === record.id) {
        issues.push({ code: "self_dependency", recordId: record.id, message: `alvo depende de si mesmo: ${depId}` });
      }
      if (!byId.has(depId)) {
        issues.push({ code: "dangling_dependency", recordId: record.id, message: `dependência inexistente: ${depId}` });
      }
    }
    if (cyclicIds.has(record.id)) {
      issues.push({ code: "dependency_cycle", recordId: record.id, message: `alvo participa de um ciclo de dependências` });
    }

    // --- portões: estrutura básica ----------------------------------------
    const gateKeySeen = new Set<string>();
    for (const gate of record.downstreamGates) {
      if (gate.consumerId.trim().length === 0 || gate.purposePt.trim().length === 0) {
        issues.push({ code: "gate_missing_consumer_or_purpose", recordId: record.id, message: `portão sem consumidor/finalidade: ${JSON.stringify(gate)}` });
      }
      if (!(GATE_PURPOSE_KINDS as ReadonlyArray<string>).includes(gate.purposeKind)) {
        issues.push({ code: "gate_unrecognized_purpose_kind", recordId: record.id, message: `purposeKind não reconhecido: ${gate.purposeKind}` });
      }
      if (!(CONSUMER_KINDS as ReadonlyArray<string>).includes(gate.consumerKind)) {
        issues.push({ code: "unrecognized_consumer_kind", recordId: record.id, message: `consumerKind não reconhecido: ${gate.consumerKind}` });
      }
      if (!(DOWNSTREAM_GATE_STATUSES as ReadonlyArray<string>).includes(gate.status)) {
        issues.push({ code: "gate_invalid_status", recordId: record.id, message: `status de portão não reconhecido: ${gate.status}` });
      }
      if (gate.status === "aberto" && gate.missingEvidencePt !== null) {
        issues.push({ code: "gate_open_requires_null_missing_evidence", recordId: record.id, message: `portão aberto não pode declarar missingEvidencePt: ${JSON.stringify(gate)}` });
      }
      if (gate.status !== "aberto" && (gate.missingEvidencePt === null || gate.missingEvidencePt.trim().length === 0)) {
        issues.push({ code: "gate_missing_evidence_when_not_open", recordId: record.id, message: `portão não aberto sem evidência faltante declarada: ${JSON.stringify(gate)}` });
      }

      const minimumLevelRecognized = (REAL_VALIDATION_MATURITY_LEVELS as ReadonlyArray<string>).includes(gate.minimumEvidenceLevel);
      if (!minimumLevelRecognized) {
        issues.push({ code: "gate_unrecognized_minimum_evidence_level", recordId: record.id, message: `minimumEvidenceLevel não reconhecido: ${gate.minimumEvidenceLevel}` });
      }
      const allowedResultsRecognized = gate.allowedResults.length > 0 && gate.allowedResults.every((result) => (VALIDATION_RESULTS as ReadonlyArray<string>).includes(result));
      if (!allowedResultsRecognized) {
        issues.push({ code: "gate_invalid_allowed_results", recordId: record.id, message: `allowedResults vazio ou contém valor não reconhecido: ${JSON.stringify(gate.allowedResults)}` });
      }

      if (isGatedByDependencyOutcome(gate.purposeKind) && minimumLevelRecognized && maturityLevelRank(gate.minimumEvidenceLevel) < maturityLevelRank(MINIMUM_EVIDENCE_LEVEL_FLOOR_FOR_GATED_PURPOSES)) {
        issues.push({
          code: "gate_minimum_evidence_level_too_low_for_purpose",
          recordId: record.id,
          message: `portão de finalidade ${gate.purposeKind} nunca pode declarar minimumEvidenceLevel abaixo de ${MINIMUM_EVIDENCE_LEVEL_FLOOR_FOR_GATED_PURPOSES}: ${JSON.stringify(gate)}`,
        });
      }

      // consumidor estruturado
      if (gate.consumerKind === "registered_target") {
        const consumerRecord = byId.get(gate.consumerId);
        if (!consumerRecord) {
          issues.push({ code: "gate_consumer_not_registered", recordId: record.id, message: `consumerKind 'registered_target' aponta para id inexistente: ${gate.consumerId}` });
        } else {
          const consumerClosure = collectTransitiveClosure(gate.consumerId, byId);
          if (!consumerClosure.has(record.id)) {
            issues.push({ code: "gate_producer_not_in_consumer_dependencies", recordId: record.id, message: `alvo produtor (${record.id}) não aparece no fecho de dependências do consumidor registrado (${gate.consumerId})` });
          }
        }
      }

      // duplicidade/contradição: mesma (consumerId, purposeKind) mais de uma vez
      const gateKey = `${gate.consumerId}::${gate.purposeKind}`;
      if (gateKeySeen.has(gateKey)) {
        issues.push({ code: "duplicate_or_contradictory_gate", recordId: record.id, message: `mais de um portão para o mesmo par (consumerId, purposeKind): ${gateKey}` });
      }
      gateKeySeen.add(gateKey);
    }

    // --- elegibilidade de portão aberto: nível mínimo e resultados permitidos, do próprio alvo e de toda dependência transitiva necessária ---
    if (!cyclicIds.has(record.id)) {
      const involved = collectTransitiveClosure(record.id, byId);
      for (const gate of record.downstreamGates) {
        if (gate.status !== "aberto") continue;
        const minimumLevelRecognized = (REAL_VALIDATION_MATURITY_LEVELS as ReadonlyArray<string>).includes(gate.minimumEvidenceLevel);
        const allowedResultsRecognized = gate.allowedResults.length > 0 && gate.allowedResults.every((result) => (VALIDATION_RESULTS as ReadonlyArray<string>).includes(result));
        if (!minimumLevelRecognized || !allowedResultsRecognized) continue; // já reportado acima — evita ruído derivado de um valor já inválido

        const minRank = maturityLevelRank(gate.minimumEvidenceLevel);
        let insufficientLevel = false;
        let disallowedResult = false;
        for (const involvedId of involved) {
          const involvedRecord = byId.get(involvedId);
          if (!involvedRecord) continue;
          if (maturityLevelRank(involvedRecord.currentLevel) < minRank) insufficientLevel = true;
          if (!gate.allowedResults.includes(involvedRecord.currentResult)) disallowedResult = true;
        }
        if (insufficientLevel) {
          issues.push({
            code: "gate_open_despite_insufficient_evidence_level",
            recordId: record.id,
            message: `portão aberto mas o próprio alvo ou uma dependência necessária está abaixo do nível mínimo exigido (${gate.minimumEvidenceLevel}): ${JSON.stringify(gate)}`,
          });
        }
        if (disallowedResult) {
          issues.push({
            code: "gate_open_despite_disallowed_result",
            recordId: record.id,
            message: `portão aberto mas o próprio alvo ou uma dependência necessária tem resultado fora de allowedResults (${JSON.stringify(gate.allowedResults)}): ${JSON.stringify(gate)}`,
          });
        }
      }

      // grafo de dependências decide bloqueios de portões real_validation/productive_use por severidade agregada — nunca varredura de texto
      let worstSeverity = 0;
      for (const involvedId of involved) {
        const involvedRecord = byId.get(involvedId);
        if (involvedRecord) worstSeverity = Math.max(worstSeverity, resultSeverity(involvedRecord.currentResult));
      }
      for (const gate of record.downstreamGates) {
        if (!isGatedByDependencyOutcome(gate.purposeKind)) continue;
        if (worstSeverity === 2 && gate.status !== "bloqueado") {
          issues.push({
            code: "gate_open_despite_unresolved_dependency",
            recordId: record.id,
            message: `dependência (ou o próprio alvo) reprovada exige portão bloqueado para finalidade ${gate.purposeKind}: ${JSON.stringify(gate)}`,
          });
        } else if (worstSeverity === 1 && gate.status === "aberto") {
          issues.push({
            code: "gate_aberto_requires_no_unresolved_dependency",
            recordId: record.id,
            message: `dependência (ou o próprio alvo) inconclusiva/não avaliada não pode sustentar portão aberto para finalidade ${gate.purposeKind}: ${JSON.stringify(gate)}`,
          });
        }
      }
    }

    if (record.realEvidence !== null) {
      if (record.realEvidence.sourceFingerprintSha256.trim().length === 0) {
        issues.push({ code: "missing_fingerprint", recordId: record.id, message: "realEvidence sem fingerprint" });
      } else if (!FULL_SHA256_PATTERN.test(record.realEvidence.sourceFingerprintSha256)) {
        issues.push({ code: "invalid_fingerprint_format", recordId: record.id, message: `fingerprint não é um SHA-256 completo (64 hex): "${record.realEvidence.sourceFingerprintSha256}"` });
      }
      if (record.realEvidence.expectedResult.trim().length === 0 || record.realEvidence.observedResult.trim().length === 0 || record.realEvidence.executionReference.trim().length === 0) {
        issues.push({ code: "missing_expected_or_observed_result", recordId: record.id, message: "realEvidence sem resultado esperado, observado, e/ou executionReference" });
      }
      const fieldsToScan = [
        record.realEvidence.pageOrTraceRange,
        record.realEvidence.reportReference,
        record.realEvidence.expectedResult,
        record.realEvidence.observedResult,
        record.realEvidence.expectationReference ?? "",
        record.realEvidence.executionReference,
      ];
      for (const field of fieldsToScan) {
        if (containsSuspiciousLocalPath(field)) {
          issues.push({ code: "suspicious_local_path_in_evidence", recordId: record.id, message: `campo de evidência real contém padrão de caminho local suspeito: "${field}"` });
        }
      }
    }

    // --- histórico -----------------------------------------------------
    if (record.evaluationHistory.length === 0) {
      issues.push({ code: "missing_evaluation_history", recordId: record.id, message: "evaluationHistory vazio" });
    } else {
      let previousDate: string | null = null;
      record.evaluationHistory.forEach((entry, index) => {
        if (entry.implementer.trim().length === 0 || entry.adversarialReviewer.trim().length === 0 || entry.approver.trim().length === 0) {
          issues.push({ code: "history_entry_missing_roles", recordId: record.id, message: `entrada de histórico sem papéis identificados: ${entry.evaluationId}` });
        }
        if (entry.decisionPt.trim().length === 0 || entry.justificationPt.trim().length === 0) {
          issues.push({ code: "history_entry_missing_roles", recordId: record.id, message: `entrada de histórico sem decisão/justificativa: ${entry.evaluationId}` });
        }
        if (entry.evidenceConsideredPt.length === 0) {
          issues.push({ code: "history_entry_missing_evidence_considered", recordId: record.id, message: `entrada de histórico sem evidenceConsideredPt: ${entry.evaluationId}` });
        }
        if (!GIT_REVISION_PATTERN.test(entry.evaluatedRevision)) {
          issues.push({ code: "invalid_evaluated_revision_format", recordId: record.id, message: `evaluatedRevision da entrada ${entry.evaluationId} não é uma revisão Git completa (40 hex): "${entry.evaluatedRevision}"` });
        }
        if (seenEvaluationIds.has(entry.evaluationId)) {
          issues.push({ code: "duplicate_evaluation_id", recordId: record.id, message: `evaluationId duplicado: ${entry.evaluationId}` });
        }
        seenEvaluationIds.add(entry.evaluationId);

        if (index === 0 && (entry.previousLevel !== null || entry.previousResult !== null)) {
          issues.push({ code: "history_first_entry_has_previous_state", recordId: record.id, message: `primeira entrada do histórico não pode ter previousLevel/previousResult preenchido: ${entry.evaluationId}` });
        }
        if (entry.previousLevel !== null && !(REAL_VALIDATION_MATURITY_LEVELS as ReadonlyArray<string>).includes(entry.previousLevel)) {
          issues.push({ code: "history_previous_state_unrecognized", recordId: record.id, message: `previousLevel não reconhecido em ${entry.evaluationId}: ${entry.previousLevel}` });
        }
        if (entry.previousResult !== null && !(VALIDATION_RESULTS as ReadonlyArray<string>).includes(entry.previousResult)) {
          issues.push({ code: "history_previous_state_unrecognized", recordId: record.id, message: `previousResult não reconhecido em ${entry.evaluationId}: ${entry.previousResult}` });
        }

        if (!isValidIsoDate(entry.date)) {
          issues.push({ code: "history_invalid_date", recordId: record.id, message: `data inválida no histórico: ${entry.date}` });
        } else {
          if (previousDate !== null && entry.date < previousDate) {
            issues.push({ code: "history_dates_not_ordered", recordId: record.id, message: `datas do histórico fora de ordem: ${entry.date} após ${previousDate}` });
          }
          previousDate = entry.date;
        }

        const entryPermitted = PERMITTED_LEVEL_RESULT_COMBINATIONS[entry.newLevel];
        if (!entryPermitted || !entryPermitted.includes(entry.newResult)) {
          issues.push({ code: "history_disallowed_combination", recordId: record.id, message: `combinação histórica não permitida: ${entry.evaluationId} nível=${entry.newLevel} resultado=${entry.newResult}` });
        }

        if (index > 0) {
          const previous = record.evaluationHistory[index - 1];
          if (entry.previousLevel !== previous.newLevel || entry.previousResult !== previous.newResult) {
            issues.push({
              code: "history_chain_broken",
              recordId: record.id,
              message: `encadeamento quebrado em ${entry.evaluationId}: previousLevel/Result (${entry.previousLevel}/${entry.previousResult}) != entrada anterior newLevel/Result (${previous.newLevel}/${previous.newResult})`,
            });
          }
        }
      });

      const lastEntry = record.evaluationHistory[record.evaluationHistory.length - 1];
      if (lastEntry.newLevel !== record.currentLevel || lastEntry.newResult !== record.currentResult) {
        issues.push({
          code: "history_last_entry_mismatch",
          recordId: record.id,
          message: `última entrada do histórico (${lastEntry.newLevel}/${lastEntry.newResult}) não corresponde ao estado atual do registro (${record.currentLevel}/${record.currentResult})`,
        });
      }
      if (lastEntry.evaluatedRevision !== record.evaluatedRevision) {
        issues.push({ code: "history_last_entry_mismatch", recordId: record.id, message: "evaluatedRevision da última entrada não corresponde ao registro" });
      }
      if (lastEntry.date !== record.lastEvaluatedDate) {
        issues.push({ code: "history_last_entry_mismatch", recordId: record.id, message: "date da última entrada não corresponde a lastEvaluatedDate do registro" });
      }
      if (lastEntry.inconclusiveCausePt !== record.inconclusiveCausePt) {
        issues.push({ code: "history_last_entry_mismatch", recordId: record.id, message: "inconclusiveCausePt da última entrada não corresponde ao registro" });
      }
      if (record.knownLimitationsPt.length > 0 && lastEntry.limitationsPt.length === 0) {
        issues.push({ code: "history_last_entry_mismatch", recordId: record.id, message: "registro declara limitações, mas a última entrada do histórico não registra nenhuma" });
      }
      if (record.knownFailuresPt.length > 0 && lastEntry.knownFailuresPt.length === 0) {
        issues.push({ code: "history_last_entry_mismatch", recordId: record.id, message: "registro declara falhas conhecidas, mas a última entrada do histórico não registra nenhuma" });
      }
    }
  }

  return issues;
}

function issuesOfCode(code: RealValidationTargetIssue["code"], registry: RealValidationTargetRegistry = REAL_VALIDATION_TARGET_REGISTRY): ReadonlyArray<RealValidationTargetIssue> {
  return validateRegistry(registry).filter((issue) => issue.code === code);
}

// ============================================================================
// Verificações estruturais sobre o registro real
// ============================================================================

runTest("o registro não está vazio e cobre f.0 a g.3, a caracterização econômica e o cenário ponta a ponta", () => {
  assertTrue(REAL_VALIDATION_TARGET_REGISTRY.length >= 10, `esperado >= 10 alvos, obteve ${REAL_VALIDATION_TARGET_REGISTRY.length}`);
});

runTest("nenhum identificador duplicado", () => assertEqual(issuesOfCode("duplicate_id").length, 0));
runTest("nenhum nível não reconhecido", () => assertEqual(issuesOfCode("unrecognized_level").length, 0));
runTest("nenhum resultado não reconhecido", () => assertEqual(issuesOfCode("unrecognized_result").length, 0));
runTest("nenhum targetKind não reconhecido", () => assertEqual(issuesOfCode("unrecognized_target_kind").length, 0));
runTest("nenhum failureAssessment não reconhecido", () => assertEqual(issuesOfCode("unrecognized_failure_assessment").length, 0));
runTest("nenhuma combinação (nível, resultado) fora das permitidas", () => assertEqual(issuesOfCode("disallowed_level_result_combination").length, 0, JSON.stringify(issuesOfCode("disallowed_level_result_combination"))));
runTest("toda reprovação declara failureAssessment 'confirmed' com falhas detalhadas", () => assertEqual(issuesOfCode("reprovada_requires_confirmed_failure_assessment").length, 0, JSON.stringify(issuesOfCode("reprovada_requires_confirmed_failure_assessment"))));
runTest("nenhuma aprovação esconde um failureAssessment 'confirmed'", () => assertEqual(issuesOfCode("aprovada_forbids_confirmed_failure_assessment").length, 0));
runTest("nenhuma inconclusão/não-avaliação declara failureAssessment incompatível", () => assertEqual(issuesOfCode("inconclusiva_requires_assessable_failure_state").length, 0, JSON.stringify(issuesOfCode("inconclusiva_requires_assessable_failure_state"))));
runTest("toda inconclusão possui causa registrada", () => assertEqual(issuesOfCode("missing_inconclusive_cause").length, 0));
runTest("nenhuma causa de inconclusão fora de resultado inconclusiva", () => assertEqual(issuesOfCode("unexpected_inconclusive_cause").length, 0));
runTest("todo alvo declara technicalReportOwner", () => assertEqual(issuesOfCode("missing_technical_report_owner").length, 0));
runTest("toda evaluatedRevision (registro e histórico) é uma revisão Git completa de 40 hex", () => assertEqual(issuesOfCode("invalid_evaluated_revision_format").length, 0, JSON.stringify(issuesOfCode("invalid_evaluated_revision_format"))));
runTest("validação real exige evidência real quando o nível o requer", () => assertEqual(issuesOfCode("missing_real_evidence").length, 0));
runTest("'submetida_a_teste_adversarial' sempre exige evidência adversarial", () => assertEqual(issuesOfCode("missing_adversarial_evidence").length, 0));
runTest("toda capacidade declara limitações, mesmo que para afirmar ausência explícita", () => assertEqual(issuesOfCode("missing_limitations_declaration").length, 0));
runTest("toda combinação (nível, resultado) não terminal-aprovada exige condição de promoção", () => assertEqual(issuesOfCode("missing_promotion_condition").length, 0));
runTest("cenário ponta a ponta sempre declara dependências", () => assertEqual(issuesOfCode("end_to_end_scenario_missing_dependencies").length, 0));
runTest("nível comparada_formalmente_em_caso_real/submetida_a_teste_adversarial sempre declara proveniência de expectativa", () => assertEqual(issuesOfCode("missing_expectation_provenance").length, 0, JSON.stringify(issuesOfCode("missing_expectation_provenance"))));
runTest("expectationDefinedAt é sempre uma data ISO válida", () => assertEqual(issuesOfCode("invalid_expectation_defined_at").length, 0));
runTest("nenhuma auto-dependência", () => assertEqual(issuesOfCode("self_dependency").length, 0));
runTest("nenhuma dependência inexistente", () => assertEqual(issuesOfCode("dangling_dependency").length, 0));
runTest("nenhum ciclo de dependências", () => assertEqual(issuesOfCode("dependency_cycle").length, 0));
runTest("todo portão possui consumidor e finalidade", () => assertEqual(issuesOfCode("gate_missing_consumer_or_purpose").length, 0));
runTest("todo purposeKind de portão é reconhecido", () => assertEqual(issuesOfCode("gate_unrecognized_purpose_kind").length, 0));
runTest("todo consumerKind de portão é reconhecido", () => assertEqual(issuesOfCode("unrecognized_consumer_kind").length, 0));
runTest("todo status de portão é reconhecido", () => assertEqual(issuesOfCode("gate_invalid_status").length, 0));
runTest("nenhum portão aberto declara missingEvidencePt", () => assertEqual(issuesOfCode("gate_open_requires_null_missing_evidence").length, 0));
runTest("todo portão não aberto declara evidência faltante", () => assertEqual(issuesOfCode("gate_missing_evidence_when_not_open").length, 0));
runTest("todo minimumEvidenceLevel de portão é reconhecido", () => assertEqual(issuesOfCode("gate_unrecognized_minimum_evidence_level").length, 0));
runTest("todo allowedResults de portão é não vazio e reconhecido", () => assertEqual(issuesOfCode("gate_invalid_allowed_results").length, 0));
runTest("nenhum portão real_validation/productive_use declara piso abaixo do mínimo exigido", () => assertEqual(issuesOfCode("gate_minimum_evidence_level_too_low_for_purpose").length, 0, JSON.stringify(issuesOfCode("gate_minimum_evidence_level_too_low_for_purpose"))));
runTest("nenhum portão aberto com alvo/dependência abaixo do nível mínimo exigido", () => assertEqual(issuesOfCode("gate_open_despite_insufficient_evidence_level").length, 0, JSON.stringify(issuesOfCode("gate_open_despite_insufficient_evidence_level"))));
runTest("nenhum portão aberto com alvo/dependência em resultado não permitido", () => assertEqual(issuesOfCode("gate_open_despite_disallowed_result").length, 0, JSON.stringify(issuesOfCode("gate_open_despite_disallowed_result"))));
runTest("nenhum portão real_validation/productive_use aberto com dependência (ou o próprio alvo) reprovada", () => assertEqual(issuesOfCode("gate_open_despite_unresolved_dependency").length, 0, JSON.stringify(issuesOfCode("gate_open_despite_unresolved_dependency"))));
runTest("nenhum portão real_validation/productive_use aberto com dependência (ou o próprio alvo) inconclusiva/não avaliada", () => assertEqual(issuesOfCode("gate_aberto_requires_no_unresolved_dependency").length, 0, JSON.stringify(issuesOfCode("gate_aberto_requires_no_unresolved_dependency"))));
runTest("todo consumidor registrado existe no registro", () => assertEqual(issuesOfCode("gate_consumer_not_registered").length, 0));
runTest("todo produtor aparece no fecho de dependências de seu consumidor registrado", () => assertEqual(issuesOfCode("gate_producer_not_in_consumer_dependencies").length, 0, JSON.stringify(issuesOfCode("gate_producer_not_in_consumer_dependencies"))));
runTest("nenhum portão duplicado ou contraditório", () => assertEqual(issuesOfCode("duplicate_or_contradictory_gate").length, 0));
runTest("nenhuma evidência real contém fingerprint vazio", () => assertEqual(issuesOfCode("missing_fingerprint").length, 0));
runTest("todo fingerprint real é um SHA-256 completo de 64 caracteres hexadecimais", () => assertEqual(issuesOfCode("invalid_fingerprint_format").length, 0, JSON.stringify(issuesOfCode("invalid_fingerprint_format"))));
runTest("nenhuma evidência real omite resultado esperado, observado ou executionReference", () => assertEqual(issuesOfCode("missing_expected_or_observed_result").length, 0));
runTest("nenhum campo de evidência real contém padrão de caminho local suspeito", () => assertEqual(issuesOfCode("suspicious_local_path_in_evidence").length, 0));
runTest("histórico de avaliação existe para todo alvo já avaliado", () => assertEqual(issuesOfCode("missing_evaluation_history").length, 0));
runTest("toda entrada de histórico identifica papéis, decisão e justificativa", () => assertEqual(issuesOfCode("history_entry_missing_roles").length, 0));
runTest("toda entrada de histórico declara evidenceConsideredPt", () => assertEqual(issuesOfCode("history_entry_missing_evidence_considered").length, 0));
runTest("a primeira entrada de histórico nunca preenche previousLevel/previousResult", () => assertEqual(issuesOfCode("history_first_entry_has_previous_state").length, 0));
runTest("previousLevel/previousResult históricos, quando preenchidos, são sempre reconhecidos", () => assertEqual(issuesOfCode("history_previous_state_unrecognized").length, 0));
runTest("nenhum evaluationId duplicado em todo o registro", () => assertEqual(issuesOfCode("duplicate_evaluation_id").length, 0));
runTest("a última entrada do histórico corresponde ao estado atual do registro", () => assertEqual(issuesOfCode("history_last_entry_mismatch").length, 0, JSON.stringify(issuesOfCode("history_last_entry_mismatch"))));
runTest("o encadeamento do histórico nunca está quebrado", () => assertEqual(issuesOfCode("history_chain_broken").length, 0));
runTest("todas as datas do histórico são ISO válidas", () => assertEqual(issuesOfCode("history_invalid_date").length, 0));
runTest("as datas do histórico estão em ordem não decrescente", () => assertEqual(issuesOfCode("history_dates_not_ordered").length, 0));
runTest("toda combinação histórica (nível, resultado) é permitida", () => assertEqual(issuesOfCode("history_disallowed_combination").length, 0));

// ============================================================================
// Verificações específicas de classificação (per mandato)
// ============================================================================

runTest("f.0: nível exercitada_em_caso_real, resultado não avaliada", () => {
  const f0 = REAL_VALIDATION_TARGET_REGISTRY.find((r) => r.id === "f0-normalized-text-item-geometry");
  assertTrue(f0 !== undefined, "registro de f.0 deve existir");
  assertEqual(f0!.currentLevel, "exercitada_em_caso_real");
  assertEqual(f0!.currentResult, "nao_avaliada");
});

runTest("f.1: nível exercitada_em_caso_real, resultado não avaliada (nunca 'aprovada informal')", () => {
  const f1 = REAL_VALIDATION_TARGET_REGISTRY.find((r) => r.id === "f1-structure-reconstruction");
  assertTrue(f1 !== undefined, "registro de f.1 deve existir");
  assertEqual(f1!.currentLevel, "exercitada_em_caso_real");
  assertEqual(f1!.currentResult, "nao_avaliada");
  const econGate = f1!.downstreamGates.find((g) => g.consumerId === "econ-budget-document-economic-characterization");
  assertTrue(econGate !== undefined && econGate.status === "bloqueado", "portão de validação real de f.1 deve estar bloqueado, nunca condicional, enquanto f.2a estiver reprovada");
  const draftGate = f1!.downstreamGates.find((g) => g.consumerId === "budget_version_draft_creation");
  assertTrue(draftGate !== undefined && draftGate.status === "bloqueado", "portão de uso produtivo de f.1 deve estar bloqueado");
});

runTest("f.2a: nível submetida_a_teste_adversarial, resultado reprovada, com proveniência de expectativa e evidência adversarial", () => {
  const f2a = REAL_VALIDATION_TARGET_REGISTRY.find((r) => r.id === "f2a-tabular-region-detection");
  assertTrue(f2a !== undefined, "registro de f.2a deve existir");
  assertEqual(f2a!.currentLevel, "submetida_a_teste_adversarial");
  assertEqual(f2a!.currentResult, "reprovada");
  assertEqual(f2a!.failureAssessment, "confirmed");
  assertTrue(f2a!.knownFailuresPt.length > 0, "f.2a deve ter falhas conhecidas");
  assertTrue(f2a!.adversarialEvidence !== null, "f.2a deve ter evidência adversarial (Caso J/L7/L3)");
  assertTrue(f2a!.realEvidence !== null && f2a!.realEvidence.expectationReference !== null && f2a!.realEvidence.expectationDefinedAt !== null, "f.2a deve declarar proveniência de expectativa anterior à execução");
});

runTest("caracterização econômica: nível exercitada_em_caso_real, resultado inconclusiva (nunca reprovada) — o defeito pertence a f.2a e ao cenário ponta a ponta", () => {
  const econ = REAL_VALIDATION_TARGET_REGISTRY.find((r) => r.id === "econ-budget-document-economic-characterization");
  assertTrue(econ !== undefined, "registro da caracterização econômica deve existir");
  assertEqual(econ!.targetKind, "capability");
  assertEqual(econ!.currentLevel, "exercitada_em_caso_real");
  assertEqual(econ!.currentResult, "inconclusiva");
  assertTrue(econ!.inconclusiveCausePt !== null && econ!.inconclusiveCausePt.length > 0, "causa da inconclusão deve estar registrada");
});

runTest("cenário ponta a ponta tender-budget-real-extraction-e2e: nível comparada_formalmente_em_caso_real, resultado reprovada, depende de todas as 9 capacidades, com proveniência de expectativa", () => {
  const e2e = REAL_VALIDATION_TARGET_REGISTRY.find((r) => r.id === "tender-budget-real-extraction-e2e");
  assertTrue(e2e !== undefined, "registro do cenário ponta a ponta deve existir");
  assertEqual(e2e!.targetKind, "end_to_end_scenario");
  assertEqual(e2e!.currentLevel, "comparada_formalmente_em_caso_real");
  assertEqual(e2e!.currentResult, "reprovada");
  assertEqual(e2e!.dependsOnTargetIds.length, 9);
  assertTrue(e2e!.dependsOnTargetIds.includes("econ-budget-document-economic-characterization"), "cenário ponta a ponta deve depender da caracterização econômica");
  assertTrue(e2e!.dependsOnTargetIds.includes("f2a-tabular-region-detection"), "cenário ponta a ponta deve depender de f.2a");
  assertTrue(e2e!.realEvidence !== null && e2e!.realEvidence.expectationReference !== null && e2e!.realEvidence.expectationDefinedAt !== null, "cenário ponta a ponta deve declarar proveniência de expectativa anterior à execução (fixture Lagoa do Arroz, Sprint 21.3B)");
});

runTest("f.2b a g.3 estão todas exercitada_em_caso_real / inconclusiva por entrada degradada upstream", () => {
  const ids = [
    "f2b-physical-column-hypothesis-reconstruction",
    "f2c-physical-cell-hypothesis-formation",
    "g1-physical-cell-text-evidence-formation",
    "g2-page-local-neutral-structured-evidence-formation",
    "g3-page-boundary-neutral-continuity-evaluation",
  ];
  for (const id of ids) {
    const record = REAL_VALIDATION_TARGET_REGISTRY.find((r) => r.id === id);
    assertTrue(record !== undefined, `registro ${id} deve existir`);
    assertEqual(record!.currentLevel, "exercitada_em_caso_real", `${id} deve estar em exercitada_em_caso_real`);
    assertEqual(record!.currentResult, "inconclusiva", `${id} deve estar inconclusiva`);
    assertTrue(record!.inconclusiveCausePt !== null && record!.inconclusiveCausePt.length > 0, `${id} deve declarar a causa da inconclusão`);
  }
});

runTest("todos os fingerprints reais usam o SHA-256 completo do documento (64 caracteres)", () => {
  for (const record of REAL_VALIDATION_TARGET_REGISTRY) {
    if (record.realEvidence) {
      assertEqual(record.realEvidence.sourceFingerprintSha256.length, 64, `${record.id}: fingerprint deve ter 64 caracteres`);
      assertTrue(FULL_SHA256_PATTERN.test(record.realEvidence.sourceFingerprintSha256), `${record.id}: fingerprint deve ser hexadecimal completo`);
    }
  }
});

runTest("nenhum papel de aprovador humano é apresentado como já formalizado nesta rodada", () => {
  for (const record of REAL_VALIDATION_TARGET_REGISTRY) {
    for (const entry of record.evaluationHistory) {
      assertEqual(entry.approver, ROLE_NOT_FORMALIZED, `${record.id}/${entry.evaluationId}: aprovação humana final ainda não pode estar formalizada`);
    }
  }
});

// ============================================================================
// Imutabilidade profunda — tentativas de mutação devem falhar/não ter efeito
// ============================================================================

function attemptMutationHasNoEffect<T extends object>(target: T, mutate: () => void, describe: () => unknown): void {
  const before = JSON.stringify(describe());
  try {
    mutate();
  } catch {
    // esperado em modo estrito (módulos ES são sempre estritos) — mutação rejeitada.
  }
  const after = JSON.stringify(describe());
  assertEqual(after, before, "estrutura congelada não pode ser alterada, mesmo quando a atribuição não lança exceção");
}

runTest("imutabilidade: propriedade de nível do registro não pode ser alterada", () => {
  const record = REAL_VALIDATION_TARGET_REGISTRY[0];
  attemptMutationHasNoEffect(
    record,
    () => {
      (record as { currentLevel: string }).currentLevel = "experimental";
    },
    () => record.currentLevel,
  );
});

runTest("imutabilidade: status de portão não pode ser alterado", () => {
  const record = REAL_VALIDATION_TARGET_REGISTRY.find((r) => r.id === "f2a-tabular-region-detection")!;
  const gate = record.downstreamGates[0];
  attemptMutationHasNoEffect(
    gate,
    () => {
      (gate as { status: string }).status = "aberto";
    },
    () => gate.status,
  );
});

runTest("imutabilidade: item de histórico não pode ser alterado", () => {
  const record = REAL_VALIDATION_TARGET_REGISTRY[0];
  const entry = record.evaluationHistory[0];
  attemptMutationHasNoEffect(
    entry,
    () => {
      (entry as { newResult: string }).newResult = "aprovada";
    },
    () => entry.newResult,
  );
});

runTest("imutabilidade: array de falhas conhecidas não pode ser alterado (push)", () => {
  const record = REAL_VALIDATION_TARGET_REGISTRY.find((r) => r.id === "f2a-tabular-region-detection")!;
  attemptMutationHasNoEffect(
    record,
    () => {
      (record.knownFailuresPt as Array<string>).push("falha injetada");
    },
    () => record.knownFailuresPt,
  );
});

runTest("imutabilidade: evidência real não pode ser alterada", () => {
  const record = REAL_VALIDATION_TARGET_REGISTRY.find((r) => r.id === "f2a-tabular-region-detection")!;
  const evidence = record.realEvidence!;
  attemptMutationHasNoEffect(
    evidence,
    () => {
      (evidence as { observedResult: string }).observedResult = "resultado adulterado";
    },
    () => evidence.observedResult,
  );
});

runTest("imutabilidade: array de dependências não pode ser alterado (push)", () => {
  const record = REAL_VALIDATION_TARGET_REGISTRY.find((r) => r.id === "f2a-tabular-region-detection")!;
  attemptMutationHasNoEffect(
    record,
    () => {
      (record.dependsOnTargetIds as Array<string>).push("dependencia-injetada");
    },
    () => record.dependsOnTargetIds,
  );
});

runTest("imutabilidade: o array do registro inteiro não pode receber novo elemento (push)", () => {
  const lengthBefore = REAL_VALIDATION_TARGET_REGISTRY.length;
  try {
    (REAL_VALIDATION_TARGET_REGISTRY as unknown as Array<unknown>).push({});
  } catch {
    // esperado
  }
  assertEqual(REAL_VALIDATION_TARGET_REGISTRY.length, lengthBefore, "o array do registro não pode crescer");
});

// ============================================================================
// Testes negativos permanentes — cada um comprova que o guard REJEITA a
// violação correspondente, construindo um registro mínimo e deliberadamente
// inválido a partir de baseRecord()/baseGate() (nunca o registro real).
// Mantidos permanentemente no repositório (nunca criados e apagados) —
// Sprint 21.4G, terceira correção de revisão independente.
// ============================================================================

function baseGate(overrides: Partial<DownstreamGate> = {}): DownstreamGate {
  return {
    consumerId: "algum-consumidor",
    consumerKind: "external_action",
    purposePt: "alguma finalidade",
    purposeKind: "diagnostic",
    status: "aberto",
    minimumEvidenceLevel: "experimental",
    allowedResults: ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"],
    rationalePt: "justificativa",
    missingEvidencePt: null,
    behaviorWhenBlockedPt: "N/A",
    ...overrides,
  };
}

function baseRecord(overrides: Partial<RealValidationTargetRecord> = {}): RealValidationTargetRecord {
  return {
    id: "fake-target",
    namePt: "Alvo Fictício",
    targetKind: "capability",
    stageId: "0.0.0",
    descriptionPt: "Alvo fictício exclusivamente para teste negativo do guard — nunca uma capacidade real.",
    currentLevel: "experimental",
    currentResult: "nao_avaliada",
    inconclusiveCausePt: null,
    syntheticEvidenceSummaryPt: "N/A",
    realEvidence: null,
    adversarialEvidence: null,
    failureAssessment: "not_assessable",
    knownLimitationsPt: ["nenhuma limitação conhecida registrada"],
    knownFailuresPt: [],
    promotionConditionPt: "Definir suíte de testes sintéticos abrangente.",
    evaluatedRevision: "0".repeat(40),
    lastEvaluatedDate: "2026-01-01",
    technicalReportOwner: "Teste",
    downstreamGates: [],
    dependsOnTargetIds: [],
    evaluationHistory: [
      {
        evaluationId: "fake-eval-001",
        date: "2026-01-01",
        evaluatedRevision: "0".repeat(40),
        previousLevel: null,
        previousResult: null,
        newLevel: "experimental",
        newResult: "nao_avaliada",
        inconclusiveCausePt: null,
        evidenceConsideredPt: ["evidência fictícia de teste"],
        limitationsPt: ["nenhuma limitação conhecida registrada"],
        knownFailuresPt: [],
        implementer: "Teste",
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "registro fictício",
        justificationPt: "registro fictício",
      },
    ],
    registryVersion: REAL_VALIDATION_TARGET_REGISTRY[0].registryVersion,
    ...overrides,
  };
}

/** Um alvo fictício válido, profundo (comparada_formalmente_em_caso_real / aprovada) — usado como cenário/dependência neutra em testes que precisam de um nó "saudável" ao lado do nó deliberadamente violador. */
function validDeepApprovedRecord(overrides: Partial<RealValidationTargetRecord> = {}): RealValidationTargetRecord {
  return baseRecord({
    currentLevel: "comparada_formalmente_em_caso_real",
    currentResult: "aprovada",
    failureAssessment: "none_known",
    realEvidence: {
      sourceFingerprintSha256: "a".repeat(64),
      pageOrTraceRange: "x",
      expectedResult: "x",
      observedResult: "x",
      divergences: [],
      reportReference: "x",
      expectationDefinedAt: "2026-01-01",
      expectationReference: "x",
      executionReference: "x",
    },
    evaluationHistory: [
      {
        ...baseRecord().evaluationHistory[0],
        newLevel: "comparada_formalmente_em_caso_real",
        newResult: "aprovada",
      },
    ],
    ...overrides,
  });
}

runTest("NEGATIVO — baseRecord() é totalmente válido (nenhuma violação estrutural)", () => {
  const issues = validateRegistry([baseRecord()]);
  assertEqual(issues.length, 0, `baseRecord() deveria ser neutro, mas produziu: ${JSON.stringify(issues)}`);
});

runTest("NEGATIVO — nível inválido é rejeitado", () => {
  const bad = baseRecord({ currentLevel: "nivel_inventado" as never });
  assertTrue(issuesOfCode("unrecognized_level", [bad]).length > 0, "guard deve rejeitar nível inválido");
});

runTest("NEGATIVO — resultado inválido é rejeitado", () => {
  const bad = baseRecord({ currentResult: "resultado_inventado" as never });
  assertTrue(issuesOfCode("unrecognized_result", [bad]).length > 0, "guard deve rejeitar resultado inválido");
});

runTest("NEGATIVO — fingerprint truncado é rejeitado", () => {
  const bad = baseRecord({
    currentLevel: "exercitada_em_caso_real",
    realEvidence: { sourceFingerprintSha256: "5031da75...b92c5", pageOrTraceRange: "x", expectedResult: "x", observedResult: "x", divergences: [], reportReference: "x", expectationDefinedAt: null, expectationReference: null, executionReference: "x" },
  });
  assertTrue(issuesOfCode("invalid_fingerprint_format", [bad]).length > 0, "guard deve rejeitar fingerprint truncado");
});

runTest("NEGATIVO — aprovação sintética (evidenciada_sinteticamente) tentando abrir portão real_validation é rejeitada", () => {
  const bad = baseRecord({
    currentLevel: "evidenciada_sinteticamente",
    currentResult: "aprovada",
    failureAssessment: "none_known",
    downstreamGates: [baseGate({ purposeKind: "real_validation", status: "aberto", minimumEvidenceLevel: "comparada_formalmente_em_caso_real", allowedResults: ["aprovada"] })],
    evaluationHistory: [{ ...baseRecord().evaluationHistory[0], newLevel: "evidenciada_sinteticamente", newResult: "aprovada" }],
  });
  assertTrue(issuesOfCode("gate_open_despite_insufficient_evidence_level", [bad]).length > 0, "guard deve rejeitar portão real_validation aberto quando o nível do próprio alvo é insuficiente");
});

runTest("NEGATIVO — nível insuficiente tentando abrir portão productive_use é rejeitado", () => {
  const bad = baseRecord({
    currentLevel: "exercitada_em_caso_real",
    currentResult: "aprovada",
    failureAssessment: "none_known",
    downstreamGates: [baseGate({ purposeKind: "productive_use", status: "aberto", minimumEvidenceLevel: "comparada_formalmente_em_caso_real", allowedResults: ["aprovada"] })],
    evaluationHistory: [{ ...baseRecord().evaluationHistory[0], newLevel: "exercitada_em_caso_real", newResult: "aprovada" }],
  });
  assertTrue(issuesOfCode("gate_open_despite_insufficient_evidence_level", [bad]).length > 0, "guard deve rejeitar portão productive_use aberto quando o nível do próprio alvo é insuficiente");
});

runTest("NEGATIVO — resultado fora de allowedResults sustentando portão aberto é rejeitado", () => {
  const bad = validDeepApprovedRecord({
    currentResult: "reprovada",
    failureAssessment: "confirmed",
    knownFailuresPt: ["falha real detalhada"],
    downstreamGates: [baseGate({ purposeKind: "real_validation", status: "aberto", minimumEvidenceLevel: "comparada_formalmente_em_caso_real", allowedResults: ["aprovada"] })],
    evaluationHistory: [{ ...validDeepApprovedRecord().evaluationHistory[0], newResult: "reprovada" }],
    knownLimitationsPt: ["nenhuma limitação conhecida registrada"],
  });
  assertTrue(issuesOfCode("gate_open_despite_disallowed_result", [bad]).length > 0, "guard deve rejeitar portão aberto quando o resultado do alvo não está em allowedResults");
});

runTest("NEGATIVO — portão real_validation/productive_use declarando piso abaixo do mínimo exigido é rejeitado", () => {
  const bad = baseRecord({
    downstreamGates: [baseGate({ purposeKind: "productive_use", status: "bloqueado", missingEvidencePt: "x", minimumEvidenceLevel: "experimental", allowedResults: ["aprovada"] })],
  });
  assertTrue(issuesOfCode("gate_minimum_evidence_level_too_low_for_purpose", [bad]).length > 0, "guard deve rejeitar portão produtivo/real_validation com piso abaixo do mínimo exigido");
});

runTest("NEGATIVO — finalidade produtiva aberta com dependência reprovada é rejeitada", () => {
  const upstream = validDeepApprovedRecord({ id: "fake-upstream-reprovada", currentResult: "reprovada", failureAssessment: "confirmed", knownFailuresPt: ["falha real"], evaluationHistory: [{ ...validDeepApprovedRecord().evaluationHistory[0], newResult: "reprovada" }] });
  const downstream = baseRecord({
    id: "fake-downstream",
    dependsOnTargetIds: ["fake-upstream-reprovada"],
    downstreamGates: [baseGate({ purposeKind: "productive_use", status: "aberto", minimumEvidenceLevel: "experimental", allowedResults: ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"] })],
  });
  assertTrue(issuesOfCode("gate_open_despite_unresolved_dependency", [upstream, downstream]).length > 0, "guard deve rejeitar portão produtivo aberto com dependência reprovada");
});

runTest("NEGATIVO — expectationReference/expectationDefinedAt ausentes em nível que os exige é rejeitado", () => {
  const bad = validDeepApprovedRecord({
    realEvidence: { sourceFingerprintSha256: "a".repeat(64), pageOrTraceRange: "x", expectedResult: "x", observedResult: "x", divergences: [], reportReference: "x", expectationDefinedAt: null, expectationReference: null, executionReference: "x" },
  });
  assertTrue(issuesOfCode("missing_expectation_provenance", [bad]).length > 0, "guard deve rejeitar comparação formal sem proveniência de expectativa");
});

runTest("NEGATIVO — expectationDefinedAt com data impossível é rejeitado", () => {
  const bad = validDeepApprovedRecord({
    realEvidence: { sourceFingerprintSha256: "a".repeat(64), pageOrTraceRange: "x", expectedResult: "x", observedResult: "x", divergences: [], reportReference: "x", expectationDefinedAt: "2026-02-30", expectationReference: "x", executionReference: "x" },
  });
  assertTrue(issuesOfCode("invalid_expectation_defined_at", [bad]).length > 0, "guard deve rejeitar expectationDefinedAt com data impossível");
});

const IMPOSSIBLE_DATES = ["2026-02-29", "2026-02-30", "2026-02-31", "2026-13-01", "2026-00-10", "2026-01-00"];
runTest("NEGATIVO — datas impossíveis no histórico são rejeitadas (2026 não é bissexto; meses/dias fora de alcance)", () => {
  for (const badDate of IMPOSSIBLE_DATES) {
    const bad = baseRecord({
      lastEvaluatedDate: badDate,
      evaluationHistory: [{ ...baseRecord().evaluationHistory[0], date: badDate }],
    });
    assertTrue(issuesOfCode("history_invalid_date", [bad]).length > 0, `data impossível deveria ser rejeitada: ${badDate}`);
  }
});

runTest("NEGATIVO — failureAssessment inconsistente com o resultado é rejeitado", () => {
  const bad = baseRecord({
    currentLevel: "evidenciada_sinteticamente",
    currentResult: "reprovada",
    failureAssessment: "none_known",
    knownFailuresPt: ["uma falha real detalhada"],
    evaluationHistory: [{ ...baseRecord().evaluationHistory[0], newLevel: "evidenciada_sinteticamente", newResult: "reprovada", knownFailuresPt: ["uma falha real detalhada"] }],
  });
  assertTrue(issuesOfCode("reprovada_requires_confirmed_failure_assessment", [bad]).length > 0, "guard deve rejeitar reprovada com failureAssessment diferente de 'confirmed'");
});

runTest("NEGATIVO — consumidor interno inexistente (registered_target) é rejeitado", () => {
  const bad = baseRecord({
    downstreamGates: [baseGate({ consumerId: "id-que-nao-existe", consumerKind: "registered_target" })],
  });
  assertTrue(issuesOfCode("gate_consumer_not_registered", [bad]).length > 0, "guard deve rejeitar consumerKind registered_target apontando para id inexistente");
});

runTest("NEGATIVO — produtor não pertencente ao fecho de dependências do consumidor registrado é rejeitado", () => {
  const producer = baseRecord({
    id: "fake-producer-x",
    downstreamGates: [baseGate({ consumerId: "fake-consumer-x", consumerKind: "registered_target" })],
  });
  const consumer = baseRecord({ id: "fake-consumer-x" });
  assertTrue(issuesOfCode("gate_producer_not_in_consumer_dependencies", [producer, consumer]).length > 0, "guard deve rejeitar consumidor registrado que não depende do produtor do portão");
});

runTest("NEGATIVO — status de portão inválido é rejeitado", () => {
  const bad = baseRecord({
    downstreamGates: [baseGate({ status: "invalido" as never, missingEvidencePt: "algo" })],
  });
  assertTrue(issuesOfCode("gate_invalid_status", [bad]).length > 0, "guard deve rejeitar status de portão não reconhecido");
});

runTest("NEGATIVO — portão duplicado (mesmo consumidor + mesma finalidade) é rejeitado", () => {
  const bad = baseRecord({
    downstreamGates: [baseGate({ consumerId: "mesmo-consumidor", purposeKind: "diagnostic" }), baseGate({ consumerId: "mesmo-consumidor", purposeKind: "diagnostic", status: "bloqueado", missingEvidencePt: "x" })],
  });
  assertTrue(issuesOfCode("duplicate_or_contradictory_gate", [bad]).length > 0, "guard deve rejeitar dois portões para o mesmo par (consumidor, purposeKind)");
});

runTest("NEGATIVO — histórico desconectado (encadeamento quebrado) é rejeitado", () => {
  const bad = baseRecord({
    currentLevel: "evidenciada_sinteticamente",
    currentResult: "aprovada",
    failureAssessment: "none_known",
    evaluationHistory: [
      { evaluationId: "e1", date: "2026-01-01", evaluatedRevision: "0".repeat(40), previousLevel: null, previousResult: null, newLevel: "experimental", newResult: "nao_avaliada", inconclusiveCausePt: null, evidenceConsideredPt: ["x"], limitationsPt: [], knownFailuresPt: [], implementer: "t", adversarialReviewer: ROLE_NOT_FORMALIZED, approver: ROLE_NOT_FORMALIZED, decisionPt: "d", justificationPt: "j" },
      { evaluationId: "e2", date: "2026-01-02", evaluatedRevision: "0".repeat(40), previousLevel: "evidenciada_sinteticamente", previousResult: "reprovada", newLevel: "evidenciada_sinteticamente", newResult: "aprovada", inconclusiveCausePt: null, evidenceConsideredPt: ["x"], limitationsPt: [], knownFailuresPt: [], implementer: "t", adversarialReviewer: ROLE_NOT_FORMALIZED, approver: ROLE_NOT_FORMALIZED, decisionPt: "d", justificationPt: "j" },
    ],
  });
  assertTrue(issuesOfCode("history_chain_broken", [bad]).length > 0, "guard deve rejeitar encadeamento de histórico quebrado");
});

runTest("NEGATIVO — evaluationId duplicado é rejeitado", () => {
  const a = baseRecord({ id: "fake-a" });
  const b = baseRecord({ id: "fake-b", evaluationHistory: [{ ...baseRecord().evaluationHistory[0], evaluationId: "fake-eval-001" }] });
  assertTrue(issuesOfCode("duplicate_evaluation_id", [a, b]).length > 0, "guard deve rejeitar evaluationId duplicado entre alvos diferentes");
});

runTest("NEGATIVO — dependência inexistente é rejeitada", () => {
  const bad = baseRecord({ dependsOnTargetIds: ["alvo-que-nao-existe"] });
  assertTrue(issuesOfCode("dangling_dependency", [bad]).length > 0, "guard deve rejeitar dependência inexistente");
});

runTest("NEGATIVO — ciclo de dependências é rejeitado", () => {
  const a = baseRecord({ id: "fake-cycle-a", dependsOnTargetIds: ["fake-cycle-b"] });
  const b = baseRecord({ id: "fake-cycle-b", dependsOnTargetIds: ["fake-cycle-a"] });
  assertTrue(issuesOfCode("dependency_cycle", [a, b]).length > 0, "guard deve rejeitar ciclo de dependências");
});

runTest("NEGATIVO — alvo reprovado sem falha conhecida é rejeitado", () => {
  const bad = baseRecord({ currentLevel: "evidenciada_sinteticamente", currentResult: "reprovada", failureAssessment: "confirmed", knownFailuresPt: [] });
  assertTrue(issuesOfCode("reprovada_requires_confirmed_failure_assessment", [bad]).length > 0, "guard deve rejeitar reprovada sem falhas conhecidas mesmo com failureAssessment 'confirmed'");
});

runTest("NEGATIVO — alvo inconclusivo sem causa é rejeitado", () => {
  const bad = baseRecord({ currentLevel: "exercitada_em_caso_real", currentResult: "inconclusiva", failureAssessment: "not_assessable", inconclusiveCausePt: null });
  assertTrue(issuesOfCode("missing_inconclusive_cause", [bad]).length > 0, "guard deve rejeitar inconclusiva sem causa");
});

runTest("NEGATIVO — revisão avaliada em formato inválido (não 40 hex) é rejeitada", () => {
  const bad = baseRecord({
    evaluatedRevision: "not-a-real-hash",
    evaluationHistory: [{ ...baseRecord().evaluationHistory[0], evaluatedRevision: "not-a-real-hash" }],
  });
  assertTrue(issuesOfCode("invalid_evaluated_revision_format", [bad]).length > 0, "guard deve rejeitar evaluatedRevision que não seja um hash Git completo de 40 hex");
});

runTest("NEGATIVO — mutação de estrutura congelada (registro construído com deepFreeze) não tem efeito", () => {
  // reaproveita o próprio deepFreeze indiretamente: o registro real já é congelado por construção.
  const record = REAL_VALIDATION_TARGET_REGISTRY.find((r) => r.id === "econ-budget-document-economic-characterization")!;
  attemptMutationHasNoEffect(
    record,
    () => {
      (record as { currentResult: string }).currentResult = "reprovada";
    },
    () => record.currentResult,
  );
});
