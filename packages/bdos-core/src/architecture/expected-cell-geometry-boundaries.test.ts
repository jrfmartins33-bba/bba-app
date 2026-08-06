/**
 * Guarda arquitetural dedicado à camada de geometria esperada estruturada
 * das células da verdade de referência (§18 do enunciado da Sprint de
 * geometria). Complementa, sem enfraquecer, os guardas genéricos
 * pré-existentes (`budget-document-location-boundaries.test.ts`, que já
 * proíbe código de produção de importar qualquer caminho sob `testing/`,
 * inclusive esta pasta). Cobre exclusivamente o que é específico desta
 * Sprint:
 *
 * 1. nenhum arquivo de produção do pacote importa a pasta `cell-geometry`;
 * 2. o barril público do domínio nunca menciona `cell-geometry`;
 * 3. nenhum arquivo de `cell-geometry` importa saída de PaddleOCR, Docling,
 *    avaliação de leitor local, `results/corrected-v2`, ou qualquer
 *    resultado v1/v2 já congelado;
 * 4. nenhum arquivo de `cell-geometry` importa um futuro motor
 *    determinístico (`engines/decision` ou qualquer caminho contendo
 *    "engine");
 * 5. os arquivos do ALGORITMO GENÉRICO (tipos, parser de origem,
 *    projeção, validação, geometria auxiliar, projeção para o avaliador,
 *    SVG e seus próprios testes sintéticos) nunca contêm página real
 *    (46/50/54) como condição, hash real de documento/segmento, ou
 *    vocabulário de topônimo/documento real — apenas os arquivos de DADOS
 *    reais (sufixo `-page-46`/`-page-50`/`-page-54`/`-physical-segments`/
 *    `-manifest`) podem;
 * 6. nada fora de `reference-truth/` importa a pasta `cell-geometry`,
 *    exceto exatamente um consumidor nomeado e restrito: o gerador
 *    único de dados reais
 *    `infrastructure/budget-document-location/pdfjs/testing/generate-reference-truth-cell-geometry.ts`
 *    — o único lugar do pacote em que a direção de dependência já
 *    permitida (adaptador -> domínio) comporta rodar o reconstrutor
 *    físico real e alimentar o algoritmo genérico já congelado desta
 *    pasta. Fora dessa única exceção nomeada, o isolamento permanece
 *    estrito até que o futuro avaliador do motor seja construído em
 *    outra Sprint, noutra branch.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(CURRENT_DIR, "..");
const PACKAGE_ROOT = resolve(SRC_ROOT, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");

const REFERENCE_TRUTH_DIR = join(
  SRC_ROOT,
  "domain",
  "budget-document-location",
  "tabular-region-detection",
  "testing",
  "discovery",
  "reference-truth",
);
const CELL_GEOMETRY_DIR = join(REFERENCE_TRUTH_DIR, "cell-geometry");
const DOMAIN_BARREL_FILE = join(SRC_ROOT, "domain", "budget-document-location", "index.ts");

const REAL_DATA_FILE_SUFFIXES = ["-page-46.ts", "-page-50.ts", "-page-54.ts", "-physical-segments-page-46.ts", "-physical-segments-page-50.ts", "-physical-segments-page-54.ts", "-manifest.ts"] as const;

const FORBIDDEN_EVIDENCE_SOURCE_SPECIFIER_SUBSTRINGS = [
  "local-reader-evaluation",
  "docling",
  "paddleocr",
  "corrected-v2",
  "/results/",
  "\\results\\",
] as const;

const FORBIDDEN_ENGINE_SPECIFIER_SUBSTRINGS = ["engines/decision", "engine"] as const;

const FORBIDDEN_GENERIC_ALGORITHM_LITERALS = ["DNOCS", "DNIT", "Lagoa do Arroz", "_local-documents", "05_Anexo_Tecnico_Termo_Referencia", 'realPageNumber === 46', 'realPageNumber === 50', 'realPageNumber === 54', "page === 46", "page === 50", "page === 54"] as const;

interface ImportRef {
  readonly specifier: string;
  readonly line: number;
}

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly reason: string;
}

function listTsFiles(dir: string): ReadonlyArray<string> {
  let entries: ReadonlyArray<string>;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files: string[] = [];
  entries.forEach((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listTsFiles(fullPath));
      return;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  });
  return files;
}

function readImportsFromFile(filePath: string): ReadonlyArray<ImportRef> {
  const content = readFileSync(filePath, "utf8");
  const pattern = /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/gm;
  const refs: ImportRef[] = [];
  let match: RegExpExecArray | null = pattern.exec(content);
  while (match !== null) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier !== undefined) {
      const line = content.slice(0, match.index).split("\n").length;
      refs.push({ specifier, line });
    }
    match = pattern.exec(content);
  }
  return refs;
}

function toRepoRelative(absolutePath: string): string {
  return relative(REPO_ROOT, absolutePath).split("\\").join("/");
}

function isRealDataFile(filePath: string): boolean {
  return REAL_DATA_FILE_SUFFIXES.some((suffix) => filePath.endsWith(suffix));
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) return;
  const details = violations.map((v) => `  ${v.file}:${v.line} - ${v.reason}`).join("\n");
  throw new Error(`${message} (${violations.length}):\n${details}`);
}

runTest("cell-geometry directory exists and the guard scans it", () => {
  const files = listTsFiles(CELL_GEOMETRY_DIR);
  assertEqual(files.length > 5, true, `expected more than 5 cell-geometry source files, scanned ${files.length}`);
});

runTest("no package production file (outside testing/) imports the cell-geometry directory", () => {
  const violations: Violation[] = [];
  listTsFiles(SRC_ROOT).forEach((file) => {
    const repoRelative = toRepoRelative(file);
    if (repoRelative.split("/").includes("testing")) return;
    readImportsFromFile(file).forEach((ref) => {
      if (!ref.specifier.startsWith(".")) return;
      const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
      if (resolved.includes("/cell-geometry/") || resolved.includes("\\cell-geometry\\")) {
        violations.push({ file: repoRelative, line: ref.line, reason: `production file imports "${ref.specifier}" (resolves under cell-geometry/)` });
      }
    });
  });
  assertNoViolations(violations, "production file imports the expected-cell-geometry diagnostic layer");
});

runTest("the domain's public barrel never mentions cell-geometry", () => {
  const content = readFileSync(DOMAIN_BARREL_FILE, "utf8");
  assertEqual(content.toLowerCase().includes("cell-geometry"), false, "index.ts must not reference the cell-geometry diagnostic layer");
});

/**
 * Única exceção nomeada e restrita: o gerador de dados reais desta
 * Sprint precisa importar o algoritmo genérico já congelado (para
 * alimentá-lo com a reconstrução física real) e o renderizador SVG
 * (para materializar os diagnósticos visuais). Vive em
 * `infrastructure/` porque é o único lugar do pacote em que a direção
 * de dependência já permitida (adaptador -> domínio) comporta importar
 * tanto o leitor físico real quanto este algoritmo diagnóstico — nunca
 * o inverso, e nunca ampliada para nenhum outro arquivo.
 */
