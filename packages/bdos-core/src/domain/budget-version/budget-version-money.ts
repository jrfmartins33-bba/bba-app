/**
 * Menor representação exata necessária para preservar centavos em BRL nesta
 * primeira fatia (ADR-004: regra definitiva de arredondamento/precisão
 * permanece aberta para a Sprint 21.5A). Nenhuma biblioteca de precisão
 * decimal existe hoje no repositório (`ContractValue.amount` é `number`
 * puro) — em vez de introduzir uma dependência nova, valores confirmados
 * são representados como um inteiro de centavos.
 *
 * Nenhuma conversão nesta Sprint arredonda silenciosamente: valores com
 * mais de duas casas decimais, `NaN`, infinito ou negativos são rejeitados
 * (lançam erro), nunca aproximados.
 */
export type MoneyCents = number;

const EXACT_DECIMAL_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Converte um texto decimal exato, com no máximo duas casas decimais (ex.:
 * "9809087.18", "100", "3.5"), em centavos inteiros. Nunca arredonda —
 * rejeita valores negativos, mais de duas casas decimais, ou qualquer
 * texto que não seja um decimal não negativo limpo.
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
  return Number(wholePart) * 100 + Number(fractionPart);
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

/** Aceita um valor de centavos inteiros já confirmado, validando-o estritamente. */
export function centsFromInteger(cents: number): MoneyCents {
  if (!isValidMoneyCents(cents)) {
    throw new RangeError(`Invalid integer cents value: ${cents}. Expected a non-negative integer, never NaN, infinite, or fractional.`);
  }
  return cents;
}

export function centsToReais(cents: MoneyCents): number {
  return cents / 100;
}

export function sumCents(values: ReadonlyArray<MoneyCents>): MoneyCents {
  return values.reduce((total, value) => total + value, 0);
}

export function isValidMoneyCents(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
