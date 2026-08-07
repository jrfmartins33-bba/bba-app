/**
 * Guard arquitetural do Momento 3C.2 (Sprint 21.4B.3A.3, enunciado §3.9,
 * estendido no fechamento consolidado para cobrir os novos módulos do
 * executor/orquestrador). Varre os arquivos de implementação v2
 * (`testing/discovery/local-reader-evaluation/v2/` e todo `*-v2.ts` sob
 * `evaluation-run/`) e confirma que:
 *
 * - as funções v2 GENÉRICAS (`v2/*.ts` + os módulos auxiliares de
 *   `evaluation-run/` que não são o executor nem o orquestrador — parser
 *   de argumentos, validação de entradas, comparação A×B, decisão de
 *   publicação, conteúdo externo, geração de comparação v1×v2) nunca
 *   importam a verdade de referência como DADO (`discovery-reference-truth`,
 *   os arquivos `discovery-reference-truth-page-*`, `discovery-reference-truth-columns`)
 *   nem referenciam por nome seus identificadores exportados — apenas
 *   TIPOS de `discovery-reference-truth.types` são permitidos. Somente os
 *   dois arquivos de nível executor (`run-local-reader-evaluation-v2.ts`,
 *   `orchestrate-corrected-evaluation-v2.ts`) podem importar a verdade de
 *   referência como dado;
 * - nenhum arquivo v2 (genérico ou executor) lê de volta
 *   `results/corrected-v2` ou qualquer resultado agregado já produzido
 *   (nenhuma importação circular de resultado) — exceto o orquestrador,
 *   que legitimamente lê os resultados v2 que ELE MESMO acabou de
 *   publicar para gerar `comparison-v1-v2.json`, nunca um resultado
 *   pré-existente de execução anterior;
 * - nenhum arquivo v2 (genérico ou executor) contém código/texto
 *   específico do documento Lagoa do Arroz fora de comentário
 *   explicitamente negativo (varredura por "lagoa"/"arroz" como dado,
 *   não como prosa proibindo o termo);
 * - nenhum arquivo v2 importa nem modifica código produtivo (fora de
 *   `packages/bdos-core/src/domain/*\/testing/`).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(CURRENT_DIR, "..");
const V2_DIR = join(SRC_ROOT, "domain", "budget-document-location", "tabular-region-detection", "testing", "discovery", "local-reader-evaluation", "v2");
const EVALUATION_RUN_DIR = join(SRC_ROOT, "domain", "budget-document-location", "tabular-region-detection", "testing", "discovery", "local-reader-evaluation", "evaluation-run");

/** Únicos dois arquivos autorizados a importar a verdade de referência como dado — nível executor, nunca módulo genérico. */
const EXECUTOR_LEVEL_FILE_NAMES = new Set(["run-local-reader-evaluation-v2.ts", "orchestrate-corrected-evaluation-v2.ts"]);

function listEvaluationRunV2Files(): ReadonlyArray<string> {
  return readdirSync(EVALUATION_RUN_DIR)
    .filter((entry) => entry.endsWith("-v2.ts") && !entry.endsWith(".test.ts"))
    .map((entry) => join(EVALUATION_RUN_DIR, entry));
}

function listExecutorLevelFiles(): ReadonlyArray<string> {
  return listEvaluationRunV2Files().filter((file) => EXECUTOR_LEVEL_FILE_NAMES.has(basename(file)));
}

const FORBIDDEN_REFERENCE_TRUTH_DATA_IMPORT_SUBSTRINGS = ["discovery-reference-truth-page-", "discovery-reference-truth-columns", '"./discovery-reference-truth"', '"../discovery-reference-truth"', '"../../reference-truth/discovery-reference-truth"'] as const;

const FORBIDDEN_REFERENCE_TRUTH_IDENTIFIERS = ["REFERENCE_TRUTH_BUNDLES", "REFERENCE_TRUTH_DOCUMENT", "REFERENCE_TRUTH_PAGES", "REFERENCE_TRUTH_COLUMNS", "REFERENCE_TRUTH_PAGE_46", "REFERENCE_TRUTH_PAGE_50", "REFERENCE_TRUTH_PAGE_54"] as const;

