/**
 * Manifesto de amostras reais do documento Lagoa do Arroz (Sprint
 * 21.4B.3A) — correção do commit `50bf42a` (Sprint 21.4B.3A original).
 *
 * ESTADO DECLARADO EXPLICITAMENTE (correção obrigatória, ver
 * `EPIC_21_SPRINT_4B3A_TABULAR_MEMBERSHIP_DISCOVERY_REPORT.md` §9-10):
 * este manifesto é uma **exploração PÓS-EXECUÇÃO**, nunca uma validação
 * real pré-registrada nem cega. O script de diagnóstico
 * (`scripts/discover-tabular-membership-real-document.ts`) primeiro
 * avaliou H1-H4/H3b sobre todas as linhas excluídas pela regra atual, e
 * SÓ DEPOIS a inspeção humana (leitura do texto de origem, permitida
 * apenas para rotulagem humana — nunca para os algoritmos) selecionou e
 * rotulou as 14 amostras abaixo, já sabendo o resultado das candidatas
 * para cada uma. Isso é suficiente para REFUTAR a aprovação de H3/H3b
 * como invariante segura para o documento real (um falso negativo real
 * observado já basta para reprovar, independente de quando foi
 * descoberto) — mas não constitui, e nunca deve ser citado como,
 * validação real formal no sentido de `EPIC_21_SPRINT_4G_REAL_VALIDATION_GOVERNANCE.md`
 * (que exigiria um manifesto rotulado e congelado ANTES de qualquer
 * execução de candidata). O próximo experimento mínimo (ver relatório)
 * deve corrigir isso construindo o manifesto ANTES da avaliação.
 *
 * Identidade de cada amostra: `(realPageNumber, lineKey)` — nunca apenas
 * o texto, que se repete em várias linhas/páginas com decisões
 * diferentes (confirmado ao reexaminar os dados salvos em
 * `private/tabular-membership-discovery/*.json`, não commitados). Onde o
 * mesmo texto ocorre mais de uma vez, a amostra escolhida é identificada
 * explicitamente por `lineKey`, extraído do mesmo JSON de diagnóstico.
 */

export type RealSampleHumanLabel = "must_include" | "must_exclude" | "uncertain";
export type RealSampleCandidateDecision = "must_include" | "must_exclude" | "insufficient_evidence";
export type RealSampleOutcome = "acerto" | "falso_positivo" | "falso_negativo" | "evidencia_insuficiente" | "nao_avaliado" | "incerto";

export interface RealSample {
  readonly sampleId: string;
  readonly realPageNumber: number;
  /** Identidade estável da linha física, extraída do JSON de diagnóstico salvo em `private/tabular-membership-discovery/lagoa-do-arroz-discovery-1784594947958.json` (não commitado — apenas o hash aqui preserva a identidade). */
  readonly lineKey: string;
  readonly locationText: string;
  readonly humanLabel: RealSampleHumanLabel;
  readonly humanJustificationPt: string;
  readonly h3Decision: RealSampleCandidateDecision;
  readonly h3bDecision: RealSampleCandidateDecision;
}

export const REAL_SAMPLE_MANIFEST_STATUS = "post_execution_exploration" as const;

