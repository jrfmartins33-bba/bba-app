/**
 * Internal-only helpers shared across this domain's modules
 * (measurement-calculation, measurement-formula-catalog). Not exported
 * from `index.ts` — these are implementation details, not part of the
 * domain's public surface.
 *
 * Extracted during the Sprint 13.2 (Measurement Formula Catalog) work:
 * the same clone-then-freeze algorithm and blank-string check that
 * `measurement-calculation.ts` already defined locally would otherwise
 * have been duplicated a second time for the new catalog module.
 * Centralizing them here changes neither behavior nor any public
 * interface (neither function was ever exported from
 * `measurement-calculation.ts`). Mirrors the same internal extraction
 * already used by another domain in this codebase that grew past a
 * single implementation file.
 */
export function freezeDomainObject<T>(value: T): T {
  return freezeClonedDomainObject(cloneDomainValue(value));
}

export function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

type FreezableRecord = Record<PropertyKey, unknown>;

function cloneDomainValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDomainValue(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, property]) => [
      key,
      cloneDomainValue(property),
    ]),
  ) as T;
}

function freezeClonedDomainObject<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.values(value as FreezableRecord).forEach((property) => {
    freezeClonedDomainObject(property);
  });

  return Object.freeze(value);
}
