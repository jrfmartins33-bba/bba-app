import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  detectBudgetDocumentTabularRegions,
  formBudgetDocumentPhysicalCellHypotheses,
  formBudgetDocumentPhysicalCellTextEvidence,
  locateBudgetDocumentPages,
  observeDocumentSignals,
  reconstructBudgetDocumentPhysicalColumnHypotheses,
  reconstructBudgetDocumentStructure,
} from "../../../../domain/budget-document-location";
import {
  reconstructBudgetTable,
  writeCanonicalValue,
} from "../../../../domain/budget-table-reconstruction";
import type {
  BudgetTableReconstructionInput,
  BudgetTableReconstructionResult,
} from "../../../../domain/budget-table-reconstruction";
import { pdfjsPhysicalDocumentReader } from "../index";

interface ExecutorArguments {
  readonly input: string;
  readonly expectedSha256: string;
  readonly pages: ReadonlyArray<number>;
  readonly output: string;
}

interface DiagnosticOutput {
  readonly schemaVersion: 1;
  readonly executionManifest: {
    readonly requestedPageNumbers: ReadonlyArray<number>;
    readonly canonicalSerialization: "incremental-chunks-v1";
    readonly physicalCellEvidenceAvailability: "available" | "unavailable";
    readonly columnEvidenceAvailability: "available" | "unavailable";
  };
  readonly reconstruction: BudgetTableReconstructionResult;
}

interface WrittenRun {
  readonly path: string;
  readonly canonicalFingerprint: string;
  readonly fileSha256: string;
  readonly sizeBytes: number;
  readonly peakHeapBytes: number;
  readonly status: BudgetTableReconstructionResult["status"];
  readonly completeness: BudgetTableReconstructionResult["completeness"];
  readonly pageNumbers: ReadonlyArray<number>;
  readonly recordCount: number;
  readonly cellCount: number;
  readonly structuralIssueCounts: Readonly<Record<string, number>>;
  readonly arithmeticOutcomeCounts: Readonly<Record<string, number>>;
}

function countBy(values: ReadonlyArray<string>): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
}

function parseArguments(command: ReadonlyArray<string>): ExecutorArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < command.length; index += 2) {
    const name = command[index];
    const value = command[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      throw new Error("Expected paired --name value arguments.");
    }
    values.set(name, value);
  }

  const input = values.get("--input");
  const expectedSha256 = values.get("--expected-sha256");
  const pages = values.get("--pages");
  const output = values.get("--output");
  if (!input || !expectedSha256 || !pages || !output) {
    throw new Error("Required arguments: --input, --expected-sha256, --pages, --output.");
  }
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) {
    throw new Error("Expected SHA-256 must contain 64 hexadecimal characters.");
  }
  const pageNumbers = [...new Set(pages.split(",").map((value) => Number(value.trim())))].sort(
    (left, right) => left - right,
  );
  if (
    pageNumbers.length === 0 ||
    pageNumbers.some((value) => !Number.isSafeInteger(value) || value <= 0)
  ) {
    throw new Error("Pages must be a comma-separated list of positive integers.");
  }
  return {
    input: resolve(input),
    expectedSha256: expectedSha256.toLowerCase(),
    pages: pageNumbers,
    output: resolve(output),
  };
}

async function buildReconstruction(
  path: string,
  expectedSha256: string,
  pages: ReadonlyArray<number>,
): Promise<DiagnosticOutput> {
  const file = await readFile(path);
  const bytes = new Uint8Array(file);
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== expectedSha256) {
    throw new Error(`Input SHA-256 mismatch: expected ${expectedSha256}, observed ${actualSha256}.`);
  }

  const physicalRead = await pdfjsPhysicalDocumentReader.read(bytes);
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const structureReconstruction = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  const tabularRegionDetection = detectBudgetDocumentTabularRegions({ structureReconstruction });
  const columnResult = reconstructBudgetDocumentPhysicalColumnHypotheses({
    structureReconstruction,
    tabularRegionDetection,
  });
  const columnEvidence: BudgetTableReconstructionInput["columnEvidence"] =
    columnResult.status === "failed"
      ? { availability: "unavailable", reasonCode: "physical_column_hypothesis_reconstruction_failed" }
      : { availability: "available", result: columnResult };

  let physicalCellEvidence: BudgetTableReconstructionInput["physicalCellEvidence"];
  try {
    const cellHypothesisFormation = formBudgetDocumentPhysicalCellHypotheses({
      structureReconstruction,
      tabularRegionDetection,
      physicalColumnHypothesisReconstruction: columnResult,
    });
    const cellTextEvidenceFormation = formBudgetDocumentPhysicalCellTextEvidence({
      physicalRead,
      structureReconstruction,
      physicalCellHypothesisFormation: cellHypothesisFormation,
    });
    physicalCellEvidence =
      cellHypothesisFormation.status === "failed" || cellTextEvidenceFormation.status === "failed"
        ? { availability: "unavailable", reasonCode: "physical_cell_or_text_evidence_formation_failed" }
        : { availability: "available", cellHypothesisFormation, cellTextEvidenceFormation };
  } catch {
    physicalCellEvidence = {
      availability: "unavailable",
      reasonCode: "physical_cell_or_text_evidence_formation_threw",
    };
  }

  const reconstruction = reconstructBudgetTable({
    physicalRead,
    pageLocation,
    structureReconstruction,
    pageSelection: pages,
    columnEvidence,
    physicalCellEvidence,
  });
  return {
    schemaVersion: 1,
    executionManifest: {
      requestedPageNumbers: pages,
      canonicalSerialization: "incremental-chunks-v1",
      physicalCellEvidenceAvailability: physicalCellEvidence.availability,
      columnEvidenceAvailability: columnEvidence.availability,
    },
    reconstruction,
  };
}

