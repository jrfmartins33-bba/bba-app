import type { ExactRational } from "./budget-table-reconstruction.types";

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let currentLeft = left < 0n ? -left : left;
  let currentRight = right < 0n ? -right : right;
  while (currentRight !== 0n) {
    const remainder = currentLeft % currentRight;
    currentLeft = currentRight;
    currentRight = remainder;
  }
  return currentLeft === 0n ? 1n : currentLeft;
}

export function rational(numerator: bigint, denominator: bigint): ExactRational {
  if (denominator === 0n) {
    throw new RangeError("Exact rational denominator is zero.");
  }
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = greatestCommonDivisor(numerator, denominator);
  return {
    numerator: ((numerator / divisor) * sign).toString(),
    denominator: ((denominator / divisor) * sign).toString(),
  };
}

export function addExact(left: ExactRational, right: ExactRational): ExactRational {
  return rational(
    BigInt(left.numerator) * BigInt(right.denominator) +
      BigInt(right.numerator) * BigInt(left.denominator),
    BigInt(left.denominator) * BigInt(right.denominator),
  );
}

export function multiplyExact(
  left: ExactRational,
  right: ExactRational,
): ExactRational {
  return rational(
    BigInt(left.numerator) * BigInt(right.numerator),
    BigInt(left.denominator) * BigInt(right.denominator),
  );
}

export function divideExact(left: ExactRational, right: ExactRational): ExactRational {
  return rational(
    BigInt(left.numerator) * BigInt(right.denominator),
    BigInt(left.denominator) * BigInt(right.numerator),
  );
}

export function equalExact(left: ExactRational, right: ExactRational): boolean {
  return (
    left.numerator === right.numerator && left.denominator === right.denominator
  );
}

export function exactFraction(
  present: number,
  applicable: number,
): ExactRational | null {
  return applicable === 0 ? null : rational(BigInt(present), BigInt(applicable));
}
