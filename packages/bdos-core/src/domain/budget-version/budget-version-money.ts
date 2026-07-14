/**
 * Menor representação exata necessária para preservar centavos em BRL nesta
 * primeira fatia (ADR-004: regra definitiva de arredondamento/precisão
 * permanece aberta para a Sprint 21.5A). Nenhuma biblioteca de precisão
 * decimal existe hoje no repositório (`ContractValue.amount` é `number`
 * puro) — em vez de introduzir uma dependência nova, valores confirmados
 * são representados como um inteiro de centavos, formalmente limitado ao
 * intervalo seguro do JavaScript (`Number.isSafeInteger`).
 *
 * Nenhuma conversão nesta Sprint arredonda silenciosamente: valores com
 * mais de duas casas decimais, `NaN`, infinito, negativos, fracionários ou
 * fora do intervalo seguro são rejeitados (lançam erro), nunca
 * aproximados ou truncados.
 */
export type MoneyCents = number;

const EXACT_DECIMAL_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Converte um texto decimal exato, com no máximo duas casas decimais (ex.:
 * "9809087.18", "100", "3.5"), em centavos inteiros. Nunca arredonda —
 * rejeita valores negativos, mais de duas casas decimais, ou qualquer
 * texto que não seja um decimal não negativo limpo. O resultado é validado
 * como inteiro seguro antes de ser retornado.
 */
export function centsFromDecimalString(decimal: string): MoneyCents {
  const trimmed = decimal.trim();
  const match = EXACT_DECIMAL_PATTERN.exec(trimmed);

  if (match === null) {
    throw new RangeError(
      `Invalid exact decimal money value "${decimal}": expected a non-negative decimal with at most two decimal places, never silently rounded.`,
    );
  }

  const wholePart = match[1];
  const fractionPart = (match[2] ?? "").padEnd(2, "0");
  const cents = Number(wholePart) * 100 + Number(fractionPart);

  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(
      `Exact decimal money value "${decimal}" converts to ${cents} cents, outside the safe integer range (±${Number.MAX_SAFE_INTEGER}).`,
    );
  }

  return cents;
}

/**
 * Converte um `number` que representa um valor econômico exato (no máximo
 * duas casas decimais) em centavos inteiros, revertendo-o para seu texto
 * decimal canônico — nunca via `Math.round`. Um valor com mais de duas
 * casas decimais (incluindo ruído de ponto flutuante que não se resolve
 * para um texto limpo de até duas casas) é rejeitado, nunca arredondado.
 */
export function centsFromExactReais(reais: number): MoneyCents {
  if (!Number.isFinite(reais)) {
    throw new RangeError(`Invalid money value: ${reais} is not finite.`);
  }
  return centsFromDecimalString(reais.toString());
}

/** Aceita um valor de centavos inteiros já confirmado, validando-o estritamente (inteiro seguro, não negativo). */
export function centsFromInteger(cents: number): MoneyCents {
  if (!isValidMoneyCents(cents)) {
    throw new RangeError(
      `Invalid integer cents value: ${cents}. Expected a non-negative safe integer, never NaN, infinite, or fractional.`,
    );
  }
  return cents;
}

/**
 * Conversão de **apresentação apenas** — não é memória econômica exata e
 * não deve ser usada para conferir a fixture oficial nem qualquer total
 * calculado (a conferência sempre compara centavos inteiros diretamente).
 */
export function centsToReais(cents: MoneyCents): number {
  return cents / 100;
}

/**
 * Soma centavos inteiros com validação estrita: cada parcela precisa ser
 * um centavo válido (inteiro seguro, não negativo), e o acumulado, a cada
 * passo, precisa permanecer dentro do intervalo seguro — nunca estoura
 * silenciosamente.
 */
export function sumCents(values: ReadonlyArray<MoneyCents>): MoneyCents {
  return values.reduce((total, value) => {
    if (!isValidMoneyCents(value)) {
      throw new RangeError(`Invalid money value in sum: ${value}. Expected a non-negative safe integer.`);
    }

    const next = total + value;

    if (!Number.isSafeInteger(next)) {
      throw new RangeError(`Sum of money values exceeds the safe integer range at partial sum ${next}.`);
    }

    return next;
  }, 0);
}

export function isValidMoneyCents(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