interface Violation {
  readonly file: string;
  readonly reason: string;
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) return;
  const details = violations.map((v) => `  ${v.file}: ${v.reason}`).join("\n");
  throw new Error(`${message} (${violations.length}):\n${details}`);
}

function listV2GenericFiles(): ReadonlyArray<string> {
  const files: string[] = [];
  function walk(dir: string): void {
    readdirSync(dir).forEach((entry) => {
      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath);
        return;
      }
      if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) files.push(fullPath);
    });
  }
  walk(V2_DIR);
  files.push(...listEvaluationRunV2Files().filter((file) => !EXECUTOR_LEVEL_FILE_NAMES.has(basename(file))));
  return files;
}

function runNormalGuardTests(): void {
runTest("diretório v2/ existe e o guard o varre", () => {
  const files = listV2GenericFiles();
  assertEqual(files.length > 0, true, "esperado ao menos um arquivo de implementação genérica sob local-reader-evaluation/v2/");
});

runTest("nenhuma função v2 genérica importa a verdade de referência como dado (apenas tipos são permitidos) — exclusivo do executor de avaliação", () => {
  const violations: Violation[] = [];
  const importPattern = /\bfrom\s+["']([^"']+)["']/g;

  listV2GenericFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    let match: RegExpExecArray | null = importPattern.exec(content);
    while (match !== null) {
      const specifier = match[1];
      const isTypesOnly = specifier.endsWith("discovery-reference-truth.types");
      if (!isTypesOnly) {
        FORBIDDEN_REFERENCE_TRUTH_DATA_IMPORT_SUBSTRINGS.forEach((forbidden) => {
          if (specifier.includes(forbidden.replace(/"/g, ""))) {
            violations.push({ file, reason: `importa a verdade de referência como dado ("${specifier}") — apenas o executor de avaliação pode fazer isso` });
          }
        });
      }
      match = importPattern.exec(content);
    }
  });

  assertNoViolations(violations, "função v2 genérica importa a verdade de referência como dado");
});

runTest("nenhuma função v2 genérica referencia por nome os identificadores exportados da verdade de referência", () => {
  const violations: Violation[] = [];

  listV2GenericFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    content.split("\n").forEach((line, lineIndex) => {
      const trimmed = line.trim();
      const isCommentLine = trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/**");
      if (isCommentLine) return;
      FORBIDDEN_REFERENCE_TRUTH_IDENTIFIERS.forEach((identifier) => {
        if (line.includes(identifier)) {
          violations.push({ file: `${file}:${lineIndex + 1}`, reason: `referencia identificador proibido "${identifier}": "${trimmed}"` });
        }
      });
    });
  });

  assertNoViolations(violations, "função v2 genérica referencia vocabulário de dado da verdade de referência");
});

runTest("nenhum arquivo v2 (genérico ou executor) hardcoda 'results/corrected-v2' como caminho literal fora de comentário — o destino é sempre um parâmetro explícito (--output-dir/--final-output-dir), nunca um padrão silencioso", () => {
  const violations: Violation[] = [];
  const allFiles = [...listV2GenericFiles(), ...listExecutorLevelFiles()];

  allFiles.forEach((file) => {
    const content = readFileSync(file, "utf8");
    content.split("\n").forEach((line, lineIndex) => {
      const trimmed = line.trim();
      const isCommentLine = trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/**");
      if (isCommentLine) return;
      if (line.includes('"results/corrected-v2"') || line.includes("'results/corrected-v2'")) {
        violations.push({ file: `${file}:${lineIndex + 1}`, reason: `hardcoda "results/corrected-v2" como caminho literal: "${trimmed}"` });
      }
    });
  });

  assertNoViolations(violations, "arquivo v2 hardcoda o antigo destino automático results/corrected-v2");
});

runTest("apenas o orquestrador lê um resultado v2 já produzido — e somente o que ele mesmo acabou de publicar na mesma execução (via finalOutputDir/runADir dinâmicos), nunca um caminho fixo de execução anterior", () => {
  const violations: Violation[] = [];
  const genericFiles = listV2GenericFiles();
  const executorFile = listExecutorLevelFiles().find((f) => basename(f) === "run-local-reader-evaluation-v2.ts");
  assertEqual(executorFile !== undefined, true, "esperado encontrar run-local-reader-evaluation-v2.ts");

  [...genericFiles, executorFile!].forEach((file) => {
    const content = readFileSync(file, "utf8");
    content.split("\n").forEach((line, lineIndex) => {
      const readsFile = line.includes("readFileSync") || /\bfrom\s+["']/.test(line) || line.includes("require(");
      const mentionsPublishedResult = line.includes("aggregate-summary") || line.includes("-evaluation-result");
      if (readsFile && mentionsPublishedResult) {
        violations.push({ file: `${file}:${lineIndex + 1}`, reason: `lê um resultado v2 já produzido fora do orquestrador: "${line.trim()}"` });
      }
    });
  });

  assertNoViolations(violations, "arquivo v2 genérico ou o executor de avaliação (não o orquestrador) lê um resultado v2 já produzido");
});

runTest("nenhum arquivo v2 (genérico ou executor) contém texto do documento Lagoa do Arroz fora de prosa proibindo o termo", () => {
  const violations: Violation[] = [];
  const allFiles = [...listV2GenericFiles(), ...listExecutorLevelFiles()];
  // Frases que citam o termo apenas para PROIBI-LO em comentário/prosa —
  // nunca contam como violação. Qualquer outra ocorrência conta.
  const NEGATIVE_CONTEXT_MARKERS = ["nenhum código/descrição do lagoa do arroz", "documento lagoa do arroz)", "fora de prosa proibindo"];

  allFiles.forEach((file) => {
    const content = readFileSync(file, "utf8").toLowerCase();
    if (!content.includes("lagoa") && !content.includes("arroz")) return;
    const isOnlyNegativeContext = NEGATIVE_CONTEXT_MARKERS.some((marker) => content.includes(marker));
    if (!isOnlyNegativeContext) {
      violations.push({ file, reason: "contém referência a 'lagoa'/'arroz' fora do contexto de prosa proibindo o termo" });
    }
  });

  assertNoViolations(violations, "arquivo v2 contém texto do documento real fora de prosa proibindo o termo");
});

runTest("nenhum arquivo v2 importa código produtivo (fora de domain/*/testing/)", () => {
  const violations: Violation[] = [];
  const importPattern = /\bfrom\s+["']([^"']+)["']/g;
  const allFiles = [...listV2GenericFiles(), ...listExecutorLevelFiles()];

  allFiles.forEach((file) => {
    const content = readFileSync(file, "utf8");
    let match: RegExpExecArray | null = importPattern.exec(content);
    while (match !== null) {
      const specifier = match[1];
      const isRelative = specifier.startsWith(".");
      const isNodeBuiltin = specifier.startsWith("node:");
      if (isRelative && !isNodeBuiltin) {
        const resolved = resolve(dirname(file), specifier);
        const isUnderTesting = resolved.split(/[\\/]/).includes("testing");
        if (!isUnderTesting) {
          violations.push({ file, reason: `importa fora de domain/*/testing/: "${specifier}" (resolvido: ${resolved})` });
        }
      }
      match = importPattern.exec(content);
    }
  });

  assertNoViolations(violations, "arquivo v2 importa código fora da árvore de testing/ (possível código produtivo)");
});
}

if (process.env.BDOS_SANITIZED_VALIDATION === "1") {
  runTest("protected artifacts are absent in sanitized validation environment", () => {
    assertEqual(existsSync(V2_DIR), false, "local-reader-evaluation/v2 must not exist in sanitized validation environment");
  });
} else {
  runNormalGuardTests();
}
