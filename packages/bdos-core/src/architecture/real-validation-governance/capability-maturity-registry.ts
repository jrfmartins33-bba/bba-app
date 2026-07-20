import type { RealValidationTargetRecord, RealValidationTargetRegistry } from "./real-validation-maturity.types";
import { REAL_VALIDATION_MATURITY_REGISTRY_VERSION, ROLE_NOT_FORMALIZED } from "./real-validation-maturity.types";

/**
 * Registro versionado dos alvos de governança: capacidades documentais
 * f.0 a g.3, a caracterização econômica (Sprint 21.4B), e o cenário
 * ponta a ponta de extração/reconciliação real (`targetKind: "end_to_end_scenario"`).
 * Reclassificado exclusivamente a partir de evidências já existentes nos
 * relatórios preservados — nunca inferido, nunca promovido por
 * quantidade de testes, nunca tratando `completed`/`structured`/`evaluated`
 * como validação real por si só.
 *
 * Nível de evidência (`currentLevel`) e resultado da validação
 * (`currentResult`) são eixos separados e NUNCA implicam um ao outro —
 * ver `real-validation-maturity.types.ts`. Portões downstream são
 * específicos por (consumidor, `purposeKind` estruturado), declaram sua
 * própria exigência mínima (`minimumEvidenceLevel`/`allowedResults`) e o
 * guard decide bloqueios EXCLUSIVAMENTE por essa estrutura mais o grafo
 * de `dependsOnTargetIds` — nunca por varredura de palavras em texto
 * livre.
 *
 * Terceira correção (pós-segunda revisão independente):
 *
 * - Toda evidência real em nível `comparada_formalmente_em_caso_real` ou
 *   `submetida_a_teste_adversarial` agora declara `expectationDefinedAt`/
 *   `expectationReference` apontando para um documento/commit
 *   GENUINAMENTE anterior à execução relatada em `executionReference` —
 *   nunca reconstruído de memória. Para f.2a, isso expôs uma distinção
 *   importante: apenas o INVARIANTE QUALITATIVO (uma janela de região
 *   tabular não deve fragmentar conteúdo que pertence legitimamente à
 *   mesma tabela) tinha proveniência anterior à execução real (commit
 *   `323de6bb6d83cfe0779c2d57e0ca8ba380fd6011`, 2026-07-17, suíte
 *   sintética pré-existente de `tabular-region-formation.test.ts`) — a
 *   caracterização NUMÉRICA específica deste documento (~10 colunas, 1
 *   região por página) foi obtida por inspeção DURANTE o diagnóstico
 *   (Sprints 21.4B.1/21.4B.2), ou seja, depois de a falha inicial já ter
 *   sido observada. O registro declara essa distinção explicitamente, em
 *   vez de apresentar a caracterização numérica como se estivesse
 *   congelada antes da primeira execução.
 * - `failureAssessment` estruturado substitui toda inferência textual
 *   sobre a ausência/presença de falhas.
 * - Todo portão declara `minimumEvidenceLevel`/`allowedResults`/
 *   `consumerKind` explicitamente — nenhuma exigência universal
 *   inventada, nenhum portão produtivo herda aprovação por omissão.
 *
 * Correção de revisão independente (segunda rodada, mantida): a
 * caracterização econômica NUNCA carrega, ela própria, o veredito
 * "reprovada" da extração real — ela nunca recebeu entrada real
 * estruturalmente válida (bloqueada pela reprovação upstream de f.2a),
 * portanto seu resultado próprio é `inconclusiva`. O veredito "reprovada"
 * pertence a f.2a (capacidade, defeito estrutural comprovado em sua
 * própria lógica) e ao cenário ponta a ponta
 * `tender-budget-real-extraction-e2e` (o objetivo declarado de
 * reconciliar 11/25/300/R$9.809.087,18 não foi alcançado, com
 * proveniência anterior à execução no commit
 * `5c86f451bc5b3768ec40930560430ab260f1372e`, 2026-07-14, fixture
 * `LAGOA_DO_ARROZ_OFFICIAL_LINES`, Sprint 21.3B).
 *
 * Fingerprints são o SHA-256 completo (64 caracteres hexadecimais) —
 * nunca truncado, nunca reconstruído de memória.
 *
 * Papéis: nesta primeira rodada de avaliação, o implementador principal
 * foi Claude Code; houve revisão técnica em checkpoints por ChatGPT
 * (fora deste ambiente de execução, não formalizada como papel
 * independente dentro desta governança); a aprovação final permanece
 * pendente do responsável humano pelo produto — nunca inventada como já
 * concluída.
 */

const IMPLEMENTER = "Claude Code";
const CHECKPOINT_REVIEWER_NOTE = "Revisão técnica em checkpoints por ChatGPT (externa a esta execução, não formalizada como Revisor adversarial independente desta governança)";
const REAL_DOCUMENT_FINGERPRINT_SHA256 = "5031da751eff0bb9bd892c0bd9f71a786ac0d575ff52877aeced6c118ffb92c5";
const MAIN_REVISION = "35e18a50fcd3b357db71d4662b83ba0b545ae1b3";
const EVAL_DATE = "2026-07-20";

/** Commit que introduziu a suíte sintética pré-existente de `tabular-region-formation.test.ts` — anterior a qualquer execução contra o documento real (2026-07-20). Proveniência genuína do invariante QUALITATIVO de f.2a. */
const TABULAR_REGION_INVARIANT_COMMIT = "323de6bb6d83cfe0779c2d57e0ca8ba380fd6011";
const TABULAR_REGION_INVARIANT_DATE = "2026-07-17";

/** Commit que introduziu a fixture de referência independente `LAGOA_DO_ARROZ_OFFICIAL_LINES` (Sprint 21.3B) — anterior à execução real da Sprint 21.4B. Proveniência genuína da expectativa do cenário ponta a ponta. */
const LAGOA_DO_ARROZ_FIXTURE_COMMIT = "5c86f451bc5b3768ec40930560430ab260f1372e";
const LAGOA_DO_ARROZ_FIXTURE_DATE = "2026-07-14";

const SPRINT_21_4B_EXECUTION_COMMIT = "c7dc09ee675cb810ca338f83a33e1f22b8e65864";
const SPRINT_21_4B1_COMMIT = "0e7fc0883f73b4f9fb868173d773e434b5362606";
const SPRINT_21_4B2_COMMIT = "13257242e38273c3a816db2619f847112c466794";

