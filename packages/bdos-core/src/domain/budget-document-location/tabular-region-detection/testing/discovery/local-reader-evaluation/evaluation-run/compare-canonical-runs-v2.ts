/**
 * Sprint 21.4B.3A.3 — fechamento consolidado. Comparação semântica entre
 * dois diretórios de execução independentes (A e B) do avaliador v2 —
 * diferença apenas na ordem de chaves JSON nunca conta como divergência;
 * diferença de valor, estrutura, quantidade ou classificação sempre
 * conta.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeysDeep(v)]));
  }
  return value;
}

export interface RunRepetitionFileComparisonV2 {
  readonly file: string;
  readonly presentInA: boolean;
  readonly presentInB: boolean;
  readonly semanticallyEqual: boolean;
  readonly differenceSummary: string | null;
}

export interface RunRepetitionValidationV2 {
  readonly files: ReadonlyArray<RunRepetitionFileComparisonV2>;
  readonly identical: boolean;
}

export function compareCanonicalRunDirectories(dirA: string, dirB: string): RunRepetitionValidationV2 {
  const filesA = new Set(readdirSync(dirA).filter((f) => f.endsWith(".json")));
  const filesB = new Set(readdirSync(dirB).filter((f) => f.endsWith(".json")));
  const allFiles = [...new Set([...filesA, ...filesB])].sort();

  const files: RunRepetitionFileComparisonV2[] = allFiles.map((file) => {
    const presentInA = filesA.has(file);
    const presentInB = filesB.has(file);

    if (!presentInA || !presentInB) {
      return { file, presentInA, presentInB, semanticallyEqual: false, differenceSummary: !presentInA ? "arquivo ausente na execução A" : "arquivo ausente na execução B" };
    }

    const contentA = JSON.parse(readFileSync(join(dirA, file), "utf8"));
    const contentB = JSON.parse(readFileSync(join(dirB, file), "utf8"));
    const canonicalA = JSON.stringify(sortKeysDeep(contentA));
    const canonicalB = JSON.stringify(sortKeysDeep(contentB));
    const semanticallyEqual = canonicalA === canonicalB;

    return {
      file,
      presentInA,
      presentInB,
      semanticallyEqual,
      differenceSummary: semanticallyEqual ? null : "JSON canônico (chaves ordenadas) diverge entre A e B — diferença real de valor/estrutura/classificação, não apenas ordem de chaves",
    };
  });

  const identical = files.length > 0 && files.every((f) => f.semanticallyEqual);
  return { files, identical };
}
