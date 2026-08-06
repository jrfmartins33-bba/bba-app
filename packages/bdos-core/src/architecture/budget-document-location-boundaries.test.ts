import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_SRC_ROOT = resolve(CURRENT_DIR, "..");
const PACKAGE_ROOT = resolve(PACKAGE_SRC_ROOT, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");

const BUDGET_DOCUMENT_LOCATION_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location");

/**
 * Segmento de caminho exato que demarca código diagnóstico (não
 * produtivo) dentro do domínio — ex.
 * `.../tabular-region-detection/testing/discovery/...`. Correspondência
 * é sempre por SEGMENTO INTEIRO do caminho normalizado (`.split("/")`),
 * nunca por substring — um diretório chamado `contest-testing-like-name`
 * nunca é tratado como diagnóstico só porque contém a substring
 * "testing" (ver Momento 3C.2, §3.1, e o teste sintético dedicado
 * abaixo).
 */
const DIAGNOSTIC_PATH_SEGMENT = "testing";

const OTHER_DOMAINS_THAT_MUST_NOT_BE_IMPORTED = [
  "domain/document-processing",
  "services/document-processing",
  "domain/document-reconstruction",
  "domain/budget-version",
  "services/procurement-engineering",
  "infrastructure/budget-document-location",
] as const;

const FORBIDDEN_KEYWORDS = [
  "openai",
  "anthropic",
  "pdf-lib",
  "pdfkit",
  "pdf-parse",
  "pdfjs",
  "pypdf",
  "pdfplumber",
  "tesseract",
  "ocr",
  "supabase",
  "@supabase",
] as const;

const FORBIDDEN_SPECIFIER_KEYWORDS = ["apps/web", "@bba/web"] as const;

/**
 * Exceção nomeada e restrita, adicionada na auditoria do PR #69 (Sprint
 * 21.4A.2.f.1). O portão de compatibilidade exata do reconstrutor
 * estrutural precisa comparar `adapterVersion`/`underlyingLibraryVersion`
 * por igualdade literal contra a identidade do único adaptador físico hoje
 * suportado — não apenas confiar no fingerprint geométrico recalculável
 * (ver `structure-reconstruction-source-contracts.ts`). Isso exige que o
 * literal apareça como **dado**, nunca como um `import`, em exatamente um
 * arquivo de PRODUÇÃO do domínio.
 *
 * Esta exceção NUNCA relaxa a checagem de import (a checagem de
 * `readImportsFromFile` continua proibindo qualquer `import ... from
 * "pdfjs-dist"` em todo o domínio, produção ou diagnóstico, inclusive
 * neste mesmo arquivo) — apenas restringe, por caminho de arquivo exato
 * e por palavra-chave exata, a varredura textual grosseira de string
 * usada pela checagem de conteúdo de PRODUÇÃO. Qualquer outro arquivo
 * produtivo, e qualquer outra palavra-chave proibida (Supabase, OCR, IA,
 * outros parsers de PDF), permanece integralmente bloqueado.
 *
 * (Momento 3C.2, correção do guarda) Esta é a ÚNICA exceção textual de
 * produção permitida — nunca ampliada para acomodar Docling, PaddleOCR,
 * PyPDF ou qualquer outro artefato desta ou de futuras Sprints. A
 * resolução adotada para o código diagnóstico desta Sprint (avaliação de
 * leitores locais) foi separar o conjunto de arquivos escaneados por
 * conteúdo textual em produção vs. diagnóstico (§3.1-§3.2 abaixo) — nunca
 * adicionar mais entradas a esta lista.
 */
const KEYWORD_SCAN_KNOWN_EXCEPTIONS: ReadonlyArray<{ readonly fileSuffix: string; readonly keyword: string }> = [
  { fileSuffix: "structure-reconstruction/structure-reconstruction-source-contracts.ts", keyword: "pdfjs" },
];

const DOMAINS_THAT_MUST_NOT_IMPORT_BUDGET_DOCUMENT_LOCATION = [
  join(PACKAGE_SRC_ROOT, "domain", "document-processing"),
  join(PACKAGE_SRC_ROOT, "services", "document-processing"),
  join(PACKAGE_SRC_ROOT, "domain", "document-reconstruction"),
  join(PACKAGE_SRC_ROOT, "domain", "budget-version"),
  join(PACKAGE_SRC_ROOT, "services", "procurement-engineering"),
] as const;

interface ImportRef {
  readonly specifier: string;
  readonly line: number;
}

type ViolationKind = "import" | "content";

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly specifier: string;
  readonly reason: string;
  readonly kind: ViolationKind;
}