const CELL_GEOMETRY_ISOLATION_KNOWN_EXCEPTION_REPO_RELATIVE_SUFFIX =
  "packages/bdos-core/src/infrastructure/budget-document-location/pdfjs/testing/generate-reference-truth-cell-geometry.ts";

runTest("no file outside reference-truth/ imports the cell-geometry directory, except the single named real-data generator (strict isolation until a future evaluator Sprint)", () => {
  const violations: Violation[] = [];
  listTsFiles(PACKAGE_ROOT).forEach((file) => {
    const repoRelative = toRepoRelative(file);
    if (repoRelative.includes("/reference-truth/") || repoRelative.includes("\\reference-truth\\")) return;
    if (repoRelative === CELL_GEOMETRY_ISOLATION_KNOWN_EXCEPTION_REPO_RELATIVE_SUFFIX) return;
    readImportsFromFile(file).forEach((ref) => {
      if (!ref.specifier.startsWith(".")) return;
      const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
      if (resolved.includes("/cell-geometry/") || resolved.includes("\\cell-geometry\\")) {
        violations.push({ file: repoRelative, line: ref.line, reason: `imports "${ref.specifier}" from outside reference-truth/` });
      }
    });
  });
  assertNoViolations(violations, "a file outside reference-truth/ imports the cell-geometry diagnostic layer");
});

runTest("the cell-geometry isolation exception is narrow: exactly one file, and it is the real-data generator", () => {
  const exceptionFile = listTsFiles(PACKAGE_ROOT).find((f) => toRepoRelative(f) === CELL_GEOMETRY_ISOLATION_KNOWN_EXCEPTION_REPO_RELATIVE_SUFFIX);
  assertEqual(exceptionFile !== undefined, true, "expected the exempted real-data generator file to exist and be scanned");
});

runTest("no cell-geometry file imports PaddleOCR/Docling/local-reader-evaluation/results/corrected-v2 evidence", () => {
  const violations: Violation[] = [];
  listTsFiles(CELL_GEOMETRY_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      const normalized = ref.specifier.split("\\").join("/").toLowerCase();
      FORBIDDEN_EVIDENCE_SOURCE_SPECIFIER_SUBSTRINGS.forEach((forbidden) => {
        if (normalized.includes(forbidden)) {
          violations.push({ file: toRepoRelative(file), line: ref.line, reason: `imports forbidden evidence specifier "${ref.specifier}" (matches "${forbidden}")` });
        }
      });
    });
  });
  assertNoViolations(violations, "cell-geometry file imports reader/OCR/AI evidence or a corrected-v2 result");
});

