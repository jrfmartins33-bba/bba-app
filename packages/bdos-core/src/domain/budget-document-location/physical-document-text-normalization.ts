/**
 * Normalização textual determinística e mínima da página, a partir dos
 * textos originais dos itens extraídos, na ordem estável em que foram
 * fornecidos. Independente de conteúdo econômico e de qualquer biblioteca
 * concreta — esta função não conhece nenhuma biblioteca de extração de PDF.
 * Regra exata, nesta ordem, aplicada a cada item individualmente antes da
 * junção final:
 *
 * 1. Quebras de linha `\r\n` e `\r` dentro do texto do item são
 *    normalizadas para `\n`.
 * 2. Sequências consecutivas de espaço e tabulação (não quebra de linha)
 *    são consolidadas em um único espaço.
 * 3. Espaços finais (no fim do texto do item, após os passos 1-2) são
 *    removidos.
 *
 * Os itens já processados são então unidos com `\n`, um item por linha —
 * uma regra estrutural fixa (limite de item = limite de linha na saída
 * normalizada), não uma tentativa de reconstruir a linha visual real do
 * documento a partir de coordenadas, alinhamento ou tamanho de fonte, o
 * que esta função nunca recebe como entrada.
 *
 * Não corrige palavras, não reconstrói colunas, não interpreta tabela,
 * não altera números ou separadores decimais, não infere cabeçalhos.
 * Texto original e texto normalizado permanecem sempre distintos: esta
 * função nunca é usada para substituir `PhysicalDocumentTextItem.text`.
 */
export function normalizePageText(itemTexts: ReadonlyArray<string>): string {
  return itemTexts.map(normalizeSingleItemText).join("\n");
}

function normalizeSingleItemText(text: string): string {
  const withNormalizedLineBreaks = text.replace(/\r\n|\r/g, "\n");
  const withConsolidatedSpacing = withNormalizedLineBreaks.replace(/[ \t]+/g, " ");
  return withConsolidatedSpacing.replace(/[ \t]+$/g, "");
}