// ============================================================================
// §3.1 (Momento 3C.2) — conjuntos de arquivo explícitos: todos, produção,
// diagnóstico. Diagnóstico = segmento de caminho EXATO `testing`, nunca
// substring.
// ============================================================================

function listBudgetDocumentLocationAllSourceFiles(): ReadonlyArray<string> {
  return listTsFiles(BUDGET_DOCUMENT_LOCATION_DIR).filter((file) => !file.endsWith(".test.ts"));
}

function isDiagnosticFile(filePath: string): boolean {
  return isUnderExactSegment(toRepoRelative(filePath), DIAGNOSTIC_PATH_SEGMENT);
}

function listBudgetDocumentLocationProductionSourceFiles(): ReadonlyArray<string> {
  return listBudgetDocumentLocationAllSourceFiles().filter((file) => !isDiagnosticFile(file));
}

function listBudgetDocumentLocationDiagnosticFiles(): ReadonlyArray<string> {
  return listBudgetDocumentLocationAllSourceFiles().filter(isDiagnosticFile);
}

runTest("budget-document-location source exists and guard scans it", () => {
  const files = listBudgetDocumentLocationAllSourceFiles();
  assertEqual(files.length > 3, true, `expected more than 3 budget-document-location source files, scanned ${files.length}`);
});

runTest("budget-document-location production and diagnostic sets partition all source files, with no overlap", () => {
  const all = listBudgetDocumentLocationAllSourceFiles();
  const production = listBudgetDocumentLocationProductionSourceFiles();
  const diagnostic = listBudgetDocumentLocationDiagnosticFiles();
  assertEqual(production.length + diagnostic.length, all.length, "production.length + diagnostic.length should equal all.length (disjoint partition)");
  const overlap = production.filter((f) => diagnostic.includes(f));
  assertEqual(overlap.length, 0, "production and diagnostic sets must never overlap");
  assertEqual(diagnostic.length > 0, true, "expected at least one diagnostic file to exist (this Sprint's local-reader-evaluation tree)");
  assertEqual(production.length > 0, true, "expected at least one production file to exist");
});

runTest("budget-document-location does not import document-processing, document-reconstruction, budget-version or procurement-engineering", () => {
  const violations: Violation[] = [];

  listBudgetDocumentLocationAllSourceFiles().forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (ref.specifier.startsWith(".")) {
        const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
        const hit = OTHER_DOMAINS_THAT_MUST_NOT_BE_IMPORTED.find((segment) => isUnderSegment(resolved, `packages/bdos-core/src/${segment}`));

        if (hit !== undefined) {
          violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `resolves into ${hit}`, kind: "import" });
        }
        return;
      }

      const normalizedSpecifier = ref.specifier.split("\\").join("/");
      OTHER_DOMAINS_THAT_MUST_NOT_BE_IMPORTED.forEach((segment) => {
        if (normalizedSpecifier.includes(`@bba/bdos-core/${segment}`)) {
          violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `imports @bba/bdos-core/${segment}`, kind: "import" });
        }
      });
    });
  });

  assertNoViolations(violations, "budget-document-location forbidden domain dependency");
});

runTest("budget-document-location does not import the web application or a Supabase-based storage/repository seam", () => {
  const violations: Violation[] = [];

  listBudgetDocumentLocationAllSourceFiles().forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      const normalizedSpecifier = ref.specifier.split("\\").join("/");
      FORBIDDEN_SPECIFIER_KEYWORDS.forEach((keyword) => {
        if (normalizedSpecifier.includes(keyword)) {
          violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `imports forbidden specifier keyword "${keyword}"`, kind: "import" });
        }
      });
    });
  });

  assertNoViolations(violations, "budget-document-location web/Supabase import");
});

// ============================================================================
// §3.2 (Momento 3C.2) — a varredura textual grosseira agora escaneia
// EXCLUSIVAMENTE arquivos de produção. Código diagnóstico (avaliação de
// leitores locais, verdade de referência estruturada) pode legitimamente
// descrever Docling/PaddleOCR/PyPDF em prosa e fixtures — nunca em
// arquivos de produção.
// ============================================================================