export const REAL_SAMPLE_MANIFEST: ReadonlyArray<RealSample> = [
  {
    sampleId: "R1",
    realPageNumber: 46,
    lineKey: "7ede9ba9e1371eef5023ac4c1b48f0604df4719fa0f4467207922dc0ec2b800a",
    locationText: "CADEADO",
    humanLabel: "must_include",
    humanJustificationPt: "Palavra isolada, largura estreita — continuação de item de portão/cadeado da linha anterior.",
    h3Decision: "must_include",
    h3bDecision: "must_include",
  },
  {
    sampleId: "R2",
    realPageNumber: 46,
    lineKey: "a9ac10de5852dd7e91284f54cfc08695395feae4123694afa7db3c070828317c",
    locationText: "(12 hs/dia)",
    humanLabel: "must_include",
    humanJustificationPt: "Fragmento de especificação de locação de gerador, mesma linha lógica do item anterior.",
    h3Decision: "must_include",
    h3bDecision: "must_include",
  },
  {
    sampleId: "R3",
    realPageNumber: 47,
    lineKey: "3d8df8bd0459c9020eb689f1e3703b544c086669f71e67aa1b6e689a672073e5",
    locationText: "_____________________________________",
    humanLabel: "must_exclude",
    humanJustificationPt: "Linha de assinatura (traço horizontal) antes de 'Orçamento elaborado por' — nunca parte da tabela.",
    h3Decision: "must_exclude",
    h3bDecision: "must_exclude",
  },
  {
    sampleId: "R4",
    realPageNumber: 46,
    lineKey: "b0585027f464fe656807736142f5693a023680c5fcba3f7623dc929b3302152d",
    locationText: "NERV TRAPEZ FORROC/ ISOL TERMO ACUST CHASSIS REFORC PISO COMPENS NAVAL INCL INST ELETR/HIDRO-",
    humanLabel: "must_include",
    humanJustificationPt: "Continuação de descrição técnica extensa (telhado/estrutura), mesma coluna DESCRIÇÃO.",
    h3Decision: "must_exclude",
    h3bDecision: "must_exclude",
  },
  {
    sampleId: "R5",
    realPageNumber: 46,
    lineKey: "09e0d3e73a0f6c8c43b15a5b189fd7f87cbae7f5f50cc2020eec8c6677522f1b",
    locationText: "C/ REVESTIMENTO EM MATERIAL APIÇARRADO ATÉ DMT DE 4000m",
    humanLabel: "must_include",
    humanJustificationPt: "Continuação de descrição de serviço de terraplenagem/revestimento.",
    h3Decision: "must_exclude",
    h3bDecision: "must_exclude",
  },
  {
    sampleId: "R6",
    realPageNumber: 51,
    lineKey: "a0ca8fe497ea62959231dc4a832711446f4b5f1979bafd76be0e3b1758aa6b47",
    locationText: "FORNECIMENTO E INSTALAÇÃO. AF_03/2023",
    humanLabel: "must_include",
    humanJustificationPt: "Fecho padrão de descrição de item SINAPI, recorrente em várias linhas do documento.",
    h3Decision: "must_exclude",
    h3bDecision: "must_include",
  },
  {
    sampleId: "R7",
    realPageNumber: 51,
    lineKey: "0b7c467c093bb062a7530764cc284ce316ad103d25730291ce837755da02aaa9",
    locationText: "2 UTILIZAÇÕES. AF_03/2024",
    humanLabel: "must_include",
    humanJustificationPt: "Mesmo padrão de fecho de descrição SINAPI.",
    h3Decision: "must_exclude",
    h3bDecision: "must_include",
  },
  {
    sampleId: "R8",
    realPageNumber: 53,
    lineKey: "59d921d0f2df68888cef4df2c6a7908cbd10ef260dcc8815f508b2e198079d6c",
    locationText: "ELÉTRICA - FORNECIMENTO E INSTALAÇÃO. AF_12/2021",
    humanLabel: "must_include",
    humanJustificationPt: "Mesmo padrão de fecho de descrição.",
    h3Decision: "must_exclude",
    h3bDecision: "must_include",
  },
  {
    sampleId: "R9",
    realPageNumber: 53,
    lineKey: "a630084ef22aad8ec58b809644646cd7a87faaaa44ad2f0bca98ebc53e707f08",
    locationText: "DIN 50A (NÃO INCLUSO O POSTE DE CONCRETO). AF_07/2020_PS",
    humanLabel: "must_include",
    humanJustificationPt: "Continuação de descrição de item elétrico (poste/luminária).",
    h3Decision: "must_exclude",
    h3bDecision: "must_exclude",
  },
  {
    sampleId: "R10",
    realPageNumber: 54,
    lineKey: "28980d01e0124d60e99798baa8765da22d55914590fdcf10ded69ac450ff1246",
    locationText: "BAROMÉTRICA, DIREÇÃO E VELOCIDADE DO VENTO ULTRASSÔNICO, PLUVIOMETRIA E PONTO DE ORVALHO. E",
    humanLabel: "must_include",
    humanJustificationPt: "Continuação de descrição de estação meteorológica.",
    h3Decision: "must_exclude",
    h3bDecision: "must_exclude",
  },
  {
    sampleId: "R11",
    realPageNumber: 54,
    lineKey: "f115e6ad44fb7809fa46fd7e64e9febcb7459e0b37597ea0782e064494e06b64",
    locationText: "PIROMETRO DE SEGUNDA CLASSE COM 5 METROS DE CABO. COM SAÍDA RS485 E PROTOCOLO MODBUS.",
    humanLabel: "must_include",
    humanJustificationPt: "Continuação da mesma descrição de instrumentação.",
    h3Decision: "must_exclude",
    h3bDecision: "must_exclude",
  },
  {
    sampleId: "R12",
    realPageNumber: 48,
    lineKey: "0f69e3e67320361402ab69cb03a81396efb38cecbe20f4918fb15b33025e73ed",
    locationText: "DE 1,10 X 1,10 M COM DOBRADIÇAS QUE PERMITAM SUA ABERTURA PARA ACESSO E RETIRADA DO STOP LOG.",
    humanLabel: "must_include",
    humanJustificationPt: "Continuação de descrição de comporta/stop-log.",
    // CORREÇÃO (commit docs corretivo): o relatório original desta Sprint afirmava
    // simultaneamente "H3 não avaliou" e "H3 decidiu must_exclude" para esta amostra —
    // inconsistência identificada em revisão externa. O valor real, extraído
    // diretamente do JSON de diagnóstico salvo, é H3=must_include (acerto) e
    // H3b=must_exclude (falso negativo introduzido por H3b, não por H3).
    h3Decision: "must_include",
    h3bDecision: "must_exclude",
  },
  {
    sampleId: "R13",
    realPageNumber: 46,
    lineKey: "28851b1e690af5d2dda7d77835e6693bef1dec6cf4eb6aa23709164c4fe2ac72",
    locationText: "COL. FGV DESCRIÇÃO ITEM FONTE DE PESQUISA TIPO UNID QUANT. CUSTO PREÇO FINAL",
    humanLabel: "must_exclude",
    humanJustificationPt: "Cabeçalho de página, repetido a cada página, fora da grade de dados.",
    h3Decision: "insufficient_evidence",
    h3bDecision: "insufficient_evidence",
  },
  {
    sampleId: "R14",
    realPageNumber: 54,
    lineKey: "a777e1a0d0470837499c74ba08ae403bce33894d6292d33451d615e07610e81c",
    locationText: "TOTAL GERAL (R$) 9.809.087,18",
    humanLabel: "uncertain",
    humanJustificationPt:
      "Linha de total geral do orçamento — pertence à mesma área física da tabela, mas semanticamente é um total, não um item; nenhuma capacidade desta Sprint distingue 'total' fisicamente de 'item'.",
    h3Decision: "insufficient_evidence",
    h3bDecision: "insufficient_evidence",
  },
];

