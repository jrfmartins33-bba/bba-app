import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_SRC_ROOT = resolve(CURRENT_DIR, "..");
const PACKAGE_ROOT = resolve(PACKAGE_SRC_ROOT, "..");
const REPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");

const PDF_ADAPTER_DIR = join(PACKAGE_SRC_ROOT, "infrastructure", "budget-document-location", "pdfjs");
const PDF_ADAPTER_TESTING_DIR = join(PDF_ADAPTER_DIR, "testing");
const DOMAIN_DIR = join(PACKAGE_SRC_ROOT, "domain", "budget-document-location");

const PDF_ADAPTER_REPO_RELATIVE_PREFIX = "packages/bdos-core/src/infrastructure/budget-document-location/pdfjs";

const FORBIDDEN_ADAPTER_KEYWORDS = [
  "supabase",
  "@supabase",
  "openai",
  "anthropic",
  "tesseract",
  "ocr",
] as const;

const FORBIDDEN_ADAPTER_IMPORT_SEGMENTS = [
  "domain/budget-version",
  "services/procurement-engineering",
  "domain/document-processing",
  "services/document-processing",
  "domain/document-reconstruction",
] as const;

const FORBIDDEN_ADAPTER_SPECIFIER_KEYWORDS = ["apps/web", "@bba/web", "@supabase/supabase-js"] as const;

/**
 * Exceção nomeada e restrita, adicionada na auditoria do PR #69 (Sprint
 * 21.4A.2.f.1). O portão de compatibilidade exata do reconstrutor
 * estrutural (`domain/budget-document-location/structure-reconstruction/structure-reconstruction-source-contracts.ts`)
 * precisa comparar `adapterVersion`/`underlyingLibraryVersion` por
 * igualdade literal contra a identidade do único adaptador físico hoje
 * suportado — nunca aceitar um adaptador ou biblioteca diferentes apenas
 * porque o fingerprint geométrico foi recalculado corretamente (a
 * justificativa "coberto indiretamente pelo fingerprint" foi
 * explicitamente rejeitada nesta auditoria).
 *
 * Essa comparação exige que os dois literais de identidade — que, por
 * serem a identidade que o próprio adaptador se atribuiu, contêm a
 * substring "pdfjs" como parte do seu **valor**, nunca como uma
 * importação — apareçam em um único arquivo de domínio. O arquivo:
 *
 * - NÃO importa `pdfjs-dist` nem qualquer caminho de `infrastructure/`
 *   (a checagem "budget-document-location does not depend on the pdfjs
 *   adapter", abaixo, continua verificando isso, sem exceção, inclusive
 *   para este arquivo);
 * - apenas declara dois valores literais (`SUPPORTED_PHYSICAL_ADAPTER_VERSION`,
 *   `SUPPORTED_PHYSICAL_UNDERLYING_LIBRARY_VERSION`) comparados por
 *   igualdade exata contra o resultado já recebido.
 *
 * Esta exceção nunca relaxa nenhuma outra checagem deste arquivo, nem se
 * aplica a nenhum outro arquivo ou padrão.
 */
const PDFJS_KEYWORD_SCAN_KNOWN_EXCEPTION_REPO_RELATIVE_SUFFIX =
  "domain/budget-document-location/structure-reconstruction/structure-reconstruction-source-contracts.ts";

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

runTest("pdfjs adapter source exists and guard scans it", () => {
  const files = listPdfAdapterSourceFiles();
  assertEqual(files.length > 1, true, `expected more than 1 pdf adapter source file, scanned ${files.length}`);
});

runTest("only the authorized pdfjs adapter directory imports pdfjs-dist anywhere in this package", () => {
  const violations: Violation[] = [];

  listAllPackageSourceFiles().forEach((file) => {
    const repoRelative = toRepoRelative(file);
    if (repoRelative.startsWith(PDF_ADAPTER_REPO_RELATIVE_PREFIX) || repoRelative.endsWith(PDFJS_KEYWORD_SCAN_KNOWN_EXCEPTION_REPO_RELATIVE_SUFFIX)) {
      return;
    }

    const content = readFileSync(file, "utf8").toLowerCase();
    if (content.includes("pdfjs")) {
      violations.push({
        file: repoRelative,
        line: 1,
        specifier: "pdfjs",
        reason: "references pdfjs-dist outside the single authorized adapter directory",
      });
    }
  });

  assertNoViolations(violations, "unauthorized pdfjs-dist reference");
});

