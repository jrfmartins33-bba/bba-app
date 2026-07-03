/**
 * Internal-only helpers shared across this domain's modules
 * (official-template-engine, official-template-validation,
 * official-template-catalog, official-template-composition,
 * official-template-library). Not exported from `index.ts` — these are
 * implementation details, not part of the domain's public surface.
 *
 * Extracted during the Sprint 11.5.6 architectural audit: the exact same
 * clone-then-freeze algorithm and blank-string check were independently
 * duplicated verbatim in all five files. Centralizing them here changes
 * neither behavior nor any public interface (none of these functions
 * were ever exported by the files that used to define them locally).
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
