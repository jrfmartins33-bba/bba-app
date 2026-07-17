/**
 * Guard arquitetural específico da Sprint 21.4A.2.f.2b (reconstrução
 * auditável de hipóteses de coluna física). Complementa, sem enfraquecer,
 * o guard genérico pré-existente (`budget-document-location-boundaries.test.ts`,
 * que já escaneia toda a subpasta `physical-column-hypothesis-reconstruction/`,
 * proibindo `pdfjs`, `supabase`, `apps/web`) e os guards das duas Sprints
 * anteriores. Este guard cobre apenas o que é exclusivo desta Sprint:
 *
 * 1. o barrel público é seletivo — nunca exporta o perfil concreto, chaves,
 *    fingerprint interno, catálogo de mensagens, canonicalizadores
 *    internos, os módulos puros de construção de faixa/formação de
 *    hipótese, a ponte de teste ou o seam de injeção de dependências;
 * 2. nenhum arquivo de produção referencia vocabulário econômico, de
 *    infraestrutura/persistência/API/interface, score/confiança/ranking
 *    probabilístico, topônimo, ou nome de documento real;
 * 3. nenhum arquivo de produção lê `item.text` ou qualquer conteúdo
 *    textual — este domínio nunca teve acesso a texto;
 * 4. nenhum arquivo de produção importa `physical-document-read.types` ou
 *    `page-location` diretamente — apenas os contratos das duas Sprints
 *    consumidas (`structure-reconstruction`, `tabular-region-detection`);
 * 5. o seam de injeção de dependências nunca é exportado por nenhum
 *    barrel público; a função pública aceita exatamente um parâmetro.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(CURRENT_DIR, "..");
const MODULE_DIR = join(SRC_ROOT, "domain", "budget-document-location", "physical-column-hypothesis-reconstruction");
const BARREL_FILE = join(MODULE_DIR, "index.ts");
const DOMAIN_BARREL_FILE = join(SRC_ROOT, "domain", "budget-document-location", "index.ts");

const INTERNAL_MODULE_NAMES = [
  "physical-column-hypothesis-reconstruction-context-fingerprint",
  "physical-column-hypothesis-reconstruction-keys",
  "physical-column-hypothesis-reconstruction-profile",
  "physical-column-hypothesis-reconstruction-input-validation",
  "physical-column-hypothesis-reconstruction-source-contracts",
  "physical-column-hypothesis-reconstruction-technical-problem",
  "physical-column-hypothesis-reconstruction-output-geometry-canonicalization",
  "physical-vertical-band-construction",
  "physical-column-hypothesis-formation",
  "physical-column-hypothesis-reconstruction-test-bridge",
] as const;

const FORBIDDEN_VOCABULARY = [
  "unitPrice",
  "totalValue",
  "bdiPercentage",
  "budgetLine",
  "economicColumn",
  "serviceCode",
  "BudgetVersion",
  "score",
  "confiden",
  "confianç",
  "probabilit",
  "ranking",
  "DNOCS",
  "DNIT",
  "Lagoa do Arroz",
  "_local-documents",
  "supabase",
  "@supabase",
  "apps/web",
  "@bba/web",
] as const;

const FORBIDDEN_IMPORT_SPECIFIER_SUBSTRINGS = ["physical-document-read.types", "/page-location/", "\\page-location\\"] as const;

interface Violation {
  readonly file: string;
  readonly reason: string;
}

function listProductionFiles(): ReadonlyArray<string> {
  const files: string[] = [];

  function walk(dir: string): void {
    readdirSync(dir).forEach((entry) => {
      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        if (entry === "testing") {
          return;
        }
        walk(fullPath);
        return;
      }
      if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".d.ts")) {
        files.push(fullPath);
      }
    });
  }

  walk(MODULE_DIR);
  return files;
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) {
    return;
  }
  const details = violations.map((v) => `  ${v.file}: ${v.reason}`).join("\n");
  throw new Error(`${message} (${violations.length}):\n${details}`);
}

runTest("physical-column-hypothesis-reconstruction production source exists and guard scans it", () => {
  const files = listProductionFiles();
  assertEqual(files.length > 8, true, `expected more than 8 production source files, scanned ${files.length}`);
});

runTest("the barrel never exports an internal profile, key builder, fingerprint, canonicalizer, message catalog, pure module, test bridge or dependency seam", () => {
  const content = readFileSync(BARREL_FILE, "utf8");
  const violations: Violation[] = [];
  INTERNAL_MODULE_NAMES.forEach((moduleName) => {
    if (content.includes(moduleName)) {
      violations.push({ file: "physical-column-hypothesis-reconstruction/index.ts", reason: `must not reference internal module "${moduleName}"` });
    }
  });
  assertNoViolations(violations, "barrel exports an internal implementation detail");
});

runTest("the domain's public barrel never re-exports the test bridge", () => {
  const content = readFileSync(DOMAIN_BARREL_FILE, "utf8");
  assertEqual(content.includes("physical-column-hypothesis-reconstruction-test-bridge"), false, "domain barrel must not export the geometric test bridge");
});

runTest("the dependency-injection failure-testing seam is never exported by any public barrel", () => {
  const violations: Violation[] = [];
  const forbiddenIdentifiers = ["PhysicalColumnHypothesisReconstructionDependencies", "reconstructBudgetDocumentPhysicalColumnHypothesesWithDependencies"];

  [BARREL_FILE, DOMAIN_BARREL_FILE].forEach((barrelFile) => {
    const content = readFileSync(barrelFile, "utf8");
    forbiddenIdentifiers.forEach((identifier) => {
      if (content.includes(identifier)) {
        violations.push({ file: barrelFile, reason: `must not export the internal failure-injection seam identifier "${identifier}"` });
      }
    });
  });

  assertNoViolations(violations, "a public barrel exports the internal dependency-injection seam");
});

runTest("the public reconstructBudgetDocumentPhysicalColumnHypotheses function accepts exactly one parameter", () => {
  const content = readFileSync(join(MODULE_DIR, "reconstruct-budget-document-physical-column-hypotheses.ts"), "utf8");
  const match = content.match(/export function reconstructBudgetDocumentPhysicalColumnHypotheses\(\s*([^)]*)\)/);
  assertEqual(match !== null, true, "expected to find the public function signature");
  const parameterList = match![1];
  const parameterCount = parameterList
    .split(",")
    .map((parameter) => parameter.trim())
    .filter((parameter) => parameter.length > 0).length;
  assertEqual(parameterCount, 1, `expected exactly one parameter, found signature: (${parameterList})`);
});

runTest("no production file references economic-domain, infrastructure/API, score/confidence/ranking, place-name or real-document vocabulary forbidden in this Sprint", () => {
  const violations: Violation[] = [];
  listProductionFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    FORBIDDEN_VOCABULARY.forEach((term) => {
      if (content.toLowerCase().includes(term.toLowerCase())) {
        violations.push({ file, reason: `references forbidden term "${term}"` });
      }
    });
  });
  assertNoViolations(violations, "production file contains forbidden vocabulary");
});

runTest("no production file reads item.text or any textual content", () => {
  const violations: Violation[] = [];
  const propertyAccessPattern = /\.text\b/;

  listProductionFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    content.split("\n").forEach((line, lineIndex) => {
      const trimmed = line.trim();
      const isCommentLine = trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/**");
      if (!isCommentLine && propertyAccessPattern.test(line)) {
        violations.push({ file: `${file}:${lineIndex + 1}`, reason: `reads .text: "${trimmed}"` });
      }
    });
  });
  assertNoViolations(violations, "production file reads textual content");
});

runTest("no production file imports the physical read or page-location contracts directly — only structure-reconstruction and tabular-region-detection", () => {
  const violations: Violation[] = [];
  const importPattern = /\bfrom\s+["']([^"']+)["']/g;

  listProductionFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    let match: RegExpExecArray | null = importPattern.exec(content);
    while (match !== null) {
      const specifier = match[1];
      FORBIDDEN_IMPORT_SPECIFIER_SUBSTRINGS.forEach((forbidden) => {
        if (specifier.includes(forbidden)) {
          violations.push({ file, reason: `imports forbidden specifier "${specifier}" (matches "${forbidden}")` });
        }
      });
      match = importPattern.exec(content);
    }
  });
  assertNoViolations(violations, "production file imports the physical read or page-location contract directly");
});

runTest("no production file mutates its input (no property assignment onto the input parameter)", () => {
  const violations: Violation[] = [];
  const assignmentPattern = /^input\.(structureReconstruction|tabularRegionDetection)(\.[a-zA-Z0-9_]+|\[[^\]]+\])+\s*=\s*(?!=)/;
  listProductionFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    content.split("\n").forEach((line, lineIndex) => {
      if (assignmentPattern.test(line.trim())) {
        violations.push({ file: `${file}:${lineIndex + 1}`, reason: `appears to assign into input.structureReconstruction or input.tabularRegionDetection: "${line.trim()}"` });
      }
    });
  });
  assertNoViolations(violations, "production file mutates its input");
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
