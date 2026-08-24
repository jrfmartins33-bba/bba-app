import { MeasurementCycleStatus } from "../measurement-workflow";
import type {
  BuildCertifiedMeasurementItemAggregateInput,
  CanonicalMeasurementDecimal,
  CertifiedMeasurementItemAggregate,
  MeasurementDecimalInput,
  MeasurementMonetaryPolicy,
  MeasurementProjectAuthority,
  MeasurementProjectAuthorityInput,
  MeasurementSourceDecimal,
  MeasurementWorkspaceLineCardinalityValidation,
  MeasurementWorkspaceLineIdentity,
  MeasurementWorkspaceLineScopeInput,
  MeasurementWorkspaceLineScopeValidation,
} from "./measurement-certification.types";
import { MeasurementDecimalQuantizationMode } from "./measurement-certification.types";

interface ParsedDecimal {
  readonly coefficient: bigint;
  readonly scale: number;
}

export function createMeasurementMonetaryPolicy(
  policy: MeasurementMonetaryPolicy,
): MeasurementMonetaryPolicy {
  assertNonBlank(policy.key, "policy.key");
  assertScale(policy.scale);

  return Object.freeze({ ...policy });
}

export function canonicalizeMeasurementDecimal(
  input: MeasurementDecimalInput,
  scale: number,
  quantizationMode = MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero,
): CanonicalMeasurementDecimal {
  assertScale(scale);
  return formatDecimal(quantizeDecimal(parseDecimal(input), scale, quantizationMode));
}

export function preserveMeasurementSourceDecimal(
  input: MeasurementDecimalInput,
  scale: number,
  quantizationMode = MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero,
): MeasurementSourceDecimal {
  return Object.freeze({
    raw: String(input),
    canonical: canonicalizeMeasurementDecimal(input, scale, quantizationMode),
    scale,
  });
}

export function calculateMeasurementLineValue(input: {
  readonly quantity: MeasurementDecimalInput;
  readonly unitValue: MeasurementDecimalInput;
  readonly policy: MeasurementMonetaryPolicy;
}): CanonicalMeasurementDecimal {
  const quantity = parseDecimal(input.quantity);
  const unitValue = parseDecimal(input.unitValue);
  const exactProduct: ParsedDecimal = {
    coefficient: quantity.coefficient * unitValue.coefficient,
    scale: quantity.scale + unitValue.scale,
  };

  return formatDecimal(
    quantizeDecimal(
      exactProduct,
      input.policy.scale,
      input.policy.quantizationMode,
    ),
  );
}

export function addMeasurementDecimals(
  values: ReadonlyArray<MeasurementDecimalInput>,
  scale: number,
): CanonicalMeasurementDecimal {
  assertScale(scale);
  const coefficient = values.reduce<bigint>(
    (sum, value) =>
      sum +
      quantizeDecimal(
        parseDecimal(value),
        scale,
        MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero,
      ).coefficient,
    0n,
  );

  return formatDecimal({ coefficient, scale });
}

export function subtractMeasurementDecimals(
  minuend: MeasurementDecimalInput,
  subtrahend: MeasurementDecimalInput,
  scale: number,
): CanonicalMeasurementDecimal {
  const left = quantizeDecimal(
    parseDecimal(minuend),
    scale,
    MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero,
  );
  const right = quantizeDecimal(
    parseDecimal(subtrahend),
    scale,
    MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero,
  );

  return formatDecimal({ coefficient: left.coefficient - right.coefficient, scale });
}

export function isMeasurementDecimalWithinTolerance(
  value: MeasurementDecimalInput,
  tolerance: MeasurementDecimalInput,
  scale: number,
): boolean {
  const candidate = quantizeDecimal(
    parseDecimal(value),
    scale,
    MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero,
  ).coefficient;
  const limit = quantizeDecimal(
    parseDecimal(tolerance),
    scale,
    MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero,
  ).coefficient;

  return absolute(candidate) <= absolute(limit);
}

