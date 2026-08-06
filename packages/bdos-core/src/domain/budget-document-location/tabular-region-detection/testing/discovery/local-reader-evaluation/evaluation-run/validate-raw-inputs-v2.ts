/**
 * Sprint 21.4B.3A.3 — fechamento consolidado. Validação das 12 entradas
 * brutas (2 ferramentas × 3 páginas × 2 execuções) contra
 * `raw-acquisition-manifest.json`, ANTES de qualquer adaptador ser
 * chamado. Nunca recria arquivo ausente; nunca reexecuta leitor —
 * apenas lê e compara bytes/metadados já existentes.
 *
 * `acquisitionDir` e `manifest` são parâmetros explícitos (nunca
 * caminhos hardcoded) para que os testes sintéticos (Sprint §9) possam
 * apontar para diretórios temporários fabricados, sem tocar em
 * `private/local-reader-acquisition/` real.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

export type LocalReaderToolV2 = "docling" | "paddleocr";

const EXPECTED_TOOLS: ReadonlyArray<LocalReaderToolV2> = ["docling", "paddleocr"];
const EXPECTED_PAGES = [46, 50, 54] as const;
const EXPECTED_RUNS = [1, 2] as const;

export interface RawInputValidationEntryV2 {
  readonly relativePath: string;
  readonly tool: LocalReaderToolV2;
  readonly realPageNumber: number;
  readonly runIndex: number;
  readonly expectedSha256: string | null;
  readonly actualSha256: string | null;
  readonly hashMatch: boolean;
  readonly toolVersionMatch: boolean;
  readonly finalStateOk: boolean;
  readonly essentialMetadataOk: boolean;
  readonly present: boolean;
  readonly issues: ReadonlyArray<string>;
}

export interface RawInputValidationResultV2 {
  readonly expectedCount: 12;
  readonly entries: ReadonlyArray<RawInputValidationEntryV2>;
  readonly unexpectedFiles: ReadonlyArray<string>;
  readonly overallValid: boolean;
}

function expectedFileNames(tool: LocalReaderToolV2): ReadonlySet<string> {
  const names = new Set<string>();
  EXPECTED_PAGES.forEach((p) =>
    EXPECTED_RUNS.forEach((r) => {
      names.add(`${tool}_page${p}_run${r}.raw.json`);
      names.add(`${tool}_page${p}_run${r}.meta.json`);
    }),
  );
  return names;
}

export function validateRawAcquisitionInputs(acquisitionDir: string, manifest: ReadonlyArray<Record<string, unknown>>): RawInputValidationResultV2 {
  const entries: RawInputValidationEntryV2[] = [];

  EXPECTED_TOOLS.forEach((tool) => {
    EXPECTED_PAGES.forEach((realPageNumber) => {
      EXPECTED_RUNS.forEach((runIndex) => {
        const relRawPath = join(tool, `${tool}_page${realPageNumber}_run${runIndex}.raw.json`).split("\\").join("/");
        const rawPath = join(acquisitionDir, tool, `${tool}_page${realPageNumber}_run${runIndex}.raw.json`);
        const metaPath = join(acquisitionDir, tool, `${tool}_page${realPageNumber}_run${runIndex}.meta.json`);

        const manifestEntry = manifest.find((m) => m.tool === tool && m.realPageNumber === realPageNumber && m.runIndex === runIndex);
        const issues: string[] = [];

        const rawPresent = existsSync(rawPath);
        const metaPresent = existsSync(metaPath);
        if (!rawPresent) issues.push("raw output file missing");
        if (!metaPresent) issues.push("meta file missing");
        if (manifestEntry === undefined) issues.push("no matching entry in raw-acquisition-manifest.json");

        let actualSha256: string | null = null;
        if (rawPresent) {
          // Este ambiente de typecheck só aceita `readFileSync(path, "utf8")`
          // (convenção já usada em todo o executor v1) — sem overload para
          // Buffer bruto. `Buffer.from(texto, "utf8")` reconstrói os bytes
          // originais losslessly para JSON UTF-8 válido sem BOM (o formato
          // real das 12 saídas brutas), reproduzindo o mesmo SHA-256 que um
          // `readFileSync` sem encoding produziria.
          const rawText = readFileSync(rawPath, "utf8");
          actualSha256 = createHash("sha256").update(Buffer.from(rawText, "utf8")).digest("hex");
        }
        const expectedSha256 = manifestEntry !== undefined && typeof manifestEntry.rawOutputSha256 === "string" ? (manifestEntry.rawOutputSha256 as string) : null;
        const hashMatch = expectedSha256 !== null && actualSha256 !== null && expectedSha256 === actualSha256;
        if (rawPresent && expectedSha256 !== null && !hashMatch) issues.push(`hash mismatch: manifest="${expectedSha256}" actual="${actualSha256}"`);

        let toolVersionMatch = false;
        let finalStateOk = false;
        let essentialMetadataOk = false;

        if (metaPresent) {
          const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, unknown>;
          toolVersionMatch = manifestEntry !== undefined && meta.toolVersion === manifestEntry.toolVersion;
          if (!toolVersionMatch) issues.push(`toolVersion mismatch: manifest="${String(manifestEntry?.toolVersion)}" meta="${String(meta.toolVersion)}"`);

          finalStateOk = meta.finalState === "completed";
          if (!finalStateOk) issues.push(`finalState is not "completed": "${String(meta.finalState)}"`);

          essentialMetadataOk = typeof meta.rawOutputSha256 === "string" && typeof meta.configurationSummaryPt === "string" && meta.rawOutputPresent === true;
          if (!essentialMetadataOk) issues.push("essential metadata fields missing or malformed (rawOutputSha256/configurationSummaryPt/rawOutputPresent)");
        }

        entries.push({
          relativePath: relRawPath,
          tool,
          realPageNumber,
          runIndex,
          expectedSha256,
          actualSha256,
          hashMatch,
          toolVersionMatch,
          finalStateOk,
          essentialMetadataOk,
          present: rawPresent && metaPresent,
          issues,
        });
      });
    });
  });

  const unexpectedFiles: string[] = [];
  EXPECTED_TOOLS.forEach((tool) => {
    const dir = join(acquisitionDir, tool);
    if (!existsSync(dir)) return;
    const expected = expectedFileNames(tool);
    readdirSync(dir).forEach((entry) => {
      if (!expected.has(entry)) unexpectedFiles.push(join(tool, entry).split("\\").join("/"));
    });
  });

  const overallValid = entries.length === 12 && entries.every((e) => e.present && e.hashMatch && e.toolVersionMatch && e.finalStateOk && e.essentialMetadataOk) && unexpectedFiles.length === 0;

  return { expectedCount: 12, entries, unexpectedFiles, overallValid };
}