/** Pura — nenhum acesso a disco. Testável com conteúdo/caminho sintéticos (ver §3.6 abaixo). */
function findForbiddenContentKeywords(content: string, normalizedFile: string): ReadonlyArray<string> {
  // Catálogos públicos de limitações podem declarar explicitamente a
  // ausência da capacidade. Esse literal negativo não é dependência nem
  // vocabulário operacional e deve ser removido antes da varredura.
  const normalizedContent = content.toLowerCase().replaceAll("no_ai_or_ocr_applied", "");
  return FORBIDDEN_KEYWORDS.filter((keyword) => {
    const isKnownException = KEYWORD_SCAN_KNOWN_EXCEPTIONS.some((exception) => exception.keyword === keyword && normalizedFile.endsWith(exception.fileSuffix));
    return normalizedContent.includes(keyword) && !isKnownException;
  });
}

runTest("budget-document-location PRODUCTION code introduces no PDF parser, OCR, AI or Supabase keyword", () => {
  const violations: Violation[] = [];

  listBudgetDocumentLocationProductionSourceFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    const normalizedFile = toRepoRelative(file).split("\\").join("/");
    findForbiddenContentKeywords(content, normalizedFile).forEach((keyword) => {
      violations.push({ file: normalizedFile, line: 1, specifier: keyword, reason: "forbidden parser/OCR/AI/Supabase keyword present in budget-document-location PRODUCTION source", kind: "content" });
    });
  });

  assertNoViolations(violations, "budget-document-location production parser/OCR/AI/Supabase dependency");
});

runTest("the pdfjs keyword exception is narrow: no other forbidden keyword is exempted anywhere, and the exempted production file still forbids every other keyword", () => {
  const exceptionFile = listBudgetDocumentLocationProductionSourceFiles().find((file) =>
    KEYWORD_SCAN_KNOWN_EXCEPTIONS.some((exception) => toRepoRelative(file).split("\\").join("/").endsWith(exception.fileSuffix)),
  );
  assertEqual(exceptionFile !== undefined, true, "expected the exempted production file to exist and be scanned");

  const content = readFileSync(exceptionFile!, "utf8").toLowerCase();
  const otherForbiddenKeywords = FORBIDDEN_KEYWORDS.filter((keyword) => keyword !== "pdfjs");
  const leaked = otherForbiddenKeywords.filter((keyword) => content.includes(keyword));
  assertEqual(leaked.length, 0, `the exempted file must not contain any other forbidden keyword: ${leaked.join(", ")}`);

  assertEqual(KEYWORD_SCAN_KNOWN_EXCEPTIONS.length, 1, "the exception list must remain a single, deliberate entry — grow it only with equal justification, never for Docling/PaddleOCR/PyPDF or any diagnostic artifact");
});

// ============================================================================
// §3.3 (Momento 3C.2) — arquivos de diagnóstico: texto livre é permitido,
// mas um IMPORT real (especificador não relativo) contendo palavra
// proibida continua bloqueado — diagnóstico pode DESCREVER Docling/OCR,
// nunca DEPENDER de um pacote real de OCR/parser/IA/Supabase.
// ============================================================================

/** Pura — nenhum acesso a disco. `null` para specifiers relativos (sempre permitidos aqui). */
function findForbiddenImportSpecifierKeywords(specifier: string): ReadonlyArray<string> {
  if (specifier.startsWith(".")) return [];
  const normalizedSpecifier = specifier.toLowerCase();
  return FORBIDDEN_KEYWORDS.filter((keyword) => normalizedSpecifier.includes(keyword));
}

runTest("budget-document-location diagnostic files never import a real parser/OCR/AI/Supabase package (relative imports remain free; text/fixtures remain free; only a real non-relative package specifier is blocked)", () => {
  const violations: Violation[] = [];

  listBudgetDocumentLocationDiagnosticFiles().forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      findForbiddenImportSpecifierKeywords(ref.specifier).forEach((keyword) => {
        violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `imports forbidden keyword "${keyword}" as a real package specifier`, kind: "import" });
      });
    });
  });

  assertNoViolations(violations, "budget-document-location diagnostic file imports a real parser/OCR/AI/Supabase package");
});

// ============================================================================
// §3.4 (Momento 3C.2) — produção nunca pode importar diagnóstico (estático,
// dinâmico ou reexportação — readImportsFromFile já cobre os três).
// ============================================================================

function isUnderExactSegment(relPath: string, segment: string): boolean {
  return relPath.split("/").includes(segment);
}

function specifierResolvesUnderDiagnostic(fromFile: string, specifier: string): boolean {
  if (!specifier.startsWith(".")) return false;
  const resolved = toRepoRelative(resolve(dirname(fromFile), specifier));
  return isUnderExactSegment(resolved, DIAGNOSTIC_PATH_SEGMENT);
}

