import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pdfjsPhysicalDocumentReader } from "../src/infrastructure/budget-document-location/pdfjs/pdfjs-physical-document-reader";
import type { PhysicalDocumentReadResult } from "../src/domain/budget-document-location/physical-document-read.types";
import { observeDocumentSignals, locateBudgetDocumentPages, reconstructBudgetDocumentStructure } from "../src/domain/budget-document-location";
import { buildCandidatePageEvidence, candidateH3cPairedEdgeEnvelope } from "../src/domain/budget-document-location/tabular-region-detection/testing/discovery/h3c/discovery-candidate-h3c-hypothesis";
import { H3C_REAL_MANIFEST } from "../src/domain/budget-document-location/tabular-region-detection/testing/discovery/h3c/discovery-h3c-real-manifest";
import { H3C_REAL_MANIFEST_SOURCE_FINGERPRINT_SHA256 } from "../src/domain/budget-document-location/tabular-region-detection/testing/discovery/h3c/discovery-h3c-real-manifest.types";

/**
 * Avaliação de H3c contra o manifesto real congelado e aprovado (Sprint
 * 21.4B.3A.1, §10.3 do enunciado). NUNCA passa `textLocatorForHumanAudit`
 * à candidata — apenas identidade (`realPageNumber`, `lineKey`), ordem e
 * geometria (derivada da reconstrução real). Consulta a expectativa
 * (`label`) somente para CLASSIFICAR o resultado observado — nunca para
 * influenciar a decisão da candidata.
 *
 * NUNCA roda em CI. NUNCA recebe caminho hardcoded. Saída completa em
 * `/private/`, já ignorado pelo Git.
 */

function sliceReadResult(full: PhysicalDocumentReadResult, range: readonly [number, number]): { readonly result: PhysicalDocumentReadResult; readonly offset: number } {
  const [start, end] = range;
  const selected = full.pages.filter((p) => p.pageNumber >= start && p.pageNumber <= end).sort((a, b) => a.pageNumber - b.pageNumber);
  const offset = start - 1;
  const pages = selected.map((p, i) => ({ ...p, pageNumber: i + 1 }));
  return { result: { ...full, pages, totalPageCount: pages.length }, offset };
}

type Outcome = "acerto" | "falso_positivo" | "falso_negativo" | "evidencia_insuficiente" | "incerto";

function classify(label: "must_include" | "must_exclude" | "uncertain", decision: string): Outcome {
  if (label === "uncertain") return "incerto";
  if (decision === "insufficient_evidence") return "evidencia_insuficiente";
  if (decision === label) return "acerto";
  if (label === "must_include" && decision === "must_exclude") return "falso_negativo";
  if (label === "must_exclude" && decision === "must_include") return "falso_positivo";
  throw new Error(`combinação inesperada: label=${label} decision=${decision}`);
}

