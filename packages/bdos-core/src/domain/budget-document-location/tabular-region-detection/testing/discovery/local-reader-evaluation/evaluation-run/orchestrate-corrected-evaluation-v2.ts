/**
 * Orquestrador do fechamento consolidado (Sprint 21.4B.3A.3, §4.4-§8).
 * Valida as 12 entradas brutas ANTES de qualquer execução, executa o
 * avaliador v2 duas vezes em diretórios temporários independentes
 * (processos separados — nunca no mesmo processo, nunca compartilhando
 * estado), compara semanticamente, e só publica no diretório final
 * quando ambas as checagens passam. Gera também a comparação v1×v2
 * mecânica. Nunca escreve `results/corrected-v2/` como destino
 * hardcoded — o destino final é sempre um argumento explícito.
 *
 * Convenção de execução:
 *   cd packages/bdos-core && npx tsx
 *     .../evaluation-run/orchestrate-corrected-evaluation-v2.ts
 *     --final-output-dir <caminho>
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { validateRawAcquisitionInputs } from "./validate-raw-inputs-v2";
import { compareCanonicalRunDirectories } from "./compare-canonical-runs-v2";
import { decidePublicationV2 } from "./decide-publication-v2";
import { buildComparisonRowsV1V2 } from "./generate-comparison-v1-v2";
import { parseFinalOutputDirArg } from "./parse-final-output-dir-arg-v2";

const BDOS_CORE_DIR = resolve(process.cwd());
const PRIVATE_ACQUISITION_DIR = resolve(BDOS_CORE_DIR, "..", "..", "private", "local-reader-acquisition");
const V1_RESULTS_DIR = resolve(BDOS_CORE_DIR, "src/domain/budget-document-location/tabular-region-detection/testing/discovery/local-reader-evaluation/results");
const EXECUTOR_PATH = resolve(
  BDOS_CORE_DIR,
  "src/domain/budget-document-location/tabular-region-detection/testing/discovery/local-reader-evaluation/evaluation-run/run-local-reader-evaluation-v2.ts",
);

/**
 * Resolve o CLI do `tsx` diretamente (via `require.resolve`, o mesmo
 * `tsx` já usado por toda a cadeia `pnpm test`/`npx tsx` do
 * repositório — nenhuma instalação nova) e invoca com
 * `process.execPath` (o próprio `node`), nunca via `npx`/shell. Isso
 * evita simultaneamente o `EINVAL` do Windows ao invocar `.cmd` por
 * `execFileSync` sem shell, e a quebra de quoting que `shell: true`
 * causaria no caminho do repositório (contém espaço em "BBA APP") — um
 * array de argumentos para `execFileSync` sem shell é passado ao
 * processo filho exatamente como está, sem nenhuma re-tokenização por
 * espaços.
 */
const TSX_CLI_PATH = createRequire(import.meta.url).resolve("tsx/cli");

function runExecutorOnce(outputDir: string): void {
  mkdirSync(outputDir, { recursive: true });
  execFileSync(process.execPath, [TSX_CLI_PATH, EXECUTOR_PATH, "--output-dir", outputDir], { cwd: BDOS_CORE_DIR, stdio: "inherit" });
}

function main(): void {
  const finalOutputDir = resolve(parseFinalOutputDirArg(process.argv.slice(2)));

  // 1. Validação das 12 entradas — ANTES de qualquer execução dos adaptadores.
  const manifestPath = join(V1_RESULTS_DIR, "raw-acquisition-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const rawValidation = validateRawAcquisitionInputs(PRIVATE_ACQUISITION_DIR, manifest);
  if (!rawValidation.overallValid) {
    console.error(JSON.stringify(rawValidation, null, 2));
    throw new Error("orchestrate-corrected-evaluation-v2: validação das 12 entradas brutas falhou — abortando antes de qualquer execução real.");
  }
  console.log("Validação das 12 entradas brutas: OK");

  // 2-3. Duas execuções independentes, processos separados, diretórios temporários distintos.
  const stagingRoot = mkdtempSync(join(tmpdir(), "local-reader-v2-"));
  const runADir = join(stagingRoot, "run-a");
  const runBDir = join(stagingRoot, "run-b");
  console.log(`Execução A: ${runADir}`);
  runExecutorOnce(runADir);
  console.log(`Execução B: ${runBDir}`);
  runExecutorOnce(runBDir);

  // 4. Comparação semântica A×B.
  const repetitionValidation = compareCanonicalRunDirectories(runADir, runBDir);
  console.log(`Determinismo A×B: ${repetitionValidation.identical ? "idêntico" : "DIVERGENTE"}`);

  const decision = decidePublicationV2(rawValidation, repetitionValidation);
  if (!decision.shouldPublish) {
    console.error(JSON.stringify({ rawValidation, repetitionValidation, decision }, null, 2));
    throw new Error(`orchestrate-corrected-evaluation-v2: ${decision.reason}`);
  }

  // 5. Publicação segura: copia o conjunto canônico de A (idêntico a B,
  // comprovado acima) para o diretório final — só alcançável quando a
  // decisão acima é positiva.
  mkdirSync(finalOutputDir, { recursive: true });
  readdirSync(runADir).forEach((file) => {
    copyFileSync(join(runADir, file), join(finalOutputDir, file));
  });
  writeFileSync(join(finalOutputDir, "raw-input-validation.v2.json"), JSON.stringify(rawValidation, null, 2), "utf8");
  writeFileSync(join(finalOutputDir, "run-repetition-validation.v2.json"), JSON.stringify(repetitionValidation, null, 2), "utf8");

  // 6. Comparação v1×v2 mecânica — lê os resultados v1 já versionados
  // (nunca alterados) e os resultados v2 recém-publicados.
  const v1Docling = JSON.parse(readFileSync(join(V1_RESULTS_DIR, "docling-evaluation-result.json"), "utf8"));
  const v1PaddleOcr = JSON.parse(readFileSync(join(V1_RESULTS_DIR, "paddleocr-evaluation-result.json"), "utf8"));
  const v2Docling = JSON.parse(readFileSync(join(finalOutputDir, "docling-evaluation-result.v2.json"), "utf8"));
  const v2PaddleOcr = JSON.parse(readFileSync(join(finalOutputDir, "paddleocr-evaluation-result.v2.json"), "utf8"));
  const comparisonRows = [...buildComparisonRowsV1V2("docling", v1Docling, v2Docling), ...buildComparisonRowsV1V2("paddleocr", v1PaddleOcr, v2PaddleOcr)];
  writeFileSync(join(finalOutputDir, "comparison-v1-v2.json"), JSON.stringify(comparisonRows, null, 2), "utf8");

  // Limpeza do diretório de staging temporário — nunca versionado, nunca
  // publicado, apenas um espaço de trabalho descartável.
  rmSync(stagingRoot, { recursive: true, force: true });

  console.log(`Publicado com sucesso em ${finalOutputDir}`);
}

main();
