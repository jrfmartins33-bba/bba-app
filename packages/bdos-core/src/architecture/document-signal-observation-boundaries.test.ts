import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guard arquitetural dedicado da Sprint 21.4A.2.d (seção 31 do brief).
 * Complementa, sem enfraquecer, os guards já existentes de
 * `budget-document-location` — este arquivo cobre exaustivamente os 17
 * pontos exigidos, mesmo quando parte já é coberta incidentalmente pelo
 * guard mais amplo do domínio (redundância deliberada, mesmo padrão já
 * usado no guard da infraestrutura de PDF da Sprint 21.4A.2.c).
 */

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_SRC_ROOT = resolve(CURRENT_DIR, "..");
const REPO_ROOT = resolve(PACKAGE_SRC_ROOT, "..", "..", "..");

const SIGNAL_OBSERVATION_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location", "signal-observation");
const SIGNAL_OBSERVATION_TESTING_DIR = join(SIGNAL_OBSERVATION_DIR, "testing");

const FORBIDDEN_KEYWORDS = [
  "pdfjs",
  "pdf-lib",
  "pdfkit",
  "pdf-parse",
  "pypdf",
  "pdfplumber",
  "tesseract",
  "ocr",
  "openai",
  "anthropic",
  "embedding",
  "supabase",
  "@supabase",
  "dnocs",
  "dnit",
  "lagoa do arroz",
  "lagoa-do-arroz",
] as const;

const FORBIDDEN_SPECIFIER_KEYWORDS = ["apps/web", "@bba/web", "apps/mobile", "@bba/mobile"] as const;

const FORBIDDEN_IMPORT_SEGMENTS = [
  "infrastructure",
  "domain/budget-version",
  "services/procurement-engineering",
  "domain/document-reconstruction",
  "domain/document-processing",
  "services/document-processing",
] as const;

/**
 * Vocabulário de decisão final proibido no resultado do observador
 * (seção 25 do brief) — verificado aqui como declaração de tipo/campo no
 * código-fonte, não apenas em runtime (ver também
 * `architecture/physical-document-read-no-decision-boundaries.test.ts`
 * e o teste de chaves em runtime dentro do próprio pacote de testes do
 * observador).
 */
const FORBIDDEN_DECISION_FIELD_SUBSTRINGS = [
  "candidate",
  "candidata",
  "candidato",
  "contextual",
  "ambiguous",
  "ambigua",
  "ambígua",
  "discarded",
  "descartada",
  "descartado",
  "relevant",
  "relevante",
  "irrelevant",
  "irrelevante",
  "budgetfound",
  "orcamentoencontrado",
  "orçamentoencontrado",
  "budgetpage",
  "paginadeorcamento",
  "páginadeorçamento",
  "selectedpage",
  "paginaselecionada",
  "confidence",
  "confianca",
  "confiança",
  "score",
  "threshold",
  "limiar",
  "percentual",
  "classification",
  "classificacao",
  "classificação",
  "recomendacaofinal",
  "recomendação final",
] as const;

interface ImportRef {
  readonly specifier: string;
  readonly line: number;
}

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly specifier: string;
  readonly reason: string;
}

runTest("signal-observation source exists and guard scans it", () => {
  const files = listSignalObservationSourceFiles();
  assertEqual(files.length > 5, true, `expected more than 5 signal-observation source files, scanned ${files.length}`);
});

// 2, 7, 8: no pdfjs-dist, no OCR/AI, no DNOCS/DNIT/Lagoa do Arroz
runTest("signal-observation introduces no PDF library, OCR, AI, real-agency or real-bid keyword", () => {
  const violations: Violation[] = [];

  listSignalObservationSourceFiles().forEach((file) => {
    const content = readFileSync(file, "utf8").toLowerCase();
    FORBIDDEN_KEYWORDS.forEach((keyword) => {
      if (content.includes(keyword)) {
        violations.push({ file: toRepoRelative(file), line: 1, specifier: keyword, reason: "forbidden keyword in signal-observation source" });
      }
    });
  });

  assertNoViolations(violations, "signal-observation forbidden keyword");
});

