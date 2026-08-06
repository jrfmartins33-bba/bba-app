/**
 * Classificação de viabilidade congelada (§10 do protocolo, Momento
 * 3A). Tabela de decisão pura — classifica apenas a ferramenta como
 * fonte de evidência diagnóstica, nunca uma decisão produtiva.
 */

import type { LocalReaderViabilityGateInputs, LocalReaderViabilityResult } from "./discovery-local-reader-evaluation.types";

export function classifyLocalReaderViability(inputs: LocalReaderViabilityGateInputs): LocalReaderViabilityResult {
  const notViableReasonsPt: string[] = [];
  if (inputs.failedOnAnyPage) notViableReasonsPt.push("Falhou em ao menos uma das três páginas.");
  if (inputs.inventedMonetaryValue) notViableReasonsPt.push("Inventou valor monetário não presente na fonte.");
  if (!inputs.providedPhysicalOriginForCriticalFields) notViableReasonsPt.push("Não forneceu origem física utilizável para os campos críticos.");
  if (!inputs.producedUsableTableCellStructure) notViableReasonsPt.push("Não produziu estrutura utilizável de tabela/célula.");
  if (inputs.requiredNetworkOrExternalService) notViableReasonsPt.push("Exigiu rede ou serviço externo.");
  if (inputs.impedingInstability) notViableReasonsPt.push("Apresentou instabilidade impeditiva.");

  if (notViableReasonsPt.length > 0) {
    return { classification: "nao_viavel_nesta_configuracao", reasonsPt: notViableReasonsPt };
  }

  const mainGateReasonsPt: string[] = [];
  const mainGatePassed =
    inputs.processedAllThreePages &&
    !inputs.inventedMonetaryValue &&
    inputs.providedPhysicalOriginForCriticalFields &&
    inputs.recoveredRequiredFieldsOf80Items &&
    !inputs.incorporatedTcuNoteAsItemOrValue &&
    inputs.producedUsableTableCellStructure &&
    inputs.ranOffline &&
    inputs.reproducibleConfiguration;

  if (mainGatePassed) {
    mainGateReasonsPt.push(
      "Processou as três páginas, não inventou valor monetário, forneceu origem física para os campos críticos, recuperou os campos necessários dos 80 itens, não incorporou a nota do TCU como item ou valor, produziu estrutura utilizável de tabela/célula, executou offline e manteve configuração reproduzível.",
    );
    return { classification: "candidato_principal", reasonsPt: mainGateReasonsPt };
  }

  if (inputs.providedRelevantTraceableComplementaryEvidence) {
    return {
      classification: "candidato_complementar",
      reasonsPt: ["Não cumpriu integralmente o portão principal, mas forneceu evidência adicional relevante e rastreável que complementa o outro leitor."],
    };
  }

  return {
    classification: "nao_viavel_nesta_configuracao",
    reasonsPt: ["Não cumpriu o portão principal e não forneceu evidência complementar relevante e rastreável."],
  };
}