runTest("budget-document-location production code never imports or re-exports a path under testing/ (diagnostic code) — static, dynamic or re-export", () => {
  const violations: Violation[] = [];

  listBudgetDocumentLocationProductionSourceFiles().forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (specifierResolvesUnderDiagnostic(file, ref.specifier)) {
        violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "production file imports/re-exports a path under testing/ (diagnostic code)", kind: "import" });
      }
    });
  });

  assertNoViolations(violations, "budget-document-location production imports diagnostic code");
});

// ============================================================================
// §3.5 (Momento 3C.2) — diagnóstico nunca sai pelo barril público. Duas
// checagens: textual (já existente, mantida) e por especificador de
// import/reexport (fortalecida, nova).
// ============================================================================

runTest("synthetic fixtures are not exported from the domain's public barrel (textual check)", () => {
  const indexPath = join(BUDGET_DOCUMENT_LOCATION_DIR, "index.ts");
  const content = readFileSync(indexPath, "utf8");
  assertEqual(content.includes("testing"), false, "index.ts must not re-export the testing/ synthetic reference suite as public API");
});

runTest("the public barrel does not import or re-export any path under testing/ (specifier check — reference truth, protocol, diagnostic adapters, results, executor, v2 modules all live under testing/)", () => {
  const indexPath = join(BUDGET_DOCUMENT_LOCATION_DIR, "index.ts");
  const violations: Violation[] = [];

  readImportsFromFile(indexPath).forEach((ref) => {
    if (specifierResolvesUnderDiagnostic(indexPath, ref.specifier)) {
      violations.push({ file: toRepoRelative(indexPath), line: ref.line, specifier: ref.specifier, reason: "public barrel imports/re-exports a path under testing/ (diagnostic code)", kind: "import" });
    }
  });

  assertNoViolations(violations, "budget-document-location public barrel exports diagnostic code");
});

runTest("the domain's public barrel does not reference infrastructure or pdfjs", () => {
  const indexPath = join(BUDGET_DOCUMENT_LOCATION_DIR, "index.ts");
  const content = readFileSync(indexPath, "utf8").toLowerCase();
  assertEqual(content.includes("infrastructure"), false, "index.ts must not reference the infrastructure/ adapter layer");
  assertEqual(content.includes("pdfjs"), false, "index.ts must not reference pdfjs-dist");
});

runTest("document-processing, document-reconstruction, budget-version and procurement-engineering do not depend on budget-document-location", () => {
  const violations = findImportsOfBudgetDocumentLocation(DOMAINS_THAT_MUST_NOT_IMPORT_BUDGET_DOCUMENT_LOCATION);
  assertNoViolations(violations, "existing domain importing budget-document-location");
});

// ============================================================================
// §3.6 (Momento 3C.2) — testes sintéticos do próprio guarda. Operam sobre
// as funções puras acima com conteúdo/caminhos fabricados — nunca criam
// arquivo real em disco, nunca dependem de conteúdo real do repositório
// (exceto os dois casos que precisam confirmar um arquivo real: exceção
// pdfjs única, e existência de ao menos um arquivo diagnóstico real —
// já cobertos pelos testes acima, não repetidos aqui).
// ============================================================================

const SYNTHETIC_PRODUCTION_FILE = toRepoRelative(join(BUDGET_DOCUMENT_LOCATION_DIR, "tabular-region-detection", "synthetic-production-fixture.ts")).split("\\").join("/");
const SYNTHETIC_DIAGNOSTIC_FILE = toRepoRelative(join(BUDGET_DOCUMENT_LOCATION_DIR, "tabular-region-detection", "testing", "discovery", "synthetic-diagnostic-fixture.ts")).split("\\").join("/");
const SYNTHETIC_LOOKALIKE_FILE = toRepoRelative(join(BUDGET_DOCUMENT_LOCATION_DIR, "tabular-region-detection", "contest-testing-like-name", "synthetic-lookalike-fixture.ts")).split("\\").join("/");

runTest("guard self-test (§3.6, item 1) — a production file with a comment containing 'ocr' is rejected", () => {
  const hits = findForbiddenContentKeywords("// this module never uses ocr in production", SYNTHETIC_PRODUCTION_FILE);
  assertEqual(hits.includes("ocr"), true, "expected 'ocr' to be flagged for a production-path file");
});

