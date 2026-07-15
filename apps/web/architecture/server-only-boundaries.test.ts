/**
 * Guarda estrutural contra importação do adaptador privilegiado de
 * Engenharia de Custos e Licitações (Sprint 21.3C, correção de fronteira
 * de confiança) por código que pode ser embutido no navegador ou no
 * aplicativo móvel. Mesmo padrão textual de import-scan de
 * packages/bdos-core/src/architecture/engineering-boundaries.test.ts e
 * apps/web/architecture/studio-boundaries.test.ts — sem API do compilador
 * TypeScript, sem framework de teste, sem rede.
 *
 * `apps/web/lib/bdos/procurement-engineering-server-repository.ts` só
 * funciona (para escrita) com um cliente Supabase de `service_role` —
 * uma credencial que nunca pode chegar ao navegador. Este arquivo garante
 * que nenhum arquivo com a diretiva `"use client"` e nenhum arquivo sob
 * apps/mobile importa esse módulo **diretamente** (por nome ou por
 * caminho relativo resolvido para o arquivo do módulo).
 *
 * Esta proteção é intencionalmente só de importação direta, não de todo o
 * grafo transitivo (não detecta, por exemplo, um arquivo "use client" que
 * importa um módulo intermediário que por sua vez importa o adaptador).
 * Hoje isso é suficiente: nenhum outro arquivo do repositório reexporta ou
 * envolve este adaptador — os únicos importadores são os testes reais em
 * supabase/tests/procurement-engineering/*.mjs e este próprio guard. Se um
 * módulo intermediário passar a reexportar o adaptador no futuro, esta
 * proteção direta deixa de ser suficiente e precisará ser ampliada para
 * percorrer o grafo de importações.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const WEB_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(WEB_ROOT, "..", "..");
const MOBILE_ROOT = resolve(REPO_ROOT, "apps", "mobile");

const SERVER_ONLY_MODULE_MARKERS = ["procurement-engineering-server-repository", "document-processing-server-repository"] as const;
const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", ".turbo", "dist", "build", "coverage"]);

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

runTest("guard scans a non-trivial number of source files", () => {
  const total = listSourceFiles(WEB_ROOT).length + listSourceFiles(MOBILE_ROOT).length;
  assertEqual(total > 0, true, `expected to scan at least 1 file, scanned ${total}`);
});

runTest("no client-marked file (\"use client\") imports a server-only BDOS adapter", () => {
  const violations: Violation[] = [];

  listSourceFiles(WEB_ROOT).forEach((file) => {
    if (!hasUseClientDirective(file)) {
      return;
    }

    readImportsFromFile(file).forEach((ref) => {
      if (referencesServerOnlyModule(file, ref.specifier)) {
        violations.push({
          file: toRepoRelative(file),
          line: ref.line,
          specifier: ref.specifier,
          reason: 'file has a "use client" directive and imports the service_role-only adapter',
        });
      }
    });
  });

  assertNoViolations(violations, "client-marked file importing a server-only adapter");
});

runTest("apps/mobile never imports a server-only BDOS adapter", () => {
  const violations: Violation[] = [];

  listSourceFiles(MOBILE_ROOT).forEach((file) => {
    readImportsFromFile(file).forEach((ref) => {
      if (referencesServerOnlyModule(file, ref.specifier)) {
        violations.push({
          file: toRepoRelative(file),
          line: ref.line,
          specifier: ref.specifier,
          reason: "apps/mobile must never import the service_role-only adapter",
        });
      }
    });
  });

  assertNoViolations(violations, "apps/mobile importing a server-only adapter");
});

function referencesServerOnlyModule(fromFile: string, specifier: string): boolean {
  if (SERVER_ONLY_MODULE_MARKERS.some((marker) => specifier.includes(marker))) {
    return true;
  }

  if (!specifier.startsWith(".")) {
    return false;
  }

  const resolved = resolve(dirname(fromFile), specifier);
  return SERVER_ONLY_MODULE_MARKERS.some((marker) => resolved.includes(marker));
}

function hasUseClientDirective(filePath: string): boolean {
  const content = readFileSync(filePath, "utf8");
  const firstStatement = content.trimStart().slice(0, 40);
  return /^["']use client["']/.test(firstStatement);
}

function listSourceFiles(dir: string): ReadonlyArray<string> {
  let entries: ReadonlyArray<string>;

  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const files: string[] = [];

  entries.forEach((entry) => {
    if (IGNORED_DIRS.has(entry)) {
      return;
    }

    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      return;
    }

    if (
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx") &&
      !SERVER_ONLY_MODULE_MARKERS.some((marker) => entry === `${marker}.ts`)
    ) {
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

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) {
    return;
  }

  const details = violations
    .map((violation) => `  ${violation.file}:${violation.line} imports "${violation.specifier}" — ${violation.reason}`)
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