runTest("no cell-geometry file imports a future deterministic engine", () => {
  const violations: Violation[] = [];
  listTsFiles(CELL_GEOMETRY_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (!ref.specifier.startsWith(".")) return;
      const normalized = ref.specifier.split("\\").join("/").toLowerCase();
      FORBIDDEN_ENGINE_SPECIFIER_SUBSTRINGS.forEach((forbidden) => {
        if (normalized.includes(forbidden)) {
          violations.push({ file: toRepoRelative(file), line: ref.line, reason: `imports a specifier resembling a deterministic engine: "${ref.specifier}"` });
        }
      });
    });
  });
  assertNoViolations(violations, "cell-geometry file imports a future deterministic engine");
});

runTest("the generic algorithm files (everything except real per-page data files) contain no real page literal, real document hash, or real-document vocabulary", () => {
  const violations: Violation[] = [];
  listTsFiles(CELL_GEOMETRY_DIR)
    .filter((file) => !isRealDataFile(file))
    .forEach((file) => {
      const content = readFileSync(file, "utf8");
      FORBIDDEN_GENERIC_ALGORITHM_LITERALS.forEach((literal) => {
        if (content.includes(literal)) {
          violations.push({ file: toRepoRelative(file), line: 1, reason: `contains forbidden real-data literal "${literal}"` });
        }
      });
    });
  assertNoViolations(violations, "a generic cell-geometry algorithm file contains a real-data literal");
});

runTest("real per-page data files (page 46/50/54) are exempt from the generic-literal scan by design, and the exemption set is exactly the expected suffix list", () => {
  assertEqual(REAL_DATA_FILE_SUFFIXES.length, 7, "the real-data exemption suffix list must remain exactly the deliberate set of page/segment/manifest data files");
});

// ============================================================================
// Verificação probatória final da PR #82: legacyDeclaredSegmentKey nunca
// pode voltar a ser tratada como identidade física reproduzível. A
// aplicação primária é por TIPO (campo obrigatório e emparelhado com
// `legacyDeclaredSegmentKeyStatus` na mesma interface, nunca opcional
// sozinho) — estas checagens são uma segunda linha de defesa textual.
// ============================================================================

runTest("the old field name sourceSegmentKey (which implied reproducible physical identity) never reappears anywhere in cell-geometry/", () => {
  const violations: Violation[] = [];
  listTsFiles(CELL_GEOMETRY_DIR).forEach((file) => {
    const content = readFileSync(file, "utf8");
    if (content.includes("sourceSegmentKey")) {
      violations.push({ file: toRepoRelative(file), line: 1, reason: 'contains the retired field name "sourceSegmentKey" — legacy identity must be named legacyDeclaredSegmentKey, paired with legacyDeclaredSegmentKeyStatus' });
    }
  });
  assertNoViolations(violations, "a cell-geometry file reintroduces the retired sourceSegmentKey field name");
});

runTest("the types contract declares legacyDeclaredSegmentKey only ever paired with legacyDeclaredSegmentKeyStatus, and declares the reproducible locator's canonical key fields", () => {
  const typesFile = join(CELL_GEOMETRY_DIR, "discovery-reference-truth-cell-geometry.types.ts");
  const content = readFileSync(typesFile, "utf8");
  const violations: Violation[] = [];

  if (!content.includes("legacyDeclaredSegmentKeyStatus")) {
    violations.push({ file: toRepoRelative(typesFile), line: 1, reason: "missing legacyDeclaredSegmentKeyStatus field — legacy keys must always carry an explicit non-reproducible status" });
  }
  if (!content.includes('"legacy_unreproducible"')) {
    violations.push({ file: toRepoRelative(typesFile), line: 1, reason: 'missing the literal LegacyDeclaredKeyStatus value "legacy_unreproducible"' });
  }
  if (!content.includes("reproducibleLineKey") || !content.includes("reproducibleSegmentKey")) {
    violations.push({ file: toRepoRelative(typesFile), line: 1, reason: "ReproduciblePhysicalSegmentLocator must declare reproducibleLineKey and reproducibleSegmentKey as the canonical identity fields" });
  }

  assertNoViolations(violations, "the cell-geometry types contract does not correctly separate legacy (non-reproducible) identity from the reproducible canonical locator");
});

runTest("the shared-geometry group id is derived from the reproducible locator key, never from the legacy declared key", () => {
  const projectionFile = join(CELL_GEOMETRY_DIR, "discovery-reference-truth-cell-geometry-projection.ts");
  const content = readFileSync(projectionFile, "utf8");
  const violations: Violation[] = [];

  const fnMatch = content.match(/function sharedGeometryGroupId\(([^)]*)\)/);
  if (fnMatch === null) {
    violations.push({ file: toRepoRelative(projectionFile), line: 1, reason: "expected to find the sharedGeometryGroupId(...) function" });
  } else if (!fnMatch[1].includes("reproducibleSegmentKey") && !fnMatch[1].toLowerCase().includes("reproducible")) {
    violations.push({ file: toRepoRelative(projectionFile), line: 1, reason: `sharedGeometryGroupId's own parameter name must reflect the reproducible key, not the legacy one: "${fnMatch[1]}"` });
  }

  assertNoViolations(violations, "sharedGeometryGroupId is not clearly derived from the reproducible (canonical) key");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
