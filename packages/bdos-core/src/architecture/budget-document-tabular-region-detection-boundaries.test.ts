/**
 * Guard arquitetural específico da Sprint 21.4A.2.f.2a (detecção auditável
 * de regiões candidatas a estrutura tabular). Complementa, sem enfraquecer,
 * o guard genérico pré-existente (`budget-document-location-boundaries.test.ts`,
 * que já escaneia todo `domain/budget-document-location/` — inclusive esta
 * subpasta — proibindo `pdfjs`, `supabase`, `apps/web` e imports para
 * outros domínios) e o guard da Sprint anterior
 * (`budget-document-structure-reconstruction-boundaries.test.ts`). Este
 * guard cobre apenas o que é exclusivo desta Sprint:
 *
 * 1. o barrel público (`tabular-region-detection/index.ts`) é seletivo —
 *    nunca exporta o perfil concreto, chaves, fingerprint interno,
 *    catálogo de mensagens, canonicalizadores internos, os módulos puros
 *    de observação de alinhamento/formação de região, a ponte de teste ou
 *    o seam de injeção de dependências (§22);
 * 2. nenhum arquivo de produção (excluindo `testing/` e `*.test.ts`)
 *    referencia vocabulário econômico, de infraestrutura/persistência/API/
 *    interface, score/confiança/ranking probabilístico, topônimo, ou nome
 *    de documento real (§22);
 * 3. nenhum arquivo de produção lê `item.text` ou qualquer conteúdo
 *    textual para interpretação semântica — este domínio nunca teve
 *    acesso a texto para começo de conversa (consome exclusivamente
 *    `BudgetDocumentStructureReconstructionResult`, §7);
 * 4. nenhum arquivo de produção importa `physical-document-read.types` ou
 *    `page-location` diretamente — apenas `structure-reconstruction`
 *    (§7: o detector não consome a leitura física ou a localização
 *    originais, apenas o resultado já reconstruído);
 * 5. o seam de injeção de dependências
 *    (`TabularRegionDetectionDependencies`,
 *    `detectBudgetDocumentTabularRegionsWithDependencies`) nunca é
 *    exportado por nenhum barrel público; a função pública
 *    `detectBudgetDocumentTabularRegions` aceita exatamente um parâmetro.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(CURRENT_DIR, "..");
const TABULAR_REGION_DETECTION_DIR = join(SRC_ROOT, "domain", "budget-document-location", "tabular-region-detection");
const BARREL_FILE = join(TABULAR_REGION_DETECTION_DIR, "index.ts");
const DOMAIN_BARREL_FILE = join(SRC_ROOT, "domain", "budget-document-location", "index.ts");

const INTERNAL_MODULE_NAMES = [
  "tabular-region-detection-context-fingerprint",
  "tabular-region-detection-keys",
  "tabular-region-detection-profile",
  "tabular-region-detection-input-validation",
  "tabular-region-detection-source-contracts",
  "tabular-region-detection-technical-problem",
  "tabular-region-detection-output-geometry-canonicalization",
  "vertical-alignment-observation",
  "tabular-region-formation",
  "tabular-region-detection-test-bridge",
] as const;

const FORBIDDEN_VOCABULARY = [
  // Generic Portuguese/English words are deliberately excluded (same
  // discipline as the Sprint 21.4A.2.f.1 guard): only economic-domain
  // field-name-style tokens, infrastructure/API vocabulary, and
  // unambiguous scoring/place-name vocabulary are checked here.
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

  walk(TABULAR_REGION_DETECTION_DIR);
  return files;
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) {
    return;
  }
  const details = violations.map((v) => `  ${v.file}: ${v.reason}`).join("\n");
  throw new Error(`${message} (${violations.length}):\n${details}`);
}

runTest("tabular-region-detection production source exists and guard scans it", () => {
  const files = listProductionFiles();
  assertEqual(files.length > 8, true, `expected more than 8 production source files, scanned ${files.length}`);
});

runTest("the tabular-region-detection barrel never exports an internal profile, key builder, fingerprint, canonicalizer, message catalog, pure detection module, test bridge or dependency seam", () => {
  const content = readFileSync(BARREL_FILE, "utf8");
  const violations: Violation[] = [];
  INTERNAL_MODULE_NAMES.forEach((moduleName) => {
    if (content.includes(moduleName)) {
      violations.push({ file: "tabular-region-detection/index.ts", reason: `must not reference internal module "${moduleName}"` });
    }
  });
  assertNoViolations(violations, "tabular-region-detection barrel exports an internal implementation detail");
});

runTest("the domain's public barrel never re-exports the tabular-region-detection test bridge", () => {
  const content = readFileSync(DOMAIN_BARREL_FILE, "utf8");
  assertEqual(content.includes("tabular-region-detection-test-bridge"), false, "domain barrel must not export the geometric test bridge");
});

runTest("the dependency-injection failure-testing seam is never exported by any public barrel", () => {
  const violations: Violation[] = [];
  const forbiddenIdentifiers = ["TabularRegionDetectionDependencies", "detectBudgetDocumentTabularRegionsWithDependencies"];

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

runTest("the public detectBudgetDocumentTabularRegions function accepts exactly one parameter — production consumers cannot supply alternative dependencies", () => {
  const content = readFileSync(join(TABULAR_REGION_DETECTION_DIR, "detect-budget-document-tabular-regions.ts"), "utf8");
  const match = content.match(/export function detectBudgetDocumentTabularRegions\(\s*([^)]*)\)/);
  assertEqual(match !== null, true, "expected to find the public detectBudgetDocumentTabularRegions function signature");
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
  assertNoViolations(violations, "tabular-region-detection production file contains forbidden vocabulary");
});

runTest("no production file reads item.text or any textual content — this Sprint never had access to text to begin with", () => {
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
  assertNoViolations(violations, "tabular-region-detection production file reads textual content");
});

runTest("no production file imports the physical read or page-location contracts directly — only the structure reconstruction result", () => {
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
  assertNoViolations(violations, "tabular-region-detection production file imports the physical read or page-location contract directly");
});

runTest("no production file mutates the input structureReconstruction (no property assignment onto the input parameter)", () => {
  const violations: Violation[] = [];
  listProductionFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    if (/input\.structureReconstruction\s*[.\[][^=]*=(?!=)/.test(content)) {
      violations.push({ file, reason: "appears to assign into input.structureReconstruction" });
    }
  });
  assertNoViolations(violations, "tabular-region-detection production file mutates its input");
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
