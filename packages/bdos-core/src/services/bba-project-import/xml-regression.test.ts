import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildBbaProjectImportSnapshot } from "./index";

/**
 * BBA Project Studio — Sprint 1, Regra Crítica (PARTE 8).
 *
 * Guarda de regressão dedicada: o fluxo XML do Sprint Zero
 * (`buildBbaProjectImportSnapshot`, inalterado nesta sprint) precisa
 * continuar produzindo exatamente os mesmos números para o cronograma
 * de exemplo real usado em produção
 * (`apps/web/public/samples/cronograma-exemplo.xml`) — 12 atividades,
 * 9 objetos espaciais, 9 decisões, 9 recomendações, caminho crítico de
 * 41 dias, zero erros. Se qualquer um destes números mudar, este teste
 * falha imediatamente.
 */
const currentDir = dirname(fileURLToPath(import.meta.url));
const sampleXmlPath = resolve(currentDir, "../../../../../apps/web/public/samples/cronograma-exemplo.xml");
const sampleXml = readFileSync(sampleXmlPath, "utf8");

const baseInput = {
  xml: sampleXml,
  organizationId: "organization-alpha-engenharia",
  contractId: "contract-lagoa-do-arroz-001",
  projectId: "project-lagoa-do-arroz",
  tenantId: "tenant-alpha-engenharia",
  capability: "geospatial-intelligence",
  generatedAt: "2026-07-06T09:00:00.000Z",
  correlationId: "xml-regression-correlation-001",
  actor: "bba-project-import",
  occurredAt: "2026-07-06T09:00:00.000Z",
  asOfDate: "2026-07-06"
};

runTest("XML sample schedule preserves the exact production numbers (Sprint Zero baseline)", () => {
  const result = buildBbaProjectImportSnapshot(baseInput);

  assertEqual(result.success, true, "expected import success");
  assertEqual(result.activities.length, 12, "activity count regression: expected 12");
  assertEqual(result.spatialObjects.length, 9, "spatial object count regression: expected 9");
  assertEqual(result.decisions.length, 9, "decision count regression: expected 9");
  assertEqual(result.recommendations.length, 9, "recommendation count regression: expected 9");
  assertEqual(result.criticalPath.projectDurationDays, 41, "critical path duration regression: expected 41");
  assertEqual(result.errors.length, 0, "errors regression: expected zero errors");
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