async function main() {
  const pdfPathArg = process.argv[2];
  if (!pdfPathArg) {
    console.error("uso: evaluate-h3c-real-manifest.ts <caminho-do-pdf>");
    process.exit(1);
  }

  const bytes = readFileSync(resolve(pdfPathArg));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  console.log(`sha256: ${sha256}`);
  if (sha256 !== H3C_REAL_MANIFEST_SOURCE_FINGERPRINT_SHA256) {
    console.error(`FINGERPRINT NÃO CONFERE — esperado ${H3C_REAL_MANIFEST_SOURCE_FINGERPRINT_SHA256}`);
    process.exit(1);
  }

  const full = await pdfjsPhysicalDocumentReader.read(new Uint8Array(bytes));
  const { result: physicalRead, offset } = sliceReadResult(full, [46, 54]);
  const observation = observeDocumentSignals(physicalRead);
  const pageLocation = locateBudgetDocumentPages(observation);
  const structureReconstruction = reconstructBudgetDocumentStructure({ physicalRead, pageLocation });
  console.log(`reconstrução estrutural: ${structureReconstruction.status}`);

  const evidenceByPage = new Map<number, ReturnType<typeof buildCandidatePageEvidence>>();
  structureReconstruction.groups.forEach((g) => {
    g.pages.forEach((page) => {
      evidenceByPage.set(page.pageNumber + offset, buildCandidatePageEvidence(page));
    });
  });

  interface Row {
    readonly id: string;
    readonly realPageNumber: number;
    readonly lineKey: string;
    readonly label: string;
    readonly annotationRuleId: string;
    readonly coverageTags: ReadonlyArray<string>;
    readonly decision: string;
    readonly outcome: Outcome;
  }

  const rows: Row[] = [];
  let missingLine = 0;

  H3C_REAL_MANIFEST.forEach((entry) => {
    const evidence = evidenceByPage.get(entry.realPageNumber);
    if (!evidence) {
      missingLine += 1;
      return;
    }
    const lineExists = evidence.lines.some((l) => l.lineKey === entry.lineKey);
    if (!lineExists) {
      missingLine += 1;
      return;
    }
    const decision = candidateH3cPairedEdgeEnvelope(evidence, entry.lineKey);
    const outcome = classify(entry.label, decision);
    rows.push({
      id: entry.id,
      realPageNumber: entry.realPageNumber,
      lineKey: entry.lineKey,
      label: entry.label,
      annotationRuleId: entry.annotationRuleId,
      coverageTags: entry.coverageTags,
      decision,
      outcome,
    });
  });

  console.log(`\ntotal manifesto: ${H3C_REAL_MANIFEST.length}`);
  console.log(`linhas não encontradas na reconstrução (deveria ser 0): ${missingLine}`);
  console.log(`total avaliado: ${rows.length}`);

  const totals: Record<Outcome, number> = { acerto: 0, falso_positivo: 0, falso_negativo: 0, evidencia_insuficiente: 0, incerto: 0 };
  rows.forEach((r) => { totals[r.outcome] += 1; });
  console.log(`\n=== totais gerais ===`);
  console.log(JSON.stringify(totals, null, 1));

  console.log(`\n=== totais por página ===`);
  const byPage = new Map<number, Record<Outcome, number>>();
  rows.forEach((r) => {
    if (!byPage.has(r.realPageNumber)) byPage.set(r.realPageNumber, { acerto: 0, falso_positivo: 0, falso_negativo: 0, evidencia_insuficiente: 0, incerto: 0 });
    byPage.get(r.realPageNumber)![r.outcome] += 1;
  });
  [...byPage.entries()].sort((a, b) => a[0] - b[0]).forEach(([page, t]) => console.log(`página ${page}: ${JSON.stringify(t)}`));

  console.log(`\n=== totais por etiqueta de cobertura ===`);
  const allTags = new Set<string>();
  rows.forEach((r) => r.coverageTags.forEach((t) => allTags.add(t)));
  [...allTags].sort().forEach((tag) => {
    const subset = rows.filter((r) => r.coverageTags.includes(tag));
    const t: Record<Outcome, number> = { acerto: 0, falso_positivo: 0, falso_negativo: 0, evidencia_insuficiente: 0, incerto: 0 };
    subset.forEach((r) => { t[r.outcome] += 1; });
    console.log(`${tag} (${subset.length}): ${JSON.stringify(t)}`);
  });

  console.log(`\n=== totais por annotationRuleId ===`);
  const allRules = new Set(rows.map((r) => r.annotationRuleId));
  [...allRules].sort().forEach((rule) => {
    const subset = rows.filter((r) => r.annotationRuleId === rule);
    const t: Record<Outcome, number> = { acerto: 0, falso_positivo: 0, falso_negativo: 0, evidencia_insuficiente: 0, incerto: 0 };
    subset.forEach((r) => { t[r.outcome] += 1; });
    console.log(`${rule} (${subset.length}): ${JSON.stringify(t)}`);
  });

  const failures = rows.filter((r) => r.outcome === "falso_positivo" || r.outcome === "falso_negativo" || r.outcome === "evidencia_insuficiente");
  console.log(`\n=== casos não aprovados (${failures.length}) ===`);
  failures.forEach((r) => console.log(`${r.id} | página ${r.realPageNumber} | rótulo=${r.label} | decisão=${r.decision} | outcome=${r.outcome} | regra=${r.annotationRuleId}`));

  const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../private/tabular-membership-discovery");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `h3c-evaluation-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify({ sha256, totals, rows, missingLine }, null, 2), "utf8");
  console.log(`\nrelatório completo salvo em: ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