export function validateMeasurementWorkspaceLineScope(
  input: MeasurementWorkspaceLineScopeInput,
): MeasurementWorkspaceLineScopeValidation {
  const errors: MeasurementWorkspaceLineScopeValidation["errors"][number][] = [];

  if (input.workspace.organizationId !== input.operationalItem.organizationId) {
    errors.push("organization_mismatch");
  }

  if (input.workspace.projectId !== input.operationalItem.projectId) {
    errors.push("project_mismatch");
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateMeasurementWorkspaceLineCardinality(
  lines: ReadonlyArray<MeasurementWorkspaceLineIdentity>,
): MeasurementWorkspaceLineCardinalityValidation {
  const seen = new Set<string>();
  const duplicateKeys = new Set<string>();
  const duplicatePairs: MeasurementWorkspaceLineIdentity[] = [];

  for (const line of lines) {
    const key = `${line.workspaceId}\u0000${line.operationalItemId}`;
    if (!seen.has(key)) {
      seen.add(key);
      continue;
    }

    if (!duplicateKeys.has(key)) {
      duplicateKeys.add(key);
      duplicatePairs.push(Object.freeze({ ...line }));
    }
  }

  return Object.freeze({
    valid: duplicatePairs.length === 0,
    duplicatePairs: Object.freeze(duplicatePairs),
  });
}

export function resolveMeasurementProjectAuthority(
  input: MeasurementProjectAuthorityInput,
): MeasurementProjectAuthority {
  assertNonBlank(input.relationalProjectId, "relationalProjectId");
  const legacyEvidenceProjectId = input.legacyEvidenceProjectId?.trim() || null;

  return Object.freeze({
    projectId: input.relationalProjectId,
    legacyEvidenceProjectId,
    provenanceMismatch:
      legacyEvidenceProjectId !== null &&
      legacyEvidenceProjectId !== input.relationalProjectId,
  });
}

export function isOfficialMeasurementCycleStatus(
  status: MeasurementCycleStatus | null,
): boolean {
  return (
    status === MeasurementCycleStatus.Certified ||
    status === MeasurementCycleStatus.Closed
  );
}

export function buildCertifiedMeasurementItemAggregate(
  input: BuildCertifiedMeasurementItemAggregateInput,
): CertifiedMeasurementItemAggregate {
  const contractQuantity = canonicalizeMeasurementDecimal(
    input.contractQuantity,
    input.quantityScale,
  );
  const contractedValue = canonicalizeMeasurementDecimal(
    input.contractedValue,
    input.moneyScale,
  );
  const periodContributions = input.contributions.filter(
    (contribution) => contribution.periodId === input.targetPeriodId,
  );
  const officialContributions = input.contributions.filter((contribution) =>
    isOfficialMeasurementCycleStatus(contribution.cycleStatus),
  );
  const officialPeriodContributions = periodContributions.filter((contribution) =>
    isOfficialMeasurementCycleStatus(contribution.cycleStatus),
  );
  const measuredPeriodQuantity = addMeasurementDecimals(
    periodContributions.map((contribution) => contribution.quantity),
    input.quantityScale,
  );
  const certifiedPeriodQuantity = addMeasurementDecimals(
    officialPeriodContributions.map((contribution) => contribution.quantity),
    input.quantityScale,
  );
  const certifiedAccumulatedQuantity = addMeasurementDecimals(
    officialContributions.map((contribution) => contribution.quantity),
    input.quantityScale,
  );
  const certifiedPeriodValue = addMeasurementDecimals(
    officialPeriodContributions.map((contribution) => contribution.value),
    input.moneyScale,
  );
  const certifiedAccumulatedValue = addMeasurementDecimals(
    officialContributions.map((contribution) => contribution.value),
    input.moneyScale,
  );

  return Object.freeze({
    contractQuantity,
    measuredPeriodQuantity,
    certifiedPeriodQuantity,
    certifiedAccumulatedQuantity,
    quantityBalance: subtractMeasurementDecimals(
      contractQuantity,
      certifiedAccumulatedQuantity,
      input.quantityScale,
    ),
    certifiedPeriodValue,
    certifiedAccumulatedValue,
    contractedValue,
    financialBalance: subtractMeasurementDecimals(
      contractedValue,
      certifiedAccumulatedValue,
      input.moneyScale,
    ),
  });
}

function parseDecimal(input: MeasurementDecimalInput): ParsedDecimal {
  if (typeof input === "number" && !Number.isFinite(input)) {
    throw new Error("Measurement decimal must be finite.");
  }

  const raw = String(input).trim();
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!match || ((match[2] ?? "").length === 0 && (match[3] ?? "").length === 0)) {
    throw new Error(`Invalid measurement decimal: ${raw}`);
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const integerDigits = match[2] || "0";
  const fractionalDigits = match[3] ?? "";
  const exponent = Number.parseInt(match[4] ?? "0", 10);
  const digits = `${integerDigits}${fractionalDigits}`.replace(/^0+(?=\d)/, "") || "0";
  let coefficient = BigInt(digits) * sign;
  let scale = fractionalDigits.length - exponent;

  if (scale < 0) {
    coefficient *= powerOfTen(-scale);
    scale = 0;
  }

  return { coefficient, scale };
}

function quantizeDecimal(
  decimal: ParsedDecimal,
  targetScale: number,
  quantizationMode: MeasurementDecimalQuantizationMode,
): ParsedDecimal {
  assertScale(targetScale);

  if (decimal.scale === targetScale) {
    return decimal;
  }

  if (decimal.scale < targetScale) {
    return {
      coefficient: decimal.coefficient * powerOfTen(targetScale - decimal.scale),
      scale: targetScale,
    };
  }

  const divisor = powerOfTen(decimal.scale - targetScale);
  let coefficient = decimal.coefficient / divisor;

  if (quantizationMode === MeasurementDecimalQuantizationMode.RoundHalfAwayFromZero) {
    const remainder = absolute(decimal.coefficient % divisor);
    if (remainder * 2n >= divisor) {
      coefficient += decimal.coefficient < 0n ? -1n : 1n;
    }
  }

  return { coefficient, scale: targetScale };
}

function formatDecimal(decimal: ParsedDecimal): CanonicalMeasurementDecimal {
  const negative = decimal.coefficient < 0n;
  const digits = absolute(decimal.coefficient).toString().padStart(decimal.scale + 1, "0");
  const value =
    decimal.scale === 0
      ? digits
      : `${digits.slice(0, -decimal.scale)}.${digits.slice(-decimal.scale)}`;

  return `${negative && decimal.coefficient !== 0n ? "-" : ""}${value}` as CanonicalMeasurementDecimal;
}

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function assertScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) {
    throw new Error("Measurement decimal scale must be an integer between 0 and 18.");
  }
}

function assertNonBlank(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${field} must not be blank.`);
  }
}
