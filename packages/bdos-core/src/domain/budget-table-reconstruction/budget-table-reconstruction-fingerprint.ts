import { createHash } from "node:crypto";

export interface CanonicalWritable {
  write(chunk: string): boolean;
  once(event: "drain", listener: () => void): unknown;
}

export interface CanonicalProjectionOptions {
  readonly omitCanonicalFingerprint?: boolean;
  readonly omitRuntimeReferences?: boolean;
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function shouldOmitProperty(key: string, options: CanonicalProjectionOptions): boolean {
  if (options.omitCanonicalFingerprint === true && key === "canonicalFingerprint") {
    return true;
  }
  return options.omitRuntimeReferences === true && key === "runtimeReference";
}

export function* canonicalChunks(
  value: unknown,
  options: CanonicalProjectionOptions = {},
): Generator<string> {
  if (value === null) {
    yield "null";
    return;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    yield JSON.stringify(value);
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical serialization rejects non-finite numbers.");
    }
    yield JSON.stringify(value);
    return;
  }

  if (Array.isArray(value)) {
    yield "[";
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) {
        yield ",";
      }
      yield* canonicalChunks(value[index], options);
    }
    yield "]";
    return;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !shouldOmitProperty(key, options))
      .sort(([left], [right]) => ordinalCompare(left, right));

    yield "{";
    for (let index = 0; index < entries.length; index += 1) {
      if (index > 0) {
        yield ",";
      }
      const [key, child] = entries[index]!;
      yield JSON.stringify(key);
      yield ":";
      yield* canonicalChunks(child, options);
    }
    yield "}";
    return;
  }

  throw new TypeError(`Canonical serialization does not support ${typeof value}.`);
}

export function fingerprintCanonical(value: unknown): string {
  const hash = createHash("sha256");
  for (const chunk of canonicalChunks(value, {
    omitCanonicalFingerprint: true,
    omitRuntimeReferences: true,
  })) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

function waitForDrain(writable: CanonicalWritable): Promise<void> {
  return new Promise((resolve) => {
    writable.once("drain", resolve);
  });
}

export async function writeCanonicalValue(
  value: unknown,
  writable: CanonicalWritable,
  options: CanonicalProjectionOptions = {},
): Promise<void> {
  for (const chunk of canonicalChunks(value, options)) {
    if (!writable.write(chunk)) {
      await waitForDrain(writable);
    }
  }
}