runTest("the pdfjs keyword exception file exists, contains no pdfjs-dist import, and is a single deliberate exception", () => {
  const exceptionFile = listAllPackageSourceFiles().find((file) => toRepoRelative(file).endsWith(PDFJS_KEYWORD_SCAN_KNOWN_EXCEPTION_REPO_RELATIVE_SUFFIX));
  assertEqual(exceptionFile !== undefined, true, "expected the exempted file to exist and be scanned");

  const imports = readImportsFromFile(exceptionFile!);
  const importsPdfjs = imports.some((ref) => ref.specifier.toLowerCase().includes("pdfjs"));
  assertEqual(importsPdfjs, false, "the exempted file must reference the pdfjs identity only as a data literal, never as an import");

  const importsInfrastructure = imports.some((ref) => ref.specifier.toLowerCase().includes("infrastructure"));
  assertEqual(importsInfrastructure, false, "the exempted file must not import the infrastructure/adapter layer");
});

runTest("the pdfjs adapter directory does in fact reference pdfjs-dist", () => {
  const referencesPdfjs = listPdfAdapterSourceFiles().some((file) =>
    readFileSync(file, "utf8").toLowerCase().includes("pdfjs"),
  );
  assertEqual(referencesPdfjs, true, "expected the adapter directory to reference pdfjs-dist at least once");
});

runTest("the pdfjs adapter does not import Supabase, storage clients, apps/web, OCR or AI dependencies", () => {
  const violations: Violation[] = [];

  listPdfAdapterSourceFiles().forEach((file) => {
    const content = readFileSync(file, "utf8").toLowerCase();
    FORBIDDEN_ADAPTER_KEYWORDS.forEach((keyword) => {
      if (content.includes(keyword)) {
        violations.push({
          file: toRepoRelative(file),
          line: 1,
          specifier: keyword,
          reason: "forbidden Supabase/OCR/AI keyword in pdfjs adapter source",
        });
      }
    });

    readImportsFromFile(file).forEach((ref) => {
      const normalizedSpecifier = ref.specifier.split("\\").join("/");

      FORBIDDEN_ADAPTER_SPECIFIER_KEYWORDS.forEach((keyword) => {
        if (normalizedSpecifier.includes(keyword)) {
          violations.push({
            file: toRepoRelative(file),
            line: ref.line,
            specifier: ref.specifier,
            reason: `imports forbidden specifier keyword "${keyword}"`,
          });
        }
      });

      if (ref.specifier.startsWith(".")) {
        const resolved = toRepoRelative(resolve(dirname(file), ref.specifier));
        const hit = FORBIDDEN_ADAPTER_IMPORT_SEGMENTS.find((segment) =>
          isUnderSegment(resolved, `packages/bdos-core/src/${segment}`),
        );
        if (hit !== undefined) {
          violations.push({
            file: toRepoRelative(file),
            line: ref.line,
            specifier: ref.specifier,
            reason: `resolves into ${hit}`,
          });
        }
      }
    });
  });

  assertNoViolations(violations, "pdfjs adapter forbidden dependency");
});

runTest("the pdfjs adapter implements the domain's port (imports budget-document-location)", () => {
  const importsDomain = listPdfAdapterSourceFiles()
    .filter((file) => !file.startsWith(PDF_ADAPTER_TESTING_DIR))
    .some((file) =>
      readImportsFromFile(file).some((ref) => ref.specifier.includes("domain/budget-document-location")),
    );
  assertEqual(importsDomain, true, "expected the pdfjs adapter to import the domain/budget-document-location port");
});

runTest("budget-document-location does not depend on the pdfjs adapter (dependency points inward only)", () => {
  const violations: Violation[] = [];

  listTsFiles(DOMAIN_DIR).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      const normalizedSpecifier = ref.specifier.split("\\").join("/");
      if (normalizedSpecifier.includes("infrastructure") || normalizedSpecifier.toLowerCase().includes("pdfjs")) {
        violations.push({
          file: toRepoRelative(file),
          line: ref.line,
          specifier: ref.specifier,
          reason: "domain imports the infrastructure/adapter layer",
        });
      }
    });
  });

  assertNoViolations(violations, "domain depending on infrastructure");
});

runTest("test-only fixtures are not exported from the pdfjs adapter's public barrel", () => {
  const indexPath = join(PDF_ADAPTER_DIR, "index.ts");
  const content = readFileSync(indexPath, "utf8");
  assertEqual(content.includes("testing"), false, "index.ts must not re-export the testing/ synthetic PDF byte builder as public API");
});

function listPdfAdapterSourceFiles(): ReadonlyArray<string> {
  return listTsFiles(PDF_ADAPTER_DIR).filter((file) => !file.endsWith(".test.ts"));
}

function listAllPackageSourceFiles(): ReadonlyArray<string> {
  return listTsFiles(PACKAGE_SRC_ROOT).filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".d.ts"));
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