async function finishWritable(stream: ReturnType<typeof createWriteStream>): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    stream.once("error", rejectPromise);
    stream.end(resolvePromise);
  });
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function writeRun(args: ExecutorArguments, temporaryPath: string): Promise<WrittenRun> {
  const output = await buildReconstruction(args.input, args.expectedSha256, args.pages);
  const peakHeapBytes = process.memoryUsage().heapUsed;
  const stream = createWriteStream(temporaryPath, { encoding: "utf8" });
  await writeCanonicalValue(output, stream);
  await finishWritable(stream);
  const fileStats = await stat(temporaryPath);
  return {
    path: temporaryPath,
    canonicalFingerprint: output.reconstruction.canonicalFingerprint,
    fileSha256: await sha256File(temporaryPath),
    sizeBytes: fileStats.size,
    peakHeapBytes,
    status: output.reconstruction.status,
    completeness: output.reconstruction.completeness,
    pageNumbers: output.reconstruction.pages.map((page) => page.pageNumber),
    recordCount: output.reconstruction.records.length,
    cellCount: output.reconstruction.cells.length,
    structuralIssueCounts: countBy(
      output.reconstruction.structuralIssues.map((issue) => issue.code),
    ),
    arithmeticOutcomeCounts: countBy(
      output.reconstruction.arithmeticEvaluations.map((evaluation) => evaluation.outcome),
    ),
  };
}

async function filesEqualByChunks(leftPath: string, rightPath: string): Promise<boolean> {
  const left = await open(leftPath, "r");
  const right = await open(rightPath, "r");
  const leftBuffer = Buffer.allocUnsafe(64 * 1024);
  const rightBuffer = Buffer.allocUnsafe(64 * 1024);
  try {
    let position = 0;
    while (true) {
      const [leftRead, rightRead] = await Promise.all([
        left.read(leftBuffer, 0, leftBuffer.length, position),
        right.read(rightBuffer, 0, rightBuffer.length, position),
      ]);
      if (leftRead.bytesRead !== rightRead.bytesRead) return false;
      if (leftRead.bytesRead === 0) return true;
      if (
        !leftBuffer.subarray(0, leftRead.bytesRead).equals(
          rightBuffer.subarray(0, rightRead.bytesRead),
        )
      ) return false;
      position += leftRead.bytesRead;
    }
  } finally {
    await Promise.all([left.close(), right.close()]);
  }
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  await mkdir(dirname(args.output), { recursive: true });
  const firstTemporaryPath = `${args.output}.first.tmp`;
  const secondTemporaryPath = `${args.output}.second.tmp`;
  await Promise.all([rm(firstTemporaryPath, { force: true }), rm(secondTemporaryPath, { force: true })]);

  const first = await writeRun(args, firstTemporaryPath);
  const second = await writeRun(args, secondTemporaryPath);
  const byteIdentical = await filesEqualByChunks(first.path, second.path);
  const deterministic =
    first.canonicalFingerprint === second.canonicalFingerprint &&
    first.fileSha256 === second.fileSha256 &&
    first.sizeBytes === second.sizeBytes &&
    byteIdentical;
  if (!deterministic) {
    throw new Error("Fresh executions produced different canonical outputs.");
  }

  await rm(args.output, { force: true });
  await rename(firstTemporaryPath, args.output);
  await rm(secondTemporaryPath, { force: true });
  console.log(
    JSON.stringify({
      output: args.output,
      deterministic,
      byteIdentical,
      first,
      second,
      peakHeapBytes: Math.max(first.peakHeapBytes, second.peakHeapBytes),
    }),
  );
}

await main();
