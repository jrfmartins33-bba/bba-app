/**
 * Menor representação exata necessária para preservar centavos em BRL nesta
 * primeira fatia (ADR-004: regra definitiva de arredondamento/precisão
 * permanece aberta para a Sprint 21.5A). Nenhuma biblioteca de precisão
 * decimal existe hoje no repositório (`ContractValue.amount` é `number`
 * puro) — em vez de introduzir uma dependência nova, valores confirmados
 * são representados como um inteiro de centavos, o que garante soma exata
 * sem erro de ponto flutuante e reproduz `R$ 9.809.087,18` com precisão
 * bit-a-bit. Não decide a representação monetária de Sprints futuras.
 */
export type MoneyCents = number;

const CENTS_PER_REAL = 100;

export function reaisToCents(reais: number): MoneyCents {
  return Math.round(reais * CENTS_PER_REAL);
}

export function centsToReais(cents: MoneyCents): number {
  return cents / CENTS_PER_REAL;
}

export function sumCents(values: ReadonlyArray<MoneyCents>): MoneyCents {
  return values.reduce((total, value) => total + value, 0);
}

export function isValidMoneyCents(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
