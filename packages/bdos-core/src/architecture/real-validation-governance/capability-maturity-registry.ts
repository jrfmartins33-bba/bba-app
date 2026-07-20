import type { CapabilityMaturityRecord, CapabilityMaturityRegistry } from "./real-validation-maturity.types";
import { REAL_VALIDATION_MATURITY_REGISTRY_VERSION, ROLE_NOT_FORMALIZED } from "./real-validation-maturity.types";

/**
 * Registro versionado das capacidades documentais f.0 a g.3, mais a
 * caracterização econômica (Sprint 21.4B) — mandatada explicitamente a
 * permanecer sem nível "Validada em caso real". Reclassificado
 * exclusivamente a partir de evidências já existentes nos relatórios
 * preservados (branches `claude/epic-21-sprint-4b-*`) — nunca inferido,
 * nunca promovido por quantidade de testes, nunca tratando `completed`/
 * `structured`/`evaluated` como validação real por si só.
 *
 * Nível de evidência (`currentLevel`) e resultado da validação
 * (`currentResult`) são eixos separados — ver `real-validation-maturity.types.ts`.
 * Portões downstream são específicos por (consumidor, finalidade), nunca
 * um único status genérico por capacidade.
 *
 * Nenhum caminho local de documento real é referenciado — apenas
 * fingerprint (na forma exata já registrada no relatório de origem,
 * mesmo quando truncada) e intervalos de página/traço estrutural.
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

const MUTABLE_CAPABILITY_MATURITY_REGISTRY: Array<CapabilityMaturityRecord> = [
  {
    id: "f0-normalized-text-item-geometry",
    namePt: "Geometria Normalizada de Item Textual",
    stageId: "21.4A.2.f.0",
    descriptionPt:
      "Canonicaliza a geometria de layout, a relação com os limites da página e as métricas de disposição de cada item textual físico — contrato fundacional consumido por f.1. Não tem pasta própria (arquivos na raiz de budget-document-location).",
    currentLevel: "caracterizada_em_caso_real",
    currentResult: "nao_avaliada",
    inconclusiveCausePt: null,
    syntheticEvidenceSummaryPt:
      "Suíte sintética própria (canonicalização de geometria, relação com limites da página, métricas de disposição) mais exercício indireto pelos testes de cadeia real (`*.real-pdf-chain.test.ts`) com PDFs sintéticos.",
    realEvidence: {
      sourceFingerprintSha256: "5031da75...b92c5",
      pageOrTraceRange: "páginas 46-54 do documento real, via cadeia completa executada na Sprint 21.4B",
      expectedResult: "Leitura física completa sem falha técnica; geometria normalizada para cada item textual das 9 páginas.",
      observedResult:
        "Leitura completa sem falha técnica reportada nesta etapa (status completed). Nenhuma comparação formal e isolada entre geometria esperada e observada foi definida especificamente para f.0 antes da execução — por isso o resultado é 'não avaliada', nunca 'aprovada'.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md (branch claude/epic-21-sprint-4b-real-tender-budget-extraction)",
    },
    adversarialEvidence: null,
    knownLimitationsPt: [
      "Nenhuma comparação formal e isolada entre resultado esperado e observado foi registrada especificamente para f.0 — apenas ausência de falha técnica durante a execução da cadeia completa.",
    ],
    knownFailuresPt: ["Nenhuma falha conhecida registrada para esta capacidade especificamente."],
    promotionConditionPt:
      "Definir e executar uma comparação formal e isolada (resultado esperado definido antes da execução vs. observado) da geometria produzida por f.0 contra amostras estruturais reais.",
    evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
    lastEvaluatedDate: "2026-07-20",
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "f1-structure-reconstruction",
        purposePt: "fornecimento de geometria normalizada para reconstrução estrutural",
        status: "aberto",
        rationalePt: "Nenhuma falha técnica detectada na cadeia real; f.1 consome f.0 sem problema observado.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto.",
      },
      {
        consumerId: "qualquer_consumo_produtivo",
        purposePt: "uso da geometria de f.0 como evidência formalmente validada (nível validada_em_caso_real)",
        status: "condicional",
        rationalePt: "Ausência de comparação formal esperado/observado significa que uma divergência silenciosa em f.0 não seria necessariamente capturada.",
        missingEvidencePt: "Comparação formal, definida antes da execução, entre geometria esperada e observada contra amostras reais.",
        behaviorWhenBlockedPt: "Consumo produtivo que dependa de garantia formal de f.0 deve aguardar essa comparação; consumo diagnóstico permanece liberado.",
      },
    ],
    evaluationHistory: [
      {
        evaluationId: "f0-eval-2026-07-20-001",
        date: "2026-07-20",
        evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
        previousLevel: null,
        previousResult: null,
        newLevel: "caracterizada_em_caso_real",
        newResult: "nao_avaliada",
        evidenceConsideredPt: ["Execução completa da cadeia real (Sprint 21.4B) sem falha técnica em f.0."],
        limitationsPt: ["Nenhuma comparação formal esperado/observado específica de f.0."],
        knownFailuresPt: ["Nenhuma falha conhecida registrada."],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível caracterizada_em_caso_real, resultado não avaliada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "f1-structure-reconstruction",
    namePt: "Reconstrução Estrutural Auditável",
    stageId: "21.4A.2.f.1",
    descriptionPt:
      "Reconstrói linhas físicas, segmentos horizontais e blocos bidimensionais a partir dos itens textuais elegíveis de uma página candidata. Pasta `structure-reconstruction/`, orquestrador `reconstructBudgetDocumentStructure`.",
    currentLevel: "caracterizada_em_caso_real",
    currentResult: "nao_avaliada",
    inconclusiveCausePt: null,
    syntheticEvidenceSummaryPt:
      "Suíte sintética extensa (formação de linha, segmento, bloco, invariantes de conservação, determinismo, independência de ordem) — nunca exercitou uma tabela real densa multi-linha antes da Sprint 21.4B.1.",
    realEvidence: {
      sourceFingerprintSha256: "5031da75...b92c5",
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Não definido formalmente antes da execução para esta capacidade especificamente — apenas o objetivo geral da Sprint 21.4B.",
      observedResult:
        "Reconstrução completa sem falha técnica. Amostras estruturais reais inspecionadas na Sprint 21.4B.1 (3 continuações reais de descrição, 2 linhas esparsas de grupo/subgrupo) não revelaram defeito próprio de f.1 — mas essa inspeção foi diagnóstica (script temporário, deletado após uso), nunca um critério formal e completo de aceitação real definido previamente, e não houve decisão humana formal de aprovação. Por isso o resultado é 'não avaliada', nunca 'aprovada' — a evidência favorável permanece registrada abaixo e no histórico, apenas não sustenta uma aprovação formal.",
      divergences: [],
      reportReference: "Checkpoint da Sprint 21.4B.1 (branch claude/epic-21-sprint-4b1-dense-table-region-diagnosis, commit 0e7fc0883f73b4f9fb868173d773e434b5362606)",
    },
    adversarialEvidence: null,
    knownLimitationsPt: [
      "A inspeção real foi diagnóstica (script temporário, deletado após uso), não uma comparação formal esperado/observado definida antes da execução, e não houve decisão humana formal de aprovação — por isso o resultado permanece 'não avaliada', mesmo com evidência informal favorável já registrada.",
    ],
    knownFailuresPt: ["Nenhuma falha conhecida registrada para esta capacidade especificamente nas amostras inspecionadas — observação informal, não uma validação formal."],
    promotionConditionPt: "Definir formalmente um critério de aceitação real (resultado esperado antes da execução) para f.1, executar a comparação, e obter decisão humana de aprovação — só então mover para 'aprovada'.",
    evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
    lastEvaluatedDate: "2026-07-20",
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "f2a-tabular-region-detection",
        purposePt: "diagnóstico/desenvolvimento (fornecimento de linhas físicas para detecção de região)",
        status: "aberto",
        rationalePt: "Justificativa limitada à investigação técnica — nenhuma falha própria identificada nas amostras inspecionadas; a fragmentação downstream em f.2a foi isolada e não atribuída a f.1.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto, limitado a investigação técnica.",
      },
      {
        consumerId: "econ-budget-document-economic-characterization",
        purposePt: "validação real",
        status: "bloqueado",
        rationalePt: "f.2a está reprovada em caso real e degrada a cadeia downstream — o consumo econômico validado não pode depender de f.1 isoladamente enquanto a cadeia como um todo estiver comprometida.",
        missingEvidencePt: "Correção aprovada de f.2a; execução contra documento real; portões estruturais aprovados; saída downstream não degradada.",
        behaviorWhenBlockedPt: "Nenhum consumo econômico validado deve prosseguir enquanto f.2a permanecer reprovada, independentemente do estado de f.1.",
      },
      {
        consumerId: "budget_version_draft_creation",
        purposePt: "uso produtivo (criação de rascunho de Versão do Orçamento)",
        status: "bloqueado",
        rationalePt: "Mesma cadeia comprometida por f.2a — uso produtivo nunca pode depender de uma etapa upstream reprovada.",
        missingEvidencePt: "Correção aprovada de f.2a; execução contra documento real; portões estruturais aprovados; saída downstream não degradada.",
        behaviorWhenBlockedPt: "Nenhuma criação de rascunho de Versão do Orçamento a partir de f.1 deve prosseguir enquanto f.2a permanecer reprovada.",
      },
    ],
    evaluationHistory: [
      {
        evaluationId: "f1-eval-2026-07-20-001",
        date: "2026-07-20",
        evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
        previousLevel: null,
        previousResult: null,
        newLevel: "caracterizada_em_caso_real",
        newResult: "nao_avaliada",
        evidenceConsideredPt: ["Inspeção diagnóstica de amostras reais (3 continuações, 2 linhas esparsas) na Sprint 21.4B.1 — nenhum defeito próprio encontrado, mas sem critério formal de aceitação nem aprovação humana."],
        limitationsPt: ["Inspeção informal, não uma comparação formal definida antes da execução; nenhuma decisão humana formal de aprovação."],
        knownFailuresPt: ["Nenhuma falha conhecida registrada nas amostras inspecionadas."],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível caracterizada_em_caso_real, resultado não avaliada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "f2a-tabular-region-detection",
    namePt: "Detecção Auditável de Região Tabular",
    stageId: "21.4A.2.f.2a",
    descriptionPt:
      "Forma janelas contíguas candidatas a região tabular a partir de alinhamentos verticais recorrentes entre linhas físicas. Pasta `tabular-region-detection/`, orquestrador `detectBudgetDocumentTabularRegions`.",
    currentLevel: "caracterizada_em_caso_real",
    currentResult: "reprovada",
    inconclusiveCausePt: null,
    syntheticEvidenceSummaryPt:
      "Suíte sintética extensa e aprovada (24+ testes incluindo casos adversariais H, I, J, L1-L12) — mas os testes sintéticos originais (pré-21.4B) nunca exercitaram uma tabela real densa com descrições multilinha, exatamente o padrão que causou a falha real.",
    realEvidence: {
      sourceFingerprintSha256: "5031da75...b92c5",
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "11 grupos, 25 subgrupos, 300 itens, R$ 9.809.087,18 reconciliados (fatos oficiais independentes, Sprint 21.4B).",
      observedResult:
        "0 grupos, 0 subgrupos, 0 itens reconciliados; total nulo. Página real fragmentada em ~7 regiões pequenas por página, a maior com 4 linhas e 2 colunas resolvidas. Causa raiz isolada com precisão nas Sprints 21.4B.1/21.4B.2: a regra de formação de janela em `tabular-region-formation.ts` exige que toda linha física sustente sozinha `>= minimumRecurrentAlignmentCount` alinhamentos — uma invariante falsa para continuações de descrição multilinha e linhas esparsas legítimas. Duas Sprints de investigação buscaram um discriminador seguro; nenhum foi encontrado dentro da evidência estrutural mínima autorizada. Nível permanece caracterizada_em_caso_real (nunca validada_em_caso_real) precisamente porque o resultado é reprovada.",
      divergences: [
        "11 grupos esperados vs. 0 observados",
        "25 subgrupos esperados vs. 0 observados",
        "300 itens esperados vs. 0 observados",
        "R$ 9.809.087,18 esperado vs. total nulo observado",
      ],
      reportReference:
        "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md; checkpoints das Sprints 21.4B.1 (commit 0e7fc0883f73b4f9fb868173d773e434b5362606) e 21.4B.2 (commit 13257242e38273c3a816db2619f847112c466794)",
    },
    adversarialEvidence: {
      adversarialCasesSummary:
        "Caso J (21.4B.1) e Caso L7 (21.4B.2): parágrafo externo com espaçamento apertado deliberado e exatamente 1 alinhamento coincidente com uma coluna real — construído para imitar uma continuação legítima.",
      outcomeSummary:
        "Um spike de correção testado nas duas Sprints absorveu incorretamente o caso adversarial após corrigir os casos positivos — confirmando que nenhum discriminador seguro existe dentro da evidência estrutural mínima (razão de intervalo, subconjunto de alinhamentos, reconfirmação) sem conhecimento de envelope/grade de colunas, fora do escopo autorizado.",
      reportReference: "Checkpoints das Sprints 21.4B.1 e 21.4B.2 (branches preservadas, sem correção de produção mantida)",
    },
    knownLimitationsPt: [
      "A falha é isolada e específica a tabelas reais densas com descrições multilinha — nunca exercitada pelos testes sintéticos originais.",
      "Nenhum discriminador estrutural mínimo (sem grade de colunas) resolve o caso adversarial (Caso J/L7) sem também absorver conteúdo não tabular.",
    ],
    knownFailuresPt: [
      "Fragmentação severa de regiões tabulares reais densas com descrições multilinha, impedindo reconciliação econômica (Sprint 21.4B).",
      "Três continuações consecutivas idênticas formam seu próprio alinhamento privado, criando uma janela concorrente espúria (Sprint 21.4B.2, Caso L3) — um segundo modo de falha, não corrigido.",
    ],
    promotionConditionPt:
      "Implementar e validar (sintética + adversarialmente + em documento real) uma correção que propague envelope horizontal por coluna reconhecida (proposta: Sprint 21.4B.3 — Pertencimento Geométrico à Grade Tabular) — nunca reduzir rigor para simplesmente aumentar regionColumnCount.",
    evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
    lastEvaluatedDate: "2026-07-20",
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprints 21.4B/21.4B.1/21.4B.2`,
    downstreamGates: [
      {
        consumerId: "diagnostico_estrutural",
        purposePt: "diagnóstico e investigação (scripts manuais, nunca produção)",
        status: "aberto",
        rationalePt: "A cadeia executa sem falha técnica e produz dados estruturais úteis para diagnóstico, mesmo fragmentados.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto.",
      },
      {
        consumerId: "f2b-physical-column-hypothesis-reconstruction",
        purposePt: "reconstrução de coluna física a partir de região tabular real",
        status: "bloqueado",
        rationalePt: "Uma região tabular real com fragmentação severa e cobertura insuficiente não pode alimentar hipóteses de coluna com confiança.",
        missingEvidencePt: "Correção comprovada da invariante de formação de janela em tabular-region-formation.ts.",
        behaviorWhenBlockedPt: "f.2b não deve processar saída real de f.2a com expectativa de resultado utilizável até correção.",
      },
      {
        consumerId: "econ-budget-document-economic-characterization",
        purposePt: "extração e reconciliação econômica real",
        status: "bloqueado",
        rationalePt: "Zero grupos/subgrupos/itens reconciliados — bloqueio direto e comprovado.",
        missingEvidencePt: "Correção comprovada de f.2a e reexecução completa da reconciliação real.",
        behaviorWhenBlockedPt: "Nenhuma criação de rascunho de Versão do Orçamento a partir de documento real deve prosseguir.",
      },
    ],
    evaluationHistory: [
      {
        evaluationId: "f2a-eval-2026-07-20-001",
        date: "2026-07-20",
        evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
        previousLevel: null,
        previousResult: null,
        newLevel: "caracterizada_em_caso_real",
        newResult: "reprovada",
        evidenceConsideredPt: [
          "Reconciliação real da Sprint 21.4B: 0/11 grupos, 0/25 subgrupos, 0/300 itens, total nulo.",
          "Investigação de causa raiz e tentativas de correção nas Sprints 21.4B.1 e 21.4B.2, ambas revertidas após falha adversarial (Caso J/L7).",
        ],
        limitationsPt: ["Falha isolada a tabelas reais densas com descrições multilinha; nenhum discriminador mínimo encontrado sem grade de colunas."],
        knownFailuresPt: ["Fragmentação severa (Sprint 21.4B); alinhamento privado de continuações consecutivas (Caso L3, Sprint 21.4B.2)."],
        implementer: IMPLEMENTER,
        adversarialReviewer: "Claude Code (mesma sessão — não formalizado como papel independente)",
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro formal da reprovação já comprovada nas Sprints 21.4B/21.4B.1/21.4B.2 — nível caracterizada_em_caso_real, resultado reprovada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "f2b-physical-column-hypothesis-reconstruction",
    namePt: "Reconstrução de Hipóteses Físicas de Coluna",
    stageId: "21.4A.2.f.2b",
    descriptionPt: "Reconstrói hipóteses de coluna física a partir das regiões tabulares candidatas de f.2a. Pasta `physical-column-hypothesis-reconstruction/`, orquestrador `reconstructBudgetDocumentPhysicalColumnHypotheses`.",
    currentLevel: "caracterizada_em_caso_real",
    currentResult: "inconclusiva",
    inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a (região tabular fragmentada) — o resultado observado reflete a entrada degradada, não a correção própria desta capacidade.",
    syntheticEvidenceSummaryPt: "Suíte sintética própria aprovada, mais teste de cadeia real com PDF sintético (`reconstruct-budget-document-physical-column-hypotheses.real-pdf-chain.test.ts`).",
    realEvidence: {
      sourceFingerprintSha256: "5031da75...b92c5",
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Não definido antes da execução para esta capacidade especificamente — apenas herdado do objetivo geral da Sprint 21.4B.",
      observedResult:
        "Executada sem falha técnica (status completed) sobre a saída já fragmentada de f.2a — nenhuma falha própria identificada, mas também nenhuma evidência de correção independente, já que sua entrada real estava degradada pelo defeito upstream conhecido. Por isso resultado 'inconclusiva', nunca 'aprovada'.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
    },
    adversarialEvidence: null,
    knownLimitationsPt: [
      "Evidência real confundida pelo defeito upstream conhecido de f.2a — 'sem falha técnica' aqui não comprova correção substantiva contra dados reais não degradados.",
    ],
    knownFailuresPt: ["Nenhuma falha própria conhecida — mas nunca testada contra uma saída de f.2a que não estivesse degradada."],
    promotionConditionPt: "Reexecutar contra o mesmo documento real somente após f.2a estar corrigido e validado, com resultado esperado definido antes da execução.",
    evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
    lastEvaluatedDate: "2026-07-20",
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "f2c-physical-cell-hypothesis-formation",
        purposePt: "consumo diagnóstico (encadeamento técnico)",
        status: "aberto",
        rationalePt: "A cadeia técnica encadeia sem falha, para fins de diagnóstico.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto.",
      },
      {
        consumerId: "econ-budget-document-economic-characterization",
        purposePt: "consumo econômico validado",
        status: "bloqueado",
        rationalePt: "Depende inteiramente do portão de f.2a, hoje reprovado.",
        missingEvidencePt: "f.2a corrigido e revalidado; reexecução de f.2b contra entrada real não degradada.",
        behaviorWhenBlockedPt: "Nenhum consumo econômico produtivo deve prosseguir.",
      },
    ],
    evaluationHistory: [
      {
        evaluationId: "f2b-eval-2026-07-20-001",
        date: "2026-07-20",
        evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
        previousLevel: null,
        previousResult: null,
        newLevel: "caracterizada_em_caso_real",
        newResult: "inconclusiva",
        evidenceConsideredPt: ["Execução sem falha técnica sobre entrada já fragmentada por f.2a (Sprint 21.4B)."],
        limitationsPt: ["Evidência confundida por defeito upstream conhecido."],
        knownFailuresPt: ["Nenhuma falha própria conhecida."],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível caracterizada_em_caso_real, resultado inconclusiva por entrada degradada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "f2c-physical-cell-hypothesis-formation",
    namePt: "Formação de Hipóteses Físicas de Célula",
    stageId: "21.4A.2.f.2c",
    descriptionPt: "Forma hipóteses de célula física a partir das hipóteses de coluna de f.2b. Pasta `physical-cell-hypothesis-formation/`, orquestrador `formBudgetDocumentPhysicalCellHypotheses`.",
    currentLevel: "caracterizada_em_caso_real",
    currentResult: "inconclusiva",
    inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a — mesma causa do registro de f.2b.",
    syntheticEvidenceSummaryPt: "Suíte sintética própria aprovada, mais teste de cadeia real com PDF sintético.",
    realEvidence: {
      sourceFingerprintSha256: "5031da75...b92c5",
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Não definido antes da execução para esta capacidade especificamente.",
      observedResult: "Executada sem falha técnica sobre a saída já fragmentada de f.2a/f.2b — mesma ressalva de confundimento por defeito upstream. Resultado inconclusiva, nunca aprovada.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
    },
    adversarialEvidence: null,
    knownLimitationsPt: ["Evidência real confundida pelo defeito upstream conhecido de f.2a — mesma ressalva do registro de f.2b."],
    knownFailuresPt: ["Nenhuma falha própria conhecida — mas nunca testada contra uma saída de f.2a que não estivesse degradada."],
    promotionConditionPt: "Reexecutar contra o mesmo documento real somente após f.2a estar corrigido e validado.",
    evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
    lastEvaluatedDate: "2026-07-20",
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "g1-physical-cell-text-evidence-formation",
        purposePt: "consumo diagnóstico (encadeamento técnico)",
        status: "aberto",
        rationalePt: "A cadeia técnica encadeia sem falha, para fins de diagnóstico.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto.",
      },
      {
        consumerId: "econ-budget-document-economic-characterization",
        purposePt: "consumo econômico validado",
        status: "bloqueado",
        rationalePt: "Depende inteiramente do portão de f.2a, hoje reprovado.",
        missingEvidencePt: "f.2a corrigido e revalidado.",
        behaviorWhenBlockedPt: "Nenhum consumo econômico produtivo deve prosseguir.",
      },
    ],
    evaluationHistory: [
      {
        evaluationId: "f2c-eval-2026-07-20-001",
        date: "2026-07-20",
        evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
        previousLevel: null,
        previousResult: null,
        newLevel: "caracterizada_em_caso_real",
        newResult: "inconclusiva",
        evidenceConsideredPt: ["Execução sem falha técnica sobre entrada já fragmentada por f.2a/f.2b (Sprint 21.4B)."],
        limitationsPt: ["Evidência confundida por defeito upstream conhecido."],
        knownFailuresPt: ["Nenhuma falha própria conhecida."],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível caracterizada_em_caso_real, resultado inconclusiva por entrada degradada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "g1-physical-cell-text-evidence-formation",
    namePt: "Formação de Evidência Textual Auditável de Célula",
    stageId: "21.4A.2.g.1",
    descriptionPt: "Forma evidência textual de célula a partir das hipóteses físicas de f.2c. Pasta `physical-cell-text-evidence-formation/`, orquestrador `formBudgetDocumentPhysicalCellTextEvidence`.",
    currentLevel: "caracterizada_em_caso_real",
    currentResult: "inconclusiva",
    inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a.",
    syntheticEvidenceSummaryPt: "Suíte sintética própria aprovada, mais teste de cadeia real com PDF sintético.",
    realEvidence: {
      sourceFingerprintSha256: "5031da75...b92c5",
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Não definido antes da execução para esta capacidade especificamente.",
      observedResult: "Executada sem falha técnica sobre a saída já fragmentada a montante — mesma ressalva de confundimento. Resultado inconclusiva.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
    },
    adversarialEvidence: null,
    knownLimitationsPt: ["Evidência real confundida pelo defeito upstream conhecido de f.2a."],
    knownFailuresPt: ["Nenhuma falha própria conhecida — mas nunca testada contra uma saída a montante não degradada."],
    promotionConditionPt: "Reexecutar contra o mesmo documento real somente após f.2a estar corrigido e validado.",
    evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
    lastEvaluatedDate: "2026-07-20",
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "g2-page-local-neutral-structured-evidence-formation",
        purposePt: "consumo diagnóstico (encadeamento técnico)",
        status: "aberto",
        rationalePt: "A cadeia técnica encadeia sem falha, para fins de diagnóstico.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto.",
      },
      {
        consumerId: "econ-budget-document-economic-characterization",
        purposePt: "consumo econômico validado",
        status: "bloqueado",
        rationalePt: "Depende inteiramente do portão de f.2a, hoje reprovado.",
        missingEvidencePt: "f.2a corrigido e revalidado.",
        behaviorWhenBlockedPt: "Nenhum consumo econômico produtivo deve prosseguir.",
      },
    ],
    evaluationHistory: [
      {
        evaluationId: "g1-eval-2026-07-20-001",
        date: "2026-07-20",
        evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
        previousLevel: null,
        previousResult: null,
        newLevel: "caracterizada_em_caso_real",
        newResult: "inconclusiva",
        evidenceConsideredPt: ["Execução sem falha técnica sobre entrada já fragmentada a montante (Sprint 21.4B)."],
        limitationsPt: ["Evidência confundida por defeito upstream conhecido."],
        knownFailuresPt: ["Nenhuma falha própria conhecida."],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível caracterizada_em_caso_real, resultado inconclusiva por entrada degradada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "g2-page-local-neutral-structured-evidence-formation",
    namePt: "Formação de Evidência Estruturada Neutra Página-Local",
    stageId: "21.4A.2.g.2",
    descriptionPt: "Forma evidência estruturada neutra local à página a partir da evidência textual de g.1. Pasta `page-local-neutral-structured-evidence-formation/`, orquestrador `formBudgetDocumentPageLocalNeutralStructuredEvidence`.",
    currentLevel: "caracterizada_em_caso_real",
    currentResult: "inconclusiva",
    inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a.",
    syntheticEvidenceSummaryPt: "Suíte sintética própria aprovada, mais teste de cadeia real com PDF sintético.",
    realEvidence: {
      sourceFingerprintSha256: "5031da75...b92c5",
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Não definido antes da execução para esta capacidade especificamente.",
      observedResult: "Executada sem falha técnica sobre a saída já fragmentada a montante — mesma ressalva de confundimento. Resultado inconclusiva.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
    },
    adversarialEvidence: null,
    knownLimitationsPt: ["Evidência real confundida pelo defeito upstream conhecido de f.2a."],
    knownFailuresPt: ["Nenhuma falha própria conhecida — mas nunca testada contra uma saída a montante não degradada."],
    promotionConditionPt: "Reexecutar contra o mesmo documento real somente após f.2a estar corrigido e validado.",
    evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
    lastEvaluatedDate: "2026-07-20",
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "g3-page-boundary-neutral-continuity-evaluation",
        purposePt: "consumo diagnóstico (encadeamento técnico)",
        status: "aberto",
        rationalePt: "A cadeia técnica encadeia sem falha, para fins de diagnóstico.",
        missingEvidencePt: null,
        behaviorWhenBlockedPt: "N/A — portão aberto.",
      },
      {
        consumerId: "econ-budget-document-economic-characterization",
        purposePt: "consumo econômico validado",
        status: "bloqueado",
        rationalePt: "Depende inteiramente do portão de f.2a, hoje reprovado.",
        missingEvidencePt: "f.2a corrigido e revalidado.",
        behaviorWhenBlockedPt: "Nenhum consumo econômico produtivo deve prosseguir.",
      },
    ],
    evaluationHistory: [
      {
        evaluationId: "g2-eval-2026-07-20-001",
        date: "2026-07-20",
        evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
        previousLevel: null,
        previousResult: null,
        newLevel: "caracterizada_em_caso_real",
        newResult: "inconclusiva",
        evidenceConsideredPt: ["Execução sem falha técnica sobre entrada já fragmentada a montante (Sprint 21.4B)."],
        limitationsPt: ["Evidência confundida por defeito upstream conhecido."],
        knownFailuresPt: ["Nenhuma falha própria conhecida."],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível caracterizada_em_caso_real, resultado inconclusiva por entrada degradada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "g3-page-boundary-neutral-continuity-evaluation",
    namePt: "Avaliação Neutra de Continuidade na Fronteira entre Páginas",
    stageId: "21.4A.2.g.3",
    descriptionPt: "Avalia se evidência estrutural na fronteira entre páginas sustenta candidatura à continuidade lógica — nunca funde estrutura. Pasta `page-boundary-neutral-continuity-evaluation/`, orquestrador `evaluateBudgetDocumentPageBoundaryNeutralContinuity`.",
    currentLevel: "caracterizada_em_caso_real",
    currentResult: "inconclusiva",
    inconclusiveCausePt: "Entrada real recebida já estava degradada pela reprovação upstream de f.2a.",
    syntheticEvidenceSummaryPt: "Suíte sintética própria aprovada, mais teste de cadeia real com PDF sintético de 4 páginas.",
    realEvidence: {
      sourceFingerprintSha256: "5031da75...b92c5",
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "Não definido antes da execução para esta capacidade especificamente.",
      observedResult: "Executada sem falha técnica sobre a saída já fragmentada a montante — mesma ressalva de confundimento. Resultado inconclusiva.",
      divergences: [],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
    },
    adversarialEvidence: null,
    knownLimitationsPt: ["Evidência real confundida pelo defeito upstream conhecido de f.2a."],
    knownFailuresPt: ["Nenhuma falha própria conhecida — mas nunca testada contra uma saída a montante não degradada."],
    promotionConditionPt: "Reexecutar contra o mesmo documento real somente após f.2a estar corrigido e validado.",
    evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
    lastEvaluatedDate: "2026-07-20",
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4G`,
    downstreamGates: [
      {
        consumerId: "econ-budget-document-economic-characterization",
        purposePt: "consumo econômico validado (candidatura à continuidade entre páginas)",
        status: "bloqueado",
        rationalePt: "Depende inteiramente do portão de f.2a, hoje reprovado.",
        missingEvidencePt: "f.2a corrigido e revalidado.",
        behaviorWhenBlockedPt: "Nenhum consumo econômico produtivo deve prosseguir.",
      },
    ],
    evaluationHistory: [
      {
        evaluationId: "g3-eval-2026-07-20-001",
        date: "2026-07-20",
        evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
        previousLevel: null,
        previousResult: null,
        newLevel: "caracterizada_em_caso_real",
        newResult: "inconclusiva",
        evidenceConsideredPt: ["Execução sem falha técnica sobre entrada já fragmentada a montante (Sprint 21.4B)."],
        limitationsPt: ["Evidência confundida por defeito upstream conhecido."],
        knownFailuresPt: ["Nenhuma falha própria conhecida."],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro inicial da Sprint 21.4G — nível caracterizada_em_caso_real, resultado inconclusiva por entrada degradada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
  {
    id: "econ-budget-document-economic-characterization",
    namePt: "Caracterização Econômica do Documento de Orçamento",
    stageId: "21.4B",
    descriptionPt:
      "Consome g.2/g.3 para propor grupos, subgrupos e itens de serviço econômicos, com reconciliação linha a linha contra referência independente. Domínio irmão `budget-document-economic-characterization/` (nunca aninhado em budget-document-location).",
    currentLevel: "caracterizada_em_caso_real",
    currentResult: "reprovada",
    inconclusiveCausePt: null,
    syntheticEvidenceSummaryPt: "Suíte sintética completa e aprovada (reconhecimento de cabeçalho/coluna, hierarquia, parsing brasileiro, reconciliação, diff independente, fingerprint) — nenhuma falha própria identificada nela.",
    realEvidence: {
      sourceFingerprintSha256: "5031da75...b92c5",
      pageOrTraceRange: "páginas 46-54 do documento real",
      expectedResult: "11 grupos, 25 subgrupos, 300 itens, R$ 9.809.087,18 reconciliados contra a referência independente `LAGOA_DO_ARROZ_OFFICIAL_LINES`.",
      observedResult:
        "Zero grupos, zero subgrupos, zero itens reconciliados; ausência de total reconciliado (nulo). Resultado inteiramente determinado pela entrada degradada recebida de f.2a, não por um defeito na lógica de caracterização econômica em si (provada correta sinteticamente) — mas o RESULTADO da validação real é, sem ambiguidade, reprovada: o objetivo declarado (reconciliar 11/25/300/R$9.809.087,18) não foi alcançado.",
      divergences: ["11 grupos esperados vs. 0 observados", "25 subgrupos esperados vs. 0 observados", "300 itens esperados vs. 0 observados", "R$ 9.809.087,18 esperado vs. ausência de total reconciliado"],
      reportReference: "EPIC_21_SPRINT_4B_REAL_TENDER_BUDGET_EXTRACTION.md",
    },
    adversarialEvidence: null,
    knownLimitationsPt: [
      "Nunca foi exercitada contra uma entrada real não degradada — o resultado reprovado é consequência direta do defeito upstream de f.2a, não de uma falha na lógica própria desta capacidade.",
      "Por instrução explícita da Sprint 21.4G, esta capacidade permanece em caracterizada_em_caso_real com resultado reprovada até f.2a ser corrigido e a cadeia completa ser reexecutada — nunca 'validada_em_caso_real'.",
    ],
    knownFailuresPt: ["Zero linhas economicamente reconciliadas contra o documento real — consequência direta e integralmente atribuível ao defeito upstream de f.2a."],
    promotionConditionPt: "Aguardar correção comprovada de f.2a (Sprint 21.4B.3, proposta) e reexecutar a reconciliação completa contra o mesmo documento real.",
    evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
    lastEvaluatedDate: "2026-07-20",
    technicalReportOwner: `${IMPLEMENTER} (Implementador) — Sprint 21.4B/21.4G`,
    downstreamGates: [
      {
        consumerId: "budget_version_draft_creation",
        purposePt: "criação de rascunho de Versão do Orçamento a partir de documento real",
        status: "bloqueado",
        rationalePt: "Zero reconciliação real — nenhuma base confiável para qualquer rascunho.",
        missingEvidencePt: "Correção de f.2a e reconciliação real bem-sucedida (11/25/300/R$9.809.087,18).",
        behaviorWhenBlockedPt: "Nenhuma criação de rascunho de Versão do Orçamento a partir de documento real deve prosseguir.",
      },
    ],
    evaluationHistory: [
      {
        evaluationId: "econ-eval-2026-07-20-001",
        date: "2026-07-20",
        evaluatedRevision: "35e18a50fcd3b357db71d4662b83ba0b545ae1b3",
        previousLevel: null,
        previousResult: null,
        newLevel: "caracterizada_em_caso_real",
        newResult: "reprovada",
        evidenceConsideredPt: ["Reconciliação real da Sprint 21.4B: 0/11 grupos, 0/25 subgrupos, 0/300 itens, ausência de total."],
        limitationsPt: ["Resultado inteiramente determinado pela entrada degradada de f.2a, não pela lógica própria desta capacidade."],
        knownFailuresPt: ["Zero linhas economicamente reconciliadas contra o documento real."],
        implementer: IMPLEMENTER,
        adversarialReviewer: ROLE_NOT_FORMALIZED,
        approver: ROLE_NOT_FORMALIZED,
        decisionPt: "Registro formal da reprovação já comprovada na Sprint 21.4B — nível caracterizada_em_caso_real, resultado reprovada.",
        justificationPt: CHECKPOINT_REVIEWER_NOTE,
      },
    ],
    registryVersion: REAL_VALIDATION_MATURITY_REGISTRY_VERSION,
  },
];

export const CAPABILITY_MATURITY_REGISTRY: CapabilityMaturityRegistry = Object.freeze(
  MUTABLE_CAPABILITY_MATURITY_REGISTRY.map((record) => Object.freeze(record)),
);

export function getCapabilityMaturityRecord(id: string): CapabilityMaturityRecord | undefined {
  return CAPABILITY_MATURITY_REGISTRY.find((record) => record.id === id);
}

export function listCapabilityIds(): ReadonlyArray<string> {
  return CAPABILITY_MATURITY_REGISTRY.map((record) => record.id);
}