/**
 * Classificação determinística do resultado de uma candidata para uma
 * amostra — nunca atribuída manualmente linha a linha (essa era
 * precisamente a fonte do erro corrigido nesta Sprint: a inconsistência
 * do item 12/R12 só existiu porque o valor tinha sido transcrito à mão
 * para uma tabela Markdown em vez de calculado a partir do dado bruto).
 */
export function classifyRealSampleOutcome(humanLabel: RealSampleHumanLabel, decision: RealSampleCandidateDecision): RealSampleOutcome {
  if (humanLabel === "uncertain") {
    return "incerto";
  }
  if (decision === "insufficient_evidence") {
    return "evidencia_insuficiente";
  }
  if (decision === humanLabel) {
    return "acerto";
  }
  if (humanLabel === "must_include" && decision === "must_exclude") {
    return "falso_negativo";
  }
  if (humanLabel === "must_exclude" && decision === "must_include") {
    return "falso_positivo";
  }
  return "nao_avaliado";
}

export interface RealSampleOutcomeTotals {
  readonly acerto: number;
  readonly falso_positivo: number;
  readonly falso_negativo: number;
  readonly evidencia_insuficiente: number;
  readonly nao_avaliado: number;
  readonly incerto: number;
  readonly total: number;
}

function emptyTotals(): { acerto: number; falso_positivo: number; falso_negativo: number; evidencia_insuficiente: number; nao_avaliado: number; incerto: number } {
  return { acerto: 0, falso_positivo: 0, falso_negativo: 0, evidencia_insuficiente: 0, nao_avaliado: 0, incerto: 0 };
}

export function computeRealSampleOutcomeTotals(candidate: "h3Decision" | "h3bDecision"): RealSampleOutcomeTotals {
  const totals = emptyTotals();
  REAL_SAMPLE_MANIFEST.forEach((sample) => {
    const outcome = classifyRealSampleOutcome(sample.humanLabel, sample[candidate]);
    totals[outcome] += 1;
  });
  return { ...totals, total: REAL_SAMPLE_MANIFEST.length };
}

/** Quantidade de amostras com rótulo humano definitivo (`must_include`/`must_exclude`) — exclui `uncertain`. Usado para relatar a base de comparação correta (a Sprint original relatou incorretamente 11; o valor correto é 13). */
export function countDefinitiveHumanLabels(): number {
  return REAL_SAMPLE_MANIFEST.filter((s) => s.humanLabel !== "uncertain").length;
}