// 3, 4, 5, 6: no infrastructure, Supabase, apps/web, apps/mobile
runTest("signal-observation does not import infrastructure, Supabase, apps/web or apps/mobile", () => {
  const violations: Violation[] = [];

  listSignalObservationSourceFiles().forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      const normalizedSpecifier = ref.specifier.split("\\").join("/");

      FORBIDDEN_SPECIFIER_KEYWORDS.forEach((keyword) => {
        if (normalizedSpecifier.includes(keyword)) {
          violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `imports forbidden specifier keyword "${keyword}"` });
        }
      });

      if (ref.specifier.startsWith(".")) {
        const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
        const hit = FORBIDDEN_IMPORT_SEGMENTS.find((segment) => isUnderSegment(resolved, `packages/bdos-core/src/${segment}`));
        if (hit !== undefined) {
          violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `resolves into ${hit}` });
        }
      }
    });
  });

  assertNoViolations(violations, "signal-observation forbidden dependency");
});

// 9, 10: no economic domains (budget-version, procurement-engineering, BDI transformation, pricing)
runTest("signal-observation does not import budget-version, procurement-engineering or document-reconstruction", () => {
  const violations: Violation[] = [];

  listSignalObservationSourceFiles().forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      const normalizedSpecifier = ref.specifier.split("\\").join("/");
      if (
        normalizedSpecifier.includes("@bba/bdos-core/domain/budget-version") ||
        normalizedSpecifier.includes("@bba/bdos-core/services/procurement-engineering")
      ) {
        violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "imports an economic or procurement service subpath" });
      }
    });
  });

  assertNoViolations(violations, "signal-observation economic domain dependency");
});

// 12, 13: no page decision, no score/confidence/threshold field declared in source
runTest("signal-observation source declares no decision/classification field name", () => {
  const violations: Violation[] = [];
  const fieldNamePattern = /\breadonly\s+([a-zA-Z_$][\w$]*)\s*[:?]/g;

  listSignalObservationSourceFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    let match: RegExpExecArray | null = fieldNamePattern.exec(content);
    while (match !== null) {
      const fieldName = match[1].toLowerCase();
      FORBIDDEN_DECISION_FIELD_SUBSTRINGS.forEach((forbidden) => {
        if (fieldName.includes(forbidden.toLowerCase())) {
          violations.push({ file: toRepoRelative(file), line: 1, specifier: match![1], reason: `field name matches forbidden decision vocabulary "${forbidden}"` });
        }
      });
      match = fieldNamePattern.exec(content);
    }
  });

  assertNoViolations(violations, "signal-observation decision field name");
});

// 14: test types/helpers do not leak through the public barrel
runTest("test-only fixtures are not exported from the signal-observation public barrel", () => {
  const indexPath = join(SIGNAL_OBSERVATION_DIR, "index.ts");
  const content = readFileSync(indexPath, "utf8");
  assertEqual(content.includes("testing"), false, "index.ts must not re-export the testing/ synthetic bridge as public API");
});

// 15: the catalog is never redefined, only imported by reference
runTest("signal-observation never redeclares BudgetDocumentSignalFamily (imports the catalog's own vocabulary instead)", () => {
  const violations: Violation[] = [];
  listSignalObservationSourceFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    if (/\benum\s+BudgetDocumentSignalFamily\b/.test(content)) {
      violations.push({ file: toRepoRelative(file), line: 1, specifier: "BudgetDocumentSignalFamily", reason: "redeclares the catalog's family enum instead of importing it" });
    }
  });
  assertNoViolations(violations, "signal-observation catalog redefinition");
});

// domain must not depend on signal-observation's testing/ bridge from production code
runTest("no production signal-observation source imports its own testing/ bridge", () => {
  const violations: Violation[] = [];
  listSignalObservationSourceFiles()
    .filter((file) => !file.startsWith(SIGNAL_OBSERVATION_TESTING_DIR))
    .forEach((file) => {
      readImportsFromFile(file).forEach((ref) => {
        if (ref.specifier.includes("/testing/") || ref.specifier.startsWith("./testing")) {
          violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "production source imports the test-only bridge" });
        }
      });
    });
  assertNoViolations(violations, "production code importing testing/ bridge");
});

function listSignalObservationSourceFiles(): ReadonlyArray<string> {
  return listTsFiles(SIGNAL_OBSERVATION_DIR).filter((file) => !file.endsWith(".test.ts"));
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
    .map((violation) => `  ${violation.file}:${violation.line} - "${violation.specifier}" - ${violation.reason}`)
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
