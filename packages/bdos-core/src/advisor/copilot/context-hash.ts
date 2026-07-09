import { createHash } from "node:crypto";

// Decision Copilot (Epic 15, Fase 1) — hash canônico de context_snapshot,
// calculado aqui em TypeScript, nunca no banco (ver Ajuste 3 da revisão
// do CPO em packages/bdos-core/docs/DECISION_COPILOT.md): a ordenação de
// chaves em JSONB não é garantida na serialização de texto do Postgres,
// então dois valores logicamente iguais podem produzir hashes diferentes
// se calculados lá. Aqui, canonicalize() ordena as chaves recursivamente
// antes de serializar, para que o mesmo conteúdo lógico sempre produza o
// mesmo hash, independente da ordem em que as chaves foram inseridas no
// objeto de origem.

export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return result;
  }

  return value;
}

export function computeContextHash(contextSnapshot: unknown): string {
  return createHash("sha256").update(canonicalJsonStringify(contextSnapshot)).digest("hex");
}
