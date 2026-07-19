import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_SRC_ROOT = resolve(CURRENT_DIR, "..");
const PACKAGE_ROOT = resolve(PACKAGE_SRC_ROOT, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");

const BUDGET_DOCUMENT_LOCATION_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location");

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
 * arquivo de produção do domínio.
 *
 * Esta exceção NUNCA relaxa a checagem de import (a outra checagem deste
 * arquivo, `readImportsFromFile`, continua proibindo qualquer `import ...
 * from "pdfjs-dist"` em todo o domínio, inclusive neste mesmo arquivo) —
 * apenas restringe, por caminho de arquivo exato e por palavra-chave
 * exata, o escaneamento textual grosseiro de string usado por esta
 * checagem específica. Qualquer outro arquivo, e qualquer outra
 * palavra-chave proibida (Supabase, OCR, IA, outros parsers de PDF),
 * permanece integralmente bloqueado.
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

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly specifier: string;
  readonly reason: string;
}

runTest("budget-document-location source exists and guard scans it", () => {
  const files = listBudgetDocumentLocationSourceFiles();
  assertEqual(files.length > 3, true, `expected more than 3 budget-document-location source files, scanned ${files.length}`);
});

runTest("budget-document-location does not import document-processing, document-reconstruction, budget-version or procurement-engineering", () => {
  const violations: Violation[] = [];

  listBudgetDocumentLocationSourceFiles().forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (ref.specifier.startsWith(".")) {
        const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
        const hit = OTHER_DOMAINS_THAT_MUST_NOT_BE_IMPORTED.find((segment) => isUnderSegment(resolved, `packages/bdos-core/src/${segment}`));

        if (hit !== undefined) {
          violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `resolves into ${hit}` });
        }
        return;
      }

      const normalizedSpecifier = ref.specifier.split("\\").join("/");
      OTHER_DOMAINS_THAT_MUST_NOT_BE_IMPORTED.forEach((segment) => {
        if (normalizedSpecifier.includes(`@bba/bdos-core/${segment}`)) {
          violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `imports @bba/bdos-core/${segment}` });
        }
      });
    });
  });

  assertNoViolations(violations, "budget-document-location forbidden domain dependency");
});

runTest("budget-document-location does not import the web application or a Supabase-based storage/repository seam", () => {
  const violations: Violation[] = [];

  listBudgetDocumentLocationSourceFiles().forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      const normalizedSpecifier = ref.specifier.split("\\").join("/");
      FORBIDDEN_SPECIFIER_KEYWORDS.forEach((keyword) => {
        if (normalizedSpecifier.includes(keyword)) {
          violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: `imports forbidden specifier keyword "${keyword}"` });
        }
      });
    });
  });

  assertNoViolations(violations, "budget-document-location web/Supabase import");
});

runTest("budget-document-location introduces no PDF parser, OCR, AI or Supabase keyword", () => {
  const violations: Violation[] = [];

  listBudgetDocumentLocationSourceFiles().forEach((file) => {
    // Catálogos públicos de limitações podem declarar explicitamente a
    // ausência da capacidade. Esse literal negativo não é dependência nem
    // vocabulário operacional e deve ser removido antes da varredura.
    const content = readFileSync(file, "utf8").toLowerCase().replaceAll("no_ai_or_ocr_applied", "");
    const normalizedFile = toRepoRelative(file).split("\\").join("/");

    FORBIDDEN_KEYWORDS.forEach((keyword) => {
      const isKnownException = KEYWORD_SCAN_KNOWN_EXCEPTIONS.some(
        (exception) => exception.keyword === keyword && normalizedFile.endsWith(exception.fileSuffix),
      );
      if (content.includes(keyword) && !isKnownException) {
        violations.push({ file: toRepoRelative(file), line: 1, specifier: keyword, reason: "forbidden parser/OCR/AI/Supabase keyword in budget-document-location source" });
      }
    });
  });

  assertNoViolations(violations, "budget-document-location parser/OCR/AI/Supabase dependency");
});

runTest("the pdfjs keyword exception is narrow: no other forbidden keyword is exempted anywhere, and the exempted file still forbids every other keyword", () => {
  const exceptionFile = listBudgetDocumentLocationSourceFiles().find((file) =>
    KEYWORD_SCAN_KNOWN_EXCEPTIONS.some((exception) => toRepoRelative(file).split("\\").join("/").endsWith(exception.fileSuffix)),
  );
  assertEqual(exceptionFile !== undefined, true, "expected the exempted file to exist and be scanned");

  const content = readFileSync(exceptionFile!, "utf8").toLowerCase();
  const otherForbiddenKeywords = FORBIDDEN_KEYWORDS.filter((keyword) => keyword !== "pdfjs");
  const leaked = otherForbiddenKeywords.filter((keyword) => content.includes(keyword));
  assertEqual(leaked.length, 0, `the exempted file must not contain any other forbidden keyword: ${leaked.join(", ")}`);

  assertEqual(KEYWORD_SCAN_KNOWN_EXCEPTIONS.length, 1, "the exception list must remain a single, deliberate entry — grow it only with equal justification");
});

runTest("document-processing, document-reconstruction, budget-version and procurement-engineering do not depend on budget-document-location", () => {
  const violations = findImportsOfBudgetDocumentLocation(DOMAINS_THAT_MUST_NOT_IMPORT_BUDGET_DOCUMENT_LOCATION);
  assertNoViolations(violations, "existing domain importing budget-document-location");
});

runTest("synthetic fixtures are not exported from the domain's public barrel", () => {
  const indexPath = join(BUDGET_DOCUMENT_LOCATION_DIR, "index.ts");
  const content = readFileSync(indexPath, "utf8");
  assertEqual(content.includes("testing"), false, "index.ts must not re-export the testing/ synthetic reference suite as public API");
});

runTest("the domain's public barrel does not reference infrastructure or pdfjs", () => {
  const indexPath = join(BUDGET_DOCUMENT_LOCATION_DIR, "index.ts");
  const content = readFileSync(indexPath, "utf8").toLowerCase();
  assertEqual(content.includes("infrastructure"), false, "index.ts must not reference the infrastructure/ adapter layer");
  assertEqual(content.includes("pdfjs"), false, "index.ts must not reference pdfjs-dist");
});

function findImportsOfBudgetDocumentLocation(dirs: ReadonlyArray<string>): ReadonlyArray<Violation> {
  const violations: Violation[] = [];

  dirs.flatMap(listTsFiles).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (ref.specifier.includes("budget-document-location")) {
        violations.push({ file: toRepoRelative(file), line: ref.line, specifier: ref.specifier, reason: "imports budget-document-location" });
      }
    });
  });

  return violations;
}

function listBudgetDocumentLocationSourceFiles(): ReadonlyArray<string> {
  return listTsFiles(BUDGET_DOCUMENT_LOCATION_DIR).filter((file) => !file.endsWith(".test.ts"));
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
    .map((violation) => `  ${violation.file}:${violation.line} imports "${violation.specifier}" - ${violation.reason}`)
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