runTest("guard self-test (§3.6, item 2) — a diagnostic file with a comment containing 'ocr' is permitted (excluded from the production content scan entirely)", () => {
  assertEqual(isDiagnosticFile(SYNTHETIC_DIAGNOSTIC_FILE), true, "expected the synthetic path to be classified as diagnostic (exact 'testing' segment)");
  // A varredura de conteúdo textual (§3.2) só é aplicada a
  // listBudgetDocumentLocationProductionSourceFiles() — um arquivo
  // diagnóstico nunca entra nesse conjunto, portanto seu conteúdo nunca é
  // escaneado por findForbiddenContentKeywords em nenhum teste real acima.
});

runTest("guard self-test (§3.6, item 3) — a diagnostic file importing a real forbidden package specifier is rejected; a relative import is never flagged", () => {
  assertEqual(findForbiddenImportSpecifierKeywords("paddleocr").includes("ocr"), true, "expected 'ocr' to be flagged for a real package specifier");
  assertEqual(findForbiddenImportSpecifierKeywords("tesseract.js").includes("tesseract"), true, "expected 'tesseract' to be flagged for a real package specifier");
  assertEqual(findForbiddenImportSpecifierKeywords("./discovery-local-reader-comparison").length, 0, "relative imports must never be flagged, even if their text happens to contain a forbidden substring");
});

runTest("guard self-test (§3.6, item 4) — a production file importing a path under testing/ is rejected", () => {
  assertEqual(
    specifierResolvesUnderDiagnostic(join(BUDGET_DOCUMENT_LOCATION_DIR, "tabular-region-detection", "some-production-file.ts"), "./testing/discovery/some-diagnostic-module"),
    true,
    "a relative import resolving under testing/ must be flagged",
  );
  assertEqual(
    specifierResolvesUnderDiagnostic(join(BUDGET_DOCUMENT_LOCATION_DIR, "tabular-region-detection", "some-production-file.ts"), "./sibling-production-module"),
    false,
    "a relative import resolving outside testing/ must never be flagged",
  );
});

runTest("guard self-test (§3.6, item 5) — the public barrel importing a path under testing/ is rejected (same predicate as item 4, applied at the barrel)", () => {
  const indexPath = join(BUDGET_DOCUMENT_LOCATION_DIR, "index.ts");
  assertEqual(
    specifierResolvesUnderDiagnostic(indexPath, "./tabular-region-detection/testing/discovery/reference-truth/discovery-reference-truth"),
    true,
    "the barrel importing a path under testing/ must be flagged",
  );
  assertEqual(specifierResolvesUnderDiagnostic(indexPath, "./tabular-region-detection/tabular-region-formation"), false, "the barrel importing a production path must never be flagged");
});

runTest("guard self-test (§3.6, item 6) — the production exception set remains exactly one entry: pdfjs (duplicate of the dedicated test above, kept here for §3.6 completeness)", () => {
  assertEqual(KEYWORD_SCAN_KNOWN_EXCEPTIONS.length, 1, "the exception list must remain exactly one entry");
  assertEqual(KEYWORD_SCAN_KNOWN_EXCEPTIONS[0].keyword, "pdfjs", "the single exception must be the pdfjs keyword");
});

runTest("guard self-test (§3.6, item 7) — files outside the exact testing/ segment are never accidentally excluded (no substring matching)", () => {
  assertEqual(isDiagnosticFile(SYNTHETIC_LOOKALIKE_FILE), false, "'contest-testing-like-name' must never be classified as diagnostic — it is not an exact 'testing' path segment");
  assertEqual(isDiagnosticFile(SYNTHETIC_PRODUCTION_FILE), false, "a plain production path must never be classified as diagnostic");
  assertEqual(isDiagnosticFile(SYNTHETIC_DIAGNOSTIC_FILE), true, "positive control: a genuine 'testing' segment must still be classified as diagnostic");
});

function findImportsOfBudgetDocumentLocation(dirs: ReadonlyArray<string>): ReadonlyArray<Violation> {
  const violations: Violation[] = [];

  dirs.flatMap(listTsFiles).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (ref.specifier.includes("budget-document-location")) {
        violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "imports budget-document-location", kind: "import" });
      }
    });
  });

  return violations;
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
  const pattern =
    /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/gm;
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

function isUnderSegment(relPath: string, segment: string): boolean {
  return relPath === segment || relPath.startsWith(`${segment}/`);
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) {
    return;
  }

  const details = violations
    .map((violation) => {
      const verb = violation.kind === "content" ? "contains" : "imports";
      return `  ${violation.file}:${violation.line} ${verb} "${violation.specifier}" - ${violation.reason}`;
    })
    .join("\n");

  throw new Error(`${message} (${violations.length}):\n${details}`);
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