const MUTABLE_CAPABILITY_MATURITY_REGISTRY: Array<RealValidationTargetRecord> = [
  {
    id: "f0-normalized-text-item-geometry",
    namePt: "Geometria Normalizada de Item Textual",
    targetKind: "capability",
    stageId: "21.4A.2.f.0",
    descriptionPt:
      "Canonicaliza a geometria de layout, a relação com os limites da página e as métricas de disposição de cada item textual físico — contrato fundacional consumido por f.1. Não tem pasta própria (arquivos na raiz de budget-document-location).",
    currentLevel: "exercitada_em_caso_real",
    currentResult: "nao_avaliada",
    inconclusiveCausePt: null,
    syntheticEvidenceSummaryPt:
      "Suíte sintética própria (canonicalização de geometria, relação com limites da página, métricas de disposição) mais exercício indireto pelos testes de cadeia real (`*.real-pdf-chain.test.ts`) com PDFs sintéticos.",
    realEvidence: {
      sourceFingerprintSha256: REAL_DOCUMENT_FINGERPRINT_SHA256,
      pageOrTraceRange: "páginas 46-54 do documento real, via cadeia completa executada na Sprint 21.4B",
      expectedResult: "Leitura física completa sem falha técnica; geometria normalizada para cada item textual das 9 páginas.",
      observedResult:
        "Executada como parte da cadeia real, sem falha técnica reportada (status completed). Nenhuma comparação isolada entre geometria esperada e observada foi definida especificamente para f.0 antes da execução — `completed` não significa validação. Precisa de um critério formal próprio (comparação isolada, definida antes da execução) para avançar de nível de resultado.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md (branch claude/epic-21-sprint-4b-real-tender-budget-extraction)",
      expectationDefinedAt: null,
      expectationReference: null,
      executionReference: `Sprint 21.4B (commit ${SPRINT_21_4B_EXECUTION_COMMIT})`,
    },
    adversarialEvidence: null,
    failureAssessment: "not_assessable",
    knownLimitationsPt: [
      "Nenhuma comparação formal e isolada entre resultado esperado e observado foi registrada especificamente para f.0 — apenas execução sem falha técnica dentro da cadeia completa.",
    ],
    knownFailuresPt: [],
    promotionConditionPt:
      "Definir e executar uma comparação formal e isolada (resultado esperado definido antes da execução vs. observado) da geometria produzida por f.0 contra amostras estruturais reais.",
    evaluatedRevision: MAIN_REVISION,
    lastEvaluatedDate: EVAL_DATE,
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "f1-structure-reconstruction",
        consumerKind: "registered_target",
        purposePt: "fornecimento de geometria normalizada para reconstrução estrutural",
        purposeKind: "technical_chaining",
        status: "aberto",
        minimumEvidenceLevel: "experimental",
        allowedResults: ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"],
        rationalePt: "Nenhuma falha técnica detectada na cadeia real; f.1 consome f.0 sem problema observado. Encadeamento técnico nunca exige mais do que uma implementação existente.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto.",
      },
      {
        consumerId: "qualquer_consumo_produtivo",
        consumerKind: "consumer_class",
        purposePt: "uso da geometria de f.0 como evidência de validação real",
        purposeKind: "real_validation",
        status: "condicional",
        minimumEvidenceLevel: "comparada_formalmente_em_caso_real",
        allowedResults: ["aprovada"],
        rationalePt: "Ausência de comparação formal esperado/observado significa que uma divergência silenciosa em f.0 não seria necessariamente capturada.",
        missingEvidencePt: "Comparação formal, definida antes da execução, entre geometria esperada e observada contra amostras reais.",
        behaviorWhenBlockedPt: "Consumo produtivo que dependa de garantia formal de f.0 deve aguardar essa comparação; consumo diagnóstico permanece liberado.",
      },
    ],
    dependsOnTargetIds: [],
    evaluationHistory: [
      {
        evaluationId: "f0-eval-2026-07-20-001",
        date: EVAL_DATE,
        evaluatedRevision: MAIN_REVISION,
        previousLevel: null,
        previousResult: null,
        newLevel: "exercitada_em_caso_real",
        newResult: "nao_avaliada",
        inconclusiveCausePt: null,
        evidenceConsideredPt: ["Execução completa da cadeia real (Sprint 21.4B) sem falha técnica em f.0."],
        limitationsPt: ["Nenhuma comparação formal esperado/observado específica de f.0."],
        knownFailuresPt: [],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível exercitada_em_caso_real, resultado não avaliada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "f1-structure-reconstruction",
    namePt: "Reconstrução Estrutural Auditável",
    targetKind: "capability",
    stageId: "21.4A.2.f.1",
    descriptionPt:
      "Reconstrói linhas físicas, segmentos horizontais e blocos bidimensionais a partir dos itens textuais elegíveis de uma página candidata. Pasta `structure-reconstruction/`, orquestrador `reconstructBudgetDocumentStructure`.",
    currentLevel: "exercitada_em_caso_real",
    currentResult: "nao_avaliada",
    inconclusiveCausePt: null,
    syntheticEvidenceSummaryPt:
      "Suíte sintética extensa (formação de linha, segmento, bloco, invariantes de conservação, determinismo, independência de ordem) — nunca exercitou uma tabela real densa multi-linha antes da Sprint 21.4B.1.",
    realEvidence: {
      sourceFingerprintSha256: REAL_DOCUMENT_FINGERPRINT_SHA256,
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Não definido formalmente antes da execução para esta capacidade especificamente — apenas o objetivo geral da Sprint 21.4B.",
      observedResult:
        "Reconstrução completa sem falha técnica. Amostras estruturais reais inspecionadas na Sprint 21.4B.1 (3 continuações reais de descrição, 2 linhas esparsas de grupo/subgrupo) não revelaram defeito próprio de f.1 — mas essa inspeção foi diagnóstica (script temporário, deletado após uso), nunca um critério formal e completo de aceitação real definido previamente, e não houve decisão humana formal de aprovação. Resultado 'não avaliada': a evidência favorável permanece registrada aqui e no histórico, apenas não sustenta uma aprovação formal.",
      divergences: [],
      reportReference: `Checkpoint da Sprint 21.4B.1 (branch claude/epic-21-sprint-4b1-dense-table-region-diagnosis, commit ${SPRINT_21_4B1_COMMIT})`,
      expectationDefinedAt: null,
      expectationReference: null,
      executionReference: `Sprint 21.4B.1 (commit ${SPRINT_21_4B1_COMMIT})`,
    },
    adversarialEvidence: null,
    failureAssessment: "not_assessable",
    knownLimitationsPt: [
      "A inspeção real foi diagnóstica (script temporário, deletado após uso), não uma comparação formal esperado/observado definida antes da execução, e não houve decisão humana formal de aprovação — por isso o resultado permanece 'não avaliada', mesmo com evidência informal favorável já registrada.",
    ],
    knownFailuresPt: [],
    promotionConditionPt: "Definir formalmente um critério de aceitação real (resultado esperado antes da execução) para f.1, executar a comparação, e obter decisão humana de aprovação.",
    evaluatedRevision: MAIN_REVISION,
    lastEvaluatedDate: EVAL_DATE,
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "f2a-tabular-region-detection",
        consumerKind: "registered_target",
        purposePt: "diagnóstico/desenvolvimento (fornecimento de linhas físicas para detecção de região)",
        purposeKind: "development",
        status: "aberto",
        minimumEvidenceLevel: "experimental",
        allowedResults: ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"],
        rationalePt: "Justificativa limitada à investigação técnica — nenhuma falha própria identificada nas amostras inspecionadas; a fragmentação downstream em f.2a foi isolada e não atribuída a f.1.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto, limitado a investigação técnica.",
      },
      {
        consumerId: "econ-budget-document-economic-characterization",
        consumerKind: "registered_target",
        purposePt: "validação real (linhas físicas alimentando reconciliação real)",
        purposeKind: "real_validation",
        status: "bloqueado",
        minimumEvidenceLevel: "comparada_formalmente_em_caso_real",
        allowedResults: ["aprovada"],
        rationalePt: "f.2a está reprovada em caso real e degrada a cadeia downstream — o consumo validado não pode depender de f.1 isoladamente enquanto a cadeia como um todo estiver comprometida.",
        missingEvidencePt: "Correção aprovada de f.2a; execução contra documento real; portões estruturais aprovados; saída downstream não degradada.",
        behaviorWhenBlockedPt: "Nenhum consumo validado deve prosseguir enquanto f.2a permanecer reprovada, independentemente do estado de f.1.",
      },
      {
        consumerId: "budget_version_draft_creation",
        consumerKind: "consumer_class",
        purposePt: "uso produtivo (criação de rascunho de Versão do Orçamento)",
        purposeKind: "productive_use",
        status: "bloqueado",
        minimumEvidenceLevel: "comparada_formalmente_em_caso_real",
        allowedResults: ["aprovada"],
        rationalePt: "Mesma cadeia comprometida por f.2a — uso produtivo nunca pode depender de uma etapa upstream reprovada.",
        missingEvidencePt: "Correção aprovada de f.2a; execução contra documento real; portões estruturais aprovados; saída downstream não degradada.",
        behaviorWhenBlockedPt: "Nenhuma criação de rascunho de Versão do Orçamento a partir de f.1 deve prosseguir enquanto f.2a permanecer reprovada.",
      },
    ],
    dependsOnTargetIds: ["f0-normalized-text-item-geometry"],
    evaluationHistory: [
      {
        evaluationId: "f1-eval-2026-07-20-001",
        date: EVAL_DATE,
        evaluatedRevision: MAIN_REVISION,
        previousLevel: null,
        previousResult: null,
        newLevel: "exercitada_em_caso_real",
        newResult: "nao_avaliada",
        inconclusiveCausePt: null,
        evidenceConsideredPt: ["Inspeção diagnóstica de amostras reais (3 continuações, 2 linhas esparsas) na Sprint 21.4B.1 — nenhum defeito próprio encontrado, mas sem critério formal de aceitação nem aprovação humana."],
        limitationsPt: ["Inspeção informal, não uma comparação formal definida antes da execução; nenhuma decisão humana formal de aprovação."],
        knownFailuresPt: [],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível exercitada_em_caso_real, resultado não avaliada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "f2a-tabular-region-detection",
    namePt: "Detecção Auditável de Região Tabular",
    targetKind: "capability",
    stageId: "21.4A.2.f.2a",
    descriptionPt:
      "Forma janelas contíguas candidatas a região tabular a partir de alinhamentos verticais recorrentes entre linhas físicas. Pasta `tabular-region-detection/`, orquestrador `detectBudgetDocumentTabularRegions`. Defeito estrutural comprovado: a regra de formação de janela exige que toda linha física sustente sozinha um número mínimo de alinhamentos recorrentes — uma invariante falsa para qualquer linha física que pertença legitimamente a uma tabela real sem sustentar alinhamento próprio suficiente, incluindo (mas não limitado a) continuações de descrição multilinha, linhas internas esparsas de grupo/subgrupo, cabeçalhos internos, e alinhamentos privados formados por conteúdo externo coincidente (Casos J/L3/L7). Nunca caracterizar o defeito como restrito a 'descrições multilinha', nem exigir uma forma geométrica específica (ex.: exatamente uma região por página) sem evidência prévia que a sustente — a exigência real é cobertura estrutural e preservação das colunas/linhas que pertencem à tabela, não uma forma inventada.",
    currentLevel: "submetida_a_teste_adversarial",
    currentResult: "reprovada",
    inconclusiveCausePt: null,
    syntheticEvidenceSummaryPt:
      "Suíte sintética extensa e aprovada (24+ testes incluindo casos adversariais H, I, J, L1-L12) — mas os testes sintéticos originais (pré-21.4B) nunca exercitaram uma tabela real densa com descrições multilinha, exatamente o padrão que causou a falha real.",
    realEvidence: {
      sourceFingerprintSha256: REAL_DOCUMENT_FINGERPRINT_SHA256,
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult:
        `Invariante estrutural QUALITATIVO, com proveniência anterior à execução real: uma janela de região tabular candidata não deve fragmentar conteúdo que pertence legitimamente à mesma tabela (linhas internas esparsas, continuações de descrição, cabeçalhos, alinhamentos privados) — documentado antes de qualquer execução contra o documento real na suíte sintética pré-existente de \`tabular-region-formation.test.ts\` (commit ${TABULAR_REGION_INVARIANT_COMMIT}, ${TABULAR_REGION_INVARIANT_DATE}). A caracterização NUMÉRICA específica deste documento (~10 colunas visíveis, 1 região contígua por página) NÃO tinha essa mesma proveniência anterior — foi obtida por inspeção estrutural do documento DURANTE o diagnóstico (Sprints 21.4B.1/21.4B.2), ou seja, depois de a fragmentação já ter sido observada na execução real inicial (Sprint 21.4B). Este registro declara essa distinção explicitamente: apenas o invariante qualitativo sustenta o nível \`comparada_formalmente_em_caso_real\`; os números específicos abaixo descrevem o observado, não uma predição pré-registrada.`,
      observedResult:
        "Página real fragmentada em ~7 regiões pequenas por página, a maior com apenas 4 linhas e 2 colunas resolvidas — muito aquém das ~10 colunas visíveis no documento, violando diretamente o invariante qualitativo pré-existente. Causa raiz isolada com precisão nas Sprints 21.4B.1/21.4B.2: a regra de formação de janela em `tabular-region-formation.ts` exige que toda linha física sustente sozinha `>= minimumRecurrentAlignmentCount` alinhamentos — uma invariante falsa para continuações de descrição multilinha e linhas esparsas legítimas, comprovada por comparação formal e por investigação adversarial direcionada à lógica própria desta capacidade (não à reconciliação econômica, que é avaliada separadamente no cenário ponta a ponta `tender-budget-real-extraction-e2e`).",
      divergences: [
        "~10 colunas visíveis esperadas por região vs. no máximo 2 colunas resolvidas observadas (caracterização numérica obtida durante o diagnóstico, não pré-registrada)",
        "1 região contígua por página esperada (pelo invariante qualitativo pré-existente) vs. ~7 regiões pequenas observadas",
      ],
      reportReference: `EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md; checkpoints das Sprints 21.4B.1 (commit ${SPRINT_21_4B1_COMMIT}) e 21.4B.2 (commit ${SPRINT_21_4B2_COMMIT})`,
      expectationDefinedAt: TABULAR_REGION_INVARIANT_DATE,
      expectationReference: `Commit ${TABULAR_REGION_INVARIANT_COMMIT} — suíte sintética pré-existente de \`tabular-region-formation.test.ts\`, anterior a qualquer execução contra o documento real. Cobre apenas o invariante qualitativo (não fragmentar conteúdo legítimo); não prediz as quantidades numéricas específicas deste documento.`,
      executionReference: `Sprint 21.4B, execução real (commit ${SPRINT_21_4B_EXECUTION_COMMIT}); diagnósticos das Sprints 21.4B.1 (commit ${SPRINT_21_4B1_COMMIT}) e 21.4B.2 (commit ${SPRINT_21_4B2_COMMIT})`,
    },
    adversarialEvidence: {
      adversarialCasesSummary:
        "Caso J (21.4B.1) e Caso L7 (21.4B.2): parágrafo externo com espaçamento apertado deliberado e exatamente 1 alinhamento coincidente com uma coluna real — construído para imitar uma continuação legítima. Caso L3 (21.4B.2): três continuações consecutivas idênticas formando alinhamento privado. A matriz L1-L12 (incluindo o Caso L7 adversarial obrigatório) foi mandatada pelo usuário nesta mesma conversa, por escrito, ANTES de qualquer tentativa de correção da Sprint 21.4B.2 — proveniência da autorização do teste adversarial anterior à execução, ainda que sem um commit Git isolado que separe cronologicamente a redação da fixture da tentativa de correção dentro da mesma sessão de trabalho (limitação reconhecida abaixo).",
      outcomeSummary:
        "Um spike de correção testado nas duas Sprints absorveu incorretamente o caso adversarial após corrigir os casos positivos — confirmando que nenhum discriminador seguro existe dentro da evidência estrutural mínima (razão de intervalo, subconjunto de alinhamentos, reconfirmação) sem conhecimento de envelope/grade de colunas, fora do escopo autorizado. Resultado da matriz adversarial: reprovada.",
      reportReference: "Checkpoints das Sprints 21.4B.1 e 21.4B.2 (branches preservadas, sem correção de produção mantida)",
    },
    failureAssessment: "confirmed",
    knownLimitationsPt: [
      "A falha é isolada e específica a tabelas reais densas com descrições multilinha, linhas esparsas, cabeçalhos internos e alinhamentos privados — nunca exercitada pelos testes sintéticos originais.",
      "Nenhum discriminador estrutural mínimo (sem grade de colunas) resolve o caso adversarial (Caso J/L7) sem também absorver conteúdo não tabular.",
      "A proveniência anterior à execução cobre apenas o invariante QUALITATIVO (não fragmentar conteúdo legítimo). A caracterização numérica específica deste documento (colunas/regiões) foi obtida durante o diagnóstico, após a falha inicial já observada — não deve ser lida como uma predição pré-registrada.",
      "A matriz adversarial (Casos J/L3/L7) foi autorizada por escrito antes da tentativa de correção, mas não existe um commit Git isolado que separe cronologicamente a redação das fixtures da execução do spike dentro da mesma sessão — a proveniência repousa no registro de conversa/autorização, não apenas em metadados Git.",
    ],
    knownFailuresPt: [
      "Fragmentação severa de regiões tabulares reais densas com descrições multilinha (Sprint 21.4B).",
      "Três continuações consecutivas idênticas formam seu próprio alinhamento privado, criando uma janela concorrente espúria (Sprint 21.4B.2, Caso L3) — um segundo modo de falha, não corrigido.",
    ],
    promotionConditionPt:
      "Sprint 21.4B.3A (descoberta arquitetural, ainda não autorizada): investigar se existe uma invariante geométrica segura de pertencimento à grade tabular (ex.: envelope horizontal por coluna reconhecida) que discrimine, sem ambiguidade, conteúdo legitimamente tabular de baixo alinhamento próprio de conteúdo externo coincidente — sem presumir antecipadamente que pareamento de bordas/envelope resolverá o problema; a Sprint 21.4B.3A deve concluir apenas se uma invariante segura existe ou não, com evidência sintética e adversarial. Implementação (Sprint 21.4B.3B) somente se a 21.4B.3A comprovar essa invariante, e reexecução contra o documento real somente depois. Nunca reduzir rigor para simplesmente aumentar a contagem de colunas por região.",
    evaluatedRevision: MAIN_REVISION,
    lastEvaluatedDate: EVAL_DATE,
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprints 21.4B/21.4B.1/21.4B.2`,
    downstreamGates: [
      {
        consumerId: "diagnostico_estrutural",
        consumerKind: "external_action",
        purposePt: "diagnóstico e investigação (scripts manuais, nunca produção)",
        purposeKind: "diagnostic",
        status: "aberto",
        minimumEvidenceLevel: "experimental",
        allowedResults: ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"],
        rationalePt: "A cadeia executa sem falha técnica e produz dados estruturais úteis para diagnóstico, mesmo fragmentados.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto.",
      },
      {
        consumerId: "f2b-physical-column-hypothesis-reconstruction",
        consumerKind: "registered_target",
        purposePt: "reconstrução de coluna física a partir de região tabular real",
        purposeKind: "real_validation",
        status: "bloqueado",
        minimumEvidenceLevel: "comparada_formalmente_em_caso_real",
        allowedResults: ["aprovada"],
        rationalePt: "Uma região tabular real com fragmentação severa e cobertura insuficiente não pode alimentar hipóteses de coluna com confiança.",
        missingEvidencePt: "Correção comprovada da invariante de formação de janela em tabular-region-formation.ts.",
        behaviorWhenBlockedPt: "f.2b não deve processar saída real de f.2a com expectativa de resultado utilizável até correção.",
      },
      {
        consumerId: "econ-budget-document-economic-characterization",
        consumerKind: "registered_target",
        purposePt: "extração e reconciliação econômica real",
        purposeKind: "real_validation",
        status: "bloqueado",
        minimumEvidenceLevel: "comparada_formalmente_em_caso_real",
        allowedResults: ["aprovada"],
        rationalePt: "Região tabular real fragmentada — bloqueio direto e comprovado.",
        missingEvidencePt: "Correção comprovada de f.2a e reexecução completa da reconciliação real.",
        behaviorWhenBlockedPt: "Nenhuma criação de rascunho de Versão do Orçamento a partir de documento real deve prosseguir.",
      },
    ],
    dependsOnTargetIds: ["f1-structure-reconstruction"],
    evaluationHistory: [
      {
        evaluationId: "f2a-eval-2026-07-20-001",
        date: EVAL_DATE,
        evaluatedRevision: MAIN_REVISION,
        previousLevel: null,
        previousResult: null,
        newLevel: "submetida_a_teste_adversarial",
        newResult: "reprovada",
        inconclusiveCausePt: null,
        evidenceConsideredPt: [
          "Comparação formal contra o invariante qualitativo pré-existente (commit 323de6bb, 2026-07-17): ~10 colunas esperadas por região vs. no máximo 2 observadas; 1 região esperada vs. ~7 observadas (Sprint 21.4B).",
          "Investigação de causa raiz e tentativas de correção nas Sprints 21.4B.1 e 21.4B.2, ambas revertidas após falha adversarial (Caso J/L7/L3).",
        ],
        limitationsPt: [
          "Falha isolada a tabelas reais densas com descrições multilinha, linhas esparsas, cabeçalhos e alinhamentos privados; nenhum discriminador mínimo encontrado sem grade de colunas.",
          "Apenas o invariante qualitativo tinha proveniência anterior à execução — a caracterização numérica é diagnóstica.",
        ],
        knownFailuresPt: ["Fragmentação severa (Sprint 21.4B); alinhamento privado de continuações consecutivas (Caso L3, Sprint 21.4B.2)."],
        implementer: IMPLEMENTER,
        adversarialReviewer: "Claude Code (mesma sessão — não formalizado como papel independente)",
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro formal (terceira correção): nível submetida_a_teste_adversarial, resultado reprovada, com proveniência da expectativa honestamente separada entre invariante qualitativo pré-existente e caracterização numérica diagnóstica.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "f2b-physical-column-hypothesis-reconstruction",
    namePt: "Reconstrução de Hipóteses Físicas de Coluna",
    targetKind: "capability",
    stageId: "21.4A.2.f.2b",
    descriptionPt: "Reconstrói hipóteses de coluna física a partir das regiões tabulares candidatas de f.2a. Pasta `physical-column-hypothesis-reconstruction/`, orquestrador `reconstructBudgetDocumentPhysicalColumnHypotheses`.",
    currentLevel: "exercitada_em_caso_real",
    currentResult: "inconclusiva",
    inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a (região tabular fragmentada) — o resultado observado reflete a entrada degradada, não a correção própria desta capacidade.",
    syntheticEvidenceSummaryPt: "Suíte sintética própria aprovada, mais teste de cadeia real com PDF sintético (`reconstruct-budget-document-physical-column-hypotheses.real-pdf-chain.test.ts`).",
    realEvidence: {
      sourceFingerprintSha256: REAL_DOCUMENT_FINGERPRINT_SHA256,
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Não definido antes da execução para esta capacidade especificamente — apenas herdado do objetivo geral da Sprint 21.4B.",
      observedResult:
        "Executada sem falha técnica (status completed) sobre a saída já fragmentada de f.2a — nenhuma falha própria identificada, mas também nenhuma evidência de correção independente, já que sua entrada real estava degradada pelo defeito upstream conhecido. Por isso resultado 'inconclusiva'.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
      expectationDefinedAt: null,
      expectationReference: null,
      executionReference: `Sprint 21.4B (commit ${SPRINT_21_4B_EXECUTION_COMMIT})`,
    },
    adversarialEvidence: null,
    failureAssessment: "not_assessable",
    knownLimitationsPt: [
      "Evidência real confundida pelo defeito upstream conhecido de f.2a — 'sem falha técnica' aqui não comprova correção substantiva contra dados reais não degradados.",
    ],
    knownFailuresPt: [],
    promotionConditionPt: "Reexecutar contra o mesmo documento real somente após f.2a estar corrigido e validado, com resultado esperado definido antes da execução.",
    evaluatedRevision: MAIN_REVISION,
    lastEvaluatedDate: EVAL_DATE,
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "f2c-physical-cell-hypothesis-formation",
        consumerKind: "registered_target",
        purposePt: "consumo diagnóstico (encadeamento técnico)",
        purposeKind: "technical_chaining",
        status: "aberto",
        minimumEvidenceLevel: "experimental",
        allowedResults: ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"],
        rationalePt: "A cadeia técnica encadeia sem falha, para fins de diagnóstico.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto.",
      },
      {
        consumerId: "econ-budget-document-economic-characterization",
        consumerKind: "registered_target",
        purposePt: "consumo validado",
        purposeKind: "real_validation",
        status: "bloqueado",
        minimumEvidenceLevel: "comparada_formalmente_em_caso_real",
        allowedResults: ["aprovada"],
        rationalePt: "Depende inteiramente do portão de f.2a, hoje reprovado.",
        missingEvidencePt: "f.2a corrigido e revalidado; reexecução de f.2b contra entrada real não degradada.",
        behaviorWhenBlockedPt: "Nenhum consumo validado deve prosseguir.",
      },
    ],
    dependsOnTargetIds: ["f2a-tabular-region-detection"],
    evaluationHistory: [
      {
        evaluationId: "f2b-eval-2026-07-20-001",
        date: EVAL_DATE,
        evaluatedRevision: MAIN_REVISION,
        previousLevel: null,
        previousResult: null,
        newLevel: "exercitada_em_caso_real",
        newResult: "inconclusiva",
        inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a (região tabular fragmentada) — o resultado observado reflete a entrada degradada, não a correção própria desta capacidade.",
        evidenceConsideredPt: ["Execução sem falha técnica sobre entrada já fragmentada por f.2a (Sprint 21.4B)."],
        limitationsPt: ["Evidência confundida por defeito upstream conhecido."],
        knownFailuresPt: [],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível exercitada_em_caso_real, resultado inconclusiva por entrada degradada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "f2c-physical-cell-hypothesis-formation",
    namePt: "Formação de Hipóteses Físicas de Célula",
    targetKind: "capability",
    stageId: "21.4A.2.f.2c",
    descriptionPt: "Forma hipóteses de célula física a partir das hipóteses de coluna de f.2b. Pasta `physical-cell-hypothesis-formation/`, orquestrador `formBudgetDocumentPhysicalCellHypotheses`.",
    currentLevel: "exercitada_em_caso_real",
    currentResult: "inconclusiva",
    inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a — mesma causa do registro de f.2b.",
    syntheticEvidenceSummaryPt: "Suíte sintética própria aprovada, mais teste de cadeia real com PDF sintético.",
    realEvidence: {
      sourceFingerprintSha256: REAL_DOCUMENT_FINGERPRINT_SHA256,
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Não definido antes da execução para esta capacidade especificamente.",
      observedResult: "Executada sem falha técnica sobre a saída já fragmentada de f.2a/f.2b — mesma ressalva de confundimento por defeito upstream. Resultado inconclusiva.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
      expectationDefinedAt: null,
      expectationReference: null,
      executionReference: `Sprint 21.4B (commit ${SPRINT_21_4B_EXECUTION_COMMIT})`,
    },
    adversarialEvidence: null,
    failureAssessment: "not_assessable",
    knownLimitationsPt: ["Evidência real confundida pelo defeito upstream conhecido de f.2a — mesma ressalva do registro de f.2b."],
    knownFailuresPt: [],
    promotionConditionPt: "Reexecutar contra o mesmo documento real somente após f.2a estar corrigido e validado.",
    evaluatedRevision: MAIN_REVISION,
    lastEvaluatedDate: EVAL_DATE,
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "g1-physical-cell-text-evidence-formation",
        consumerKind: "registered_target",
        purposePt: "consumo diagnóstico (encadeamento técnico)",
        purposeKind: "technical_chaining",
        status: "aberto",
        minimumEvidenceLevel: "experimental",
        allowedResults: ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"],
        rationalePt: "A cadeia técnica encadeia sem falha, para fins de diagnóstico.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto.",
      },
      {
        consumerId: "econ-budget-document-economic-characterization",
        consumerKind: "registered_target",
        purposePt: "consumo validado",
        purposeKind: "real_validation",
        status: "bloqueado",
        minimumEvidenceLevel: "comparada_formalmente_em_caso_real",
        allowedResults: ["aprovada"],
        rationalePt: "Depende inteiramente do portão de f.2a, hoje reprovado.",
        missingEvidencePt: "f.2a corrigido e revalidado.",
        behaviorWhenBlockedPt: "Nenhum consumo validado deve prosseguir.",
      },
    ],
    dependsOnTargetIds: ["f2b-physical-column-hypothesis-reconstruction"],
    evaluationHistory: [
      {
        evaluationId: "f2c-eval-2026-07-20-001",
        date: EVAL_DATE,
        evaluatedRevision: MAIN_REVISION,
        previousLevel: null,
        previousResult: null,
        newLevel: "exercitada_em_caso_real",
        newResult: "inconclusiva",
        inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a — mesma causa do registro de f.2b.",
        evidenceConsideredPt: ["Execução sem falha técnica sobre entrada já fragmentada por f.2a/f.2b (Sprint 21.4B)."],
        limitationsPt: ["Evidência confundida por defeito upstream conhecido."],
        knownFailuresPt: [],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível exercitada_em_caso_real, resultado inconclusiva por entrada degradada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "g1-physical-cell-text-evidence-formation",
    namePt: "Formação de Evidência Textual Auditável de Célula",
    targetKind: "capability",
    stageId: "21.4A.2.g.1",
    descriptionPt: "Forma evidência textual de célula a partir das hipóteses físicas de f.2c. Pasta `physical-cell-text-evidence-formation/`, orquestrador `formBudgetDocumentPhysicalCellTextEvidence`.",
    currentLevel: "exercitada_em_caso_real",
    currentResult: "inconclusiva",
    inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a.",
    syntheticEvidenceSummaryPt: "Suíte sintética própria aprovada, mais teste de cadeia real com PDF sintético.",
    realEvidence: {
      sourceFingerprintSha256: REAL_DOCUMENT_FINGERPRINT_SHA256,
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Não definido antes da execução para esta capacidade especificamente.",
      observedResult: "Executada sem falha técnica sobre a saída já fragmentada a montante — mesma ressalva de confundimento. Resultado inconclusiva.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
      expectationDefinedAt: null,
      expectationReference: null,
      executionReference: `Sprint 21.4B (commit ${SPRINT_21_4B_EXECUTION_COMMIT})`,
    },
    adversarialEvidence: null,
    failureAssessment: "not_assessable",
    knownLimitationsPt: ["Evidência real confundida pelo defeito upstream conhecido de f.2a."],
    knownFailuresPt: [],
    promotionConditionPt: "Reexecutar contra o mesmo documento real somente após f.2a estar corrigido e validado.",
    evaluatedRevision: MAIN_REVISION,
    lastEvaluatedDate: EVAL_DATE,
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "g2-page-local-neutral-structured-evidence-formation",
        consumerKind: "registered_target",
        purposePt: "consumo diagnóstico (encadeamento técnico)",
        purposeKind: "technical_chaining",
        status: "aberto",
        minimumEvidenceLevel: "experimental",
        allowedResults: ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"],
        rationalePt: "A cadeia técnica encadeia sem falha, para fins de diagnóstico.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto.",
      },
      {
        consumerId: "econ-budget-document-economic-characterization",
        consumerKind: "registered_target",
        purposePt: "consumo validado",
        purposeKind: "real_validation",
        status: "bloqueado",
        minimumEvidenceLevel: "comparada_formalmente_em_caso_real",
        allowedResults: ["aprovada"],
        rationalePt: "Depende inteiramente do portão de f.2a, hoje reprovado.",
        missingEvidencePt: "f.2a corrigido e revalidado.",
        behaviorWhenBlockedPt: "Nenhum consumo validado deve prosseguir.",
      },
    ],
    dependsOnTargetIds: ["f2c-physical-cell-hypothesis-formation"],
    evaluationHistory: [
      {
        evaluationId: "g1-eval-2026-07-20-001",
        date: EVAL_DATE,
        evaluatedRevision: MAIN_REVISION,
        previousLevel: null,
        previousResult: null,
        newLevel: "exercitada_em_caso_real",
        newResult: "inconclusiva",
        inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a.",
        evidenceConsideredPt: ["Execução sem falha técnica sobre entrada já fragmentada a montante (Sprint 21.4B)."],
        limitationsPt: ["Evidência confundida por defeito upstream conhecido."],
        knownFailuresPt: [],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível exercitada_em_caso_real, resultado inconclusiva por entrada degradada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "g2-page-local-neutral-structured-evidence-formation",
    namePt: "Formação de Evidência Estruturada Neutra Página-Local",
    targetKind: "capability",
    stageId: "21.4A.2.g.2",
    descriptionPt: "Forma evidência estruturada neutra local à página a partir da evidência textual de g.1. Pasta `page-local-neutral-structured-evidence-formation/`, orquestrador `formBudgetDocumentPageLocalNeutralStructuredEvidence`.",
    currentLevel: "exercitada_em_caso_real",
    currentResult: "inconclusiva",
    inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a.",
    syntheticEvidenceSummaryPt: "Suíte sintética própria aprovada, mais teste de cadeia real com PDF sintético.",
    realEvidence: {
      sourceFingerprintSha256: REAL_DOCUMENT_FINGERPRINT_SHA256,
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Não definido antes da execução para esta capacidade especificamente.",
      observedResult: "Executada sem falha técnica sobre a saída já fragmentada a montante — mesma ressalva de confundimento. Resultado inconclusiva.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
      expectationDefinedAt: null,
      expectationReference: null,
      executionReference: `Sprint 21.4B (commit ${SPRINT_21_4B_EXECUTION_COMMIT})`,
    },
    adversarialEvidence: null,
    failureAssessment: "not_assessable",
    knownLimitationsPt: ["Evidência real confundida pelo defeito upstream conhecido de f.2a."],
    knownFailuresPt: [],
    promotionConditionPt: "Reexecutar contra o mesmo documento real somente após f.2a estar corrigido e validado.",
    evaluatedRevision: MAIN_REVISION,
    lastEvaluatedDate: EVAL_DATE,
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "g3-page-boundary-neutral-continuity-evaluation",
        consumerKind: "registered_target",
        purposePt: "consumo diagnóstico (encadeamento técnico)",
        purposeKind: "technical_chaining",
        status: "aberto",
        minimumEvidenceLevel: "experimental",
        allowedResults: ["nao_avaliada", "aprovada", "reprovada", "inconclusiva"],
        rationalePt: "A cadeia técnica encadeia sem falha, para fins de diagnóstico.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto.",
      },
      {
        consumerId: "econ-budget-document-economic-characterization",
        consumerKind: "registered_target",
        purposePt: "consumo validado",
        purposeKind: "real_validation",
        status: "bloqueado",
        minimumEvidenceLevel: "comparada_formalmente_em_caso_real",
        allowedResults: ["aprovada"],
        rationalePt: "Depende inteiramente do portão de f.2a, hoje reprovado.",
        missingEvidencePt: "f.2a corrigido e revalidado.",
        behaviorWhenBlockedPt: "Nenhum consumo validado deve prosseguir.",
      },
    ],
    dependsOnTargetIds: ["g1-physical-cell-text-evidence-formation"],
    evaluationHistory: [
      {
        evaluationId: "g2-eval-2026-07-20-001",
        date: EVAL_DATE,
        evaluatedRevision: MAIN_REVISION,
        previousLevel: null,
        previousResult: null,
        newLevel: "exercitada_em_caso_real",
        newResult: "inconclusiva",
        inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a.",
        evidenceConsideredPt: ["Execução sem falha técnica sobre entrada já fragmentada a montante (Sprint 21.4B)."],
        limitationsPt: ["Evidência confundida por defeito upstream conhecido."],
        knownFailuresPt: [],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível exercitada_em_caso_real, resultado inconclusiva por entrada degradada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "g3-page-boundary-neutral-continuity-evaluation",
    namePt: "Avaliação Neutra de Continuidade na Fronteira entre Páginas",
    targetKind: "capability",
    stageId: "21.4A.2.g.3",
    descriptionPt: "Avalia se evidência estrutural na fronteira entre páginas sustenta candidatura à continuidade lógica — nunca funde estrutura. Pasta `page-boundary-neutral-continuity-evaluation/`, orquestrador `evaluateBudgetDocumentPageBoundaryNeutralContinuity`.",
    currentLevel: "exercitada_em_caso_real",
    currentResult: "inconclusiva",
    inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a.",
    syntheticEvidenceSummaryPt: "Suíte sintética própria aprovada, mais teste de cadeia real com PDF sintético de 4 páginas.",
    realEvidence: {
      sourceFingerprintSha256: REAL_DOCUMENT_FINGERPRINT_SHA256,
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Não definido antes da execução para esta capacidade especificamente.",
      observedResult: "Executada sem falha técnica sobre a saída já fragmentada a montante — mesma ressalva de confundimento. Resultado inconclusiva.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
      expectationDefinedAt: null,
      expectationReference: null,
      executionReference: `Sprint 21.4B (commit ${SPRINT_21_4B_EXECUTION_COMMIT})`,
    },
    adversarialEvidence: null,
    failureAssessment: "not_assessable",
    knownLimitationsPt: ["Evidência real confundida pelo defeito upstream conhecido de f.2a."],
    knownFailuresPt: [],
    promotionConditionPt: "Reexecutar contra o mesmo documento real somente após f.2a estar corrigido e validado.",
    evaluatedRevision: MAIN_REVISION,
    lastEvaluatedDate: EVAL_DATE,
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "econ-budget-document-economic-characterization",
        consumerKind: "registered_target",
        purposePt: "consumo validado (candidatura à continuidade entre páginas)",
        purposeKind: "real_validation",
        status: "bloqueado",
        minimumEvidenceLevel: "comparada_formalmente_em_caso_real",
        allowedResults: ["aprovada"],
        rationalePt: "Depende inteiramente do portão de f.2a, hoje reprovado.",
        missingEvidencePt: "f.2a corrigido e revalidado.",
        behaviorWhenBlockedPt: "Nenhum consumo validado deve prosseguir.",
      },
    ],
    dependsOnTargetIds: ["g2-page-local-neutral-structured-evidence-formation"],
    evaluationHistory: [
      {
        evaluationId: "g3-eval-2026-07-20-001",
        date: EVAL_DATE,
        evaluatedRevision: MAIN_REVISION,
        previousLevel: null,
        previousResult: null,
        newLevel: "exercitada_em_caso_real",
        newResult: "inconclusiva",
        inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a.",
        evidenceConsideredPt: ["Execução sem falha técnica sobre entrada já fragmentada a montante (Sprint 21.4B)."],
        limitationsPt: ["Evidência confundida por defeito upstream conhecido."],
        knownFailuresPt: [],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível exercitada_em_caso_real, resultado inconclusiva por entrada degradada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "econ-budget-document-economic-characterization",
    namePt: "Caracterização Econômica do Documento de Orçamento",
    targetKind: "capability",
    stageId: "21.4B",
    descriptionPt:
      "Consome g.2/g.3 para propor grupos, subgrupos e itens de serviço econômicos, com reconciliação linha a linha contra referência independente. Domínio irmão `budget-document-economic-characterization/` (nunca aninhado em budget-document-location).",
    currentLevel: "exercitada_em_caso_real",
    currentResult: "inconclusiva",
    inconclusiveCausePt: "Nunca recebeu entrada real estruturalmente válida devido à reprovação upstream de f.2a — a lógica própria desta capacidade nunca teve a chance de processar uma região tabular real íntegra. O veredito 'reprovada' pertence a f.2a (defeito estrutural comprovado em sua própria lógica) e ao cenário ponta a ponta `tender-budget-real-extraction-e2e` (objetivo declarado não alcançado) — nunca a esta capacidade isoladamente.",
    syntheticEvidenceSummaryPt: "Suíte sintética completa e aprovada (reconhecimento de cabeçalho/coluna, hierarquia, parsing brasileiro, reconciliação, diff independente, fingerprint) — nenhuma falha própria identificada nela.",
    realEvidence: {
      sourceFingerprintSha256: REAL_DOCUMENT_FINGERPRINT_SHA256,
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Entrada real estruturalmente válida (região tabular íntegra de f.2a) para exercitar a lógica de caracterização econômica.",
      observedResult:
        "Recebeu entrada já degradada por f.2a (região tabular fragmentada) — nunca uma entrada estruturalmente válida. A lógica própria desta capacidade permanece provada correta apenas sinteticamente; seu comportamento contra entrada real íntegra nunca foi observado. Resultado 'inconclusiva', nunca 'reprovada' — não há evidência de defeito na lógica própria desta capacidade, apenas evidência de que ela nunca foi genuinamente exercitada.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
      expectationDefinedAt: null,
      expectationReference: null,
      executionReference: `Sprint 21.4B (commit ${SPRINT_21_4B_EXECUTION_COMMIT})`,
    },
    adversarialEvidence: null,
    failureAssessment: "not_assessable",
    knownLimitationsPt: [
      "Nunca foi exercitada contra uma entrada real estruturalmente válida — nenhuma conclusão sobre sua própria correção contra dados reais é possível ainda.",
      "O resultado 'inconclusiva' (não 'reprovada') reflete precisamente isso: ausência de evidência válida, não evidência de defeito.",
    ],
    knownFailuresPt: [],
    promotionConditionPt: "Aguardar correção comprovada de f.2a (Sprint 21.4B.3, proposta) e reexecutar contra entrada real estruturalmente válida.",
    evaluatedRevision: MAIN_REVISION,
    lastEvaluatedDate: EVAL_DATE,
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4B/21.4G`,
    downstreamGates: [
      {
        consumerId: "budget_version_draft_creation",
        consumerKind: "consumer_class",
        purposePt: "criação de rascunho de Versão do Orçamento a partir de documento real",
        purposeKind: "productive_use",
        status: "bloqueado",
        minimumEvidenceLevel: "comparada_formalmente_em_caso_real",
        allowedResults: ["aprovada"],
        rationalePt: "Nenhuma reconciliação real válida foi produzida — nenhuma base confiável para qualquer rascunho.",
        missingEvidencePt: "Correção de f.2a e reconciliação real bem-sucedida contra entrada estruturalmente válida.",
        behaviorWhenBlockedPt: "Nenhuma criação de rascunho de Versão do Orçamento a partir de documento real deve prosseguir.",
      },
    ],
    dependsOnTargetIds: ["g2-page-local-neutral-structured-evidence-formation", "g3-page-boundary-neutral-continuity-evaluation"],
    evaluationHistory: [
      {
        evaluationId: "econ-eval-2026-07-20-001",
        date: EVAL_DATE,
        evaluatedRevision: MAIN_REVISION,
        previousLevel: null,
        previousResult: null,
        newLevel: "exercitada_em_caso_real",
        newResult: "inconclusiva",
        inconclusiveCausePt: "Nunca recebeu entrada real estruturalmente válida devido à reprovação upstream de f.2a — a lógica própria desta capacidade nunca teve a chance de processar uma região tabular real íntegra. O veredito 'reprovada' pertence a f.2a (defeito estrutural comprovado em sua própria lógica) e ao cenário ponta a ponta `tender-budget-real-extraction-e2e` (objetivo declarado não alcançado) — nunca a esta capacidade isoladamente.",
        evidenceConsideredPt: ["Execução da Sprint 21.4B sobre entrada real já degradada por f.2a — nenhum defeito próprio identificável, entrada nunca estruturalmente válida."],
        limitationsPt: ["Resultado inteiramente determinado pela entrada degradada de f.2a, não pela lógica própria desta capacidade."],
        knownFailuresPt: [],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Correção de revisão independente: nível exercitada_em_caso_real, resultado inconclusiva (nunca reprovada) — o veredito reprovado pertence a f.2a e ao cenário ponta a ponta.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "tender-budget-real-extraction-e2e",
    namePt: "Extração e Reconciliação do Orçamento Real",
    targetKind: "end_to_end_scenario",
    stageId: "21.4B",
    descriptionPt:
      "Cenário ponta a ponta: leitura física → localização de páginas → f.1 → f.2a → f.2b → f.2c → g.1 → g.2 → g.3 → caracterização econômica, contra o documento real do Pregão Eletrônico 90006/2025 (DNOCS), com reconciliação linha a linha contra a referência independente `LAGOA_DO_ARROZ_OFFICIAL_LINES`.",
    currentLevel: "comparada_formalmente_em_caso_real",
    currentResult: "reprovada",
    inconclusiveCausePt: null,
    syntheticEvidenceSummaryPt: "Não aplicável diretamente — este é um cenário ponta a ponta, avaliado apenas contra o documento real; cada capacidade dependente tem sua própria evidência sintética registrada em seu próprio alvo.",
    realEvidence: {
      sourceFingerprintSha256: REAL_DOCUMENT_FINGERPRINT_SHA256,
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "11 grupos, 25 subgrupos, 300 itens, R$ 9.809.087,18 reconciliados contra a referência independente `LAGOA_DO_ARROZ_OFFICIAL_LINES`.",
      observedResult: "Zero grupos, zero subgrupos, zero itens reconciliados; nenhum total reconciliado. A cadeia técnica completa executou sem falha técnica bloqueante em nenhuma etapa, mas o objetivo declarado do cenário não foi alcançado.",
      divergences: [
        "11 grupos esperados vs. 0 observados",
        "25 subgrupos esperados vs. 0 observados",
        "300 itens esperados vs. 0 observados",
        "R$ 9.809.087,18 esperado vs. nenhum total reconciliado observado",
      ],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
      expectationDefinedAt: LAGOA_DO_ARROZ_FIXTURE_DATE,
      expectationReference: `Commit ${LAGOA_DO_ARROZ_FIXTURE_COMMIT} — fixture de referência independente \`LAGOA_DO_ARROZ_OFFICIAL_LINES\` (Sprint 21.3B, \`packages/bdos-core/src/domain/budget-version/lagoa-do-arroz.official-fixture.ts\`), anterior à execução real da Sprint 21.4B.`,
      executionReference: `Sprint 21.4B, execução real completa (commit ${SPRINT_21_4B_EXECUTION_COMMIT})`,
    },
    adversarialEvidence: null,
    failureAssessment: "confirmed",
    knownLimitationsPt: [
      "O defeito raiz deste cenário está isolado em f.2a (ver registro próprio) — este registro descreve o resultado agregado do cenário, nunca atribui o defeito a nenhuma capacidade downstream de f.2a.",
    ],
    knownFailuresPt: ["Reconciliação econômica real completamente malsucedida — 0/11 grupos, 0/25 subgrupos, 0/300 itens, nenhum total reconciliado."],
    promotionConditionPt: "Aguardar correção comprovada de f.2a (Sprint 21.4B.3, proposta) e reexecutar o cenário completo contra o mesmo documento real.",
    evaluatedRevision: MAIN_REVISION,
    lastEvaluatedDate: EVAL_DATE,
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4B/21.4G`,
    downstreamGates: [
      {
        consumerId: "budget_version_draft_creation",
        consumerKind: "consumer_class",
        purposePt: "criação de rascunho de Versão do Orçamento a partir do cenário real completo",
        purposeKind: "productive_use",
        status: "bloqueado",
        minimumEvidenceLevel: "comparada_formalmente_em_caso_real",
        allowedResults: ["aprovada"],
        rationalePt: "O cenário ponta a ponta reprovou — nenhuma base confiável para qualquer rascunho a partir dele.",
        missingEvidencePt: "Correção de f.2a e reexecução completa do cenário com reconciliação bem-sucedida.",
        behaviorWhenBlockedPt: "Nenhuma criação de rascunho de Versão do Orçamento a partir deste cenário deve prosseguir.",
      },
    ],
    dependsOnTargetIds: [
      "f0-normalized-text-item-geometry",
      "f1-structure-reconstruction",
      "f2a-tabular-region-detection",
      "f2b-physical-column-hypothesis-reconstruction",
      "f2c-physical-cell-hypothesis-formation",
      "g1-physical-cell-text-evidence-formation",
      "g2-page-local-neutral-structured-evidence-formation",
      "g3-page-boundary-neutral-continuity-evaluation",
      "econ-budget-document-economic-characterization",
    ],
    evaluationHistory: [
      {
        evaluationId: "e2e-eval-2026-07-20-001",
        date: EVAL_DATE,
        evaluatedRevision: MAIN_REVISION,
        previousLevel: null,
        previousResult: null,
        newLevel: "comparada_formalmente_em_caso_real",
        newResult: "reprovada",
        inconclusiveCausePt: null,
        evidenceConsideredPt: ["Reconciliação real completa da Sprint 21.4B: 0/11 grupos, 0/25 subgrupos, 0/300 itens, nenhum total reconciliado, contra a fixture de referência independente definida na Sprint 21.3B (commit 5c86f451), anterior à execução."],
        limitationsPt: ["Defeito raiz isolado em f.2a — ver registro próprio."],
        knownFailuresPt: ["Reconciliação econômica real completamente malsucedida."],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro criado na segunda correção — separa o veredito do cenário ponta a ponta do veredito das capacidades individuais.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
];

/**
 * `deepFreeze` recursivo — equivalente ao padrão já usado em
 * `budget-document-signal-catalog.ts`. Aplicado ao registro inteiro,
 * incluindo arrays e objetos aninhados (portões, histórico, evidências,
 * limitações, falhas, dependências) — nunca apenas `Object.freeze` de
 * primeiro nível.
 */
function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
    return Object.freeze(value) as T;
  }
  if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => deepFreeze(item));
    return Object.freeze(value);
  }
  return value;
}

export const REAL_VALIDATION_TARGET_REGISTRY: RealValidationTargetRegistry = deepFreeze(MUTABLE_CAPABILITY_MATURITY_REGISTRY);

export function getRealValidationTargetRecord(id: string): RealValidationTargetRecord | undefined {
  return REAL_VALIDATION_TARGET_REGISTRY.find((record) => record.id === id);
}

export function listRealValidationTargetIds(): ReadonlyArray<string> {
  return REAL_VALIDATION_TARGET_REGISTRY.map((record) => record.id);
}
