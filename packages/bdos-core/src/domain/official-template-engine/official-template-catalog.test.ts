declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  OfficialTemplateCatalogDocumentType,
  findOfficialTemplateCatalogEntry,
  getOfficialTemplateCatalog,
  isSupportedOfficialDocumentType,
  listActiveOfficialTemplateCatalogEntries,
  summarizeOfficialTemplateCatalog,
} from "./index";

runTest("catalog loads with the twelve minimum document types", () => {
  const catalog = getOfficialTemplateCatalog();

  assertEqual(catalog.length, 12, "expected the catalog to have exactly 12 entries");

  const expectedTypes = [
    OfficialTemplateCatalogDocumentType.MeasurementBulletin,
    OfficialTemplateCatalogDocumentType.PhotoReport,
    OfficialTemplateCatalogDocumentType.TechnicalReport,
    OfficialTemplateCatalogDocumentType.WorkOrder,
    OfficialTemplateCatalogDocumentType.ReceivingTerm,
    OfficialTemplateCatalogDocumentType.TechnicalOpinion,
    OfficialTemplateCatalogDocumentType.OfficialLetter,
    OfficialTemplateCatalogDocumentType.ProjectCover,
    OfficialTemplateCatalogDocumentType.ExecutionReport,
    OfficialTemplateCatalogDocumentType.Checklist,
    OfficialTemplateCatalogDocumentType.InspectionReport,
    OfficialTemplateCatalogDocumentType.FieldReport,
  ];

  expectedTypes.forEach((documentType) => {
    assertEqual(
      catalog.some((entry) => entry.documentType === documentType),
      true,
      `expected catalog to contain document type ${documentType}`,
    );
  });
});

runTest("every entry has the minimum required fields populated", () => {
  const catalog = getOfficialTemplateCatalog();

  catalog.forEach((entry) => {
    assertEqual(isBlank(entry.displayName), false, `entry ${entry.documentType} missing displayName`);
    assertEqual(isBlank(entry.description), false, `entry ${entry.documentType} missing description`);
    assertEqual(isBlank(entry.defaultVersion), false, `entry ${entry.documentType} missing defaultVersion`);
    assertEqual(
      Array.isArray(entry.recommendedSections),
      true,
      `entry ${entry.documentType} recommendedSections must never be null`,
    );
    assertEqual(
      Array.isArray(entry.recommendedRequiredFields),
      true,
      `entry ${entry.documentType} recommendedRequiredFields must never be null`,
    );
    assertEqual(typeof entry.active, "boolean", `entry ${entry.documentType} active must be boolean`);
  });
});

runTest("document types are unique across the catalog", () => {
  const catalog = getOfficialTemplateCatalog();
  const seen = new Set<string>();

  catalog.forEach((entry) => {
    assertEqual(seen.has(entry.documentType), false, `document type ${entry.documentType} is duplicated`);
    seen.add(entry.documentType);
  });
});

runTest("entries are sorted alphabetically by documentType", () => {
  const catalog = getOfficialTemplateCatalog();
  const documentTypes = catalog.map((entry) => entry.documentType);
  const sorted = [...documentTypes].sort((left, right) => left.localeCompare(right));

  assertEqual(JSON.stringify(documentTypes), JSON.stringify(sorted), "expected catalog to be alphabetically sorted");
});

runTest("finds an existing catalog entry", () => {
  const entry = findOfficialTemplateCatalogEntry(OfficialTemplateCatalogDocumentType.MeasurementBulletin);

  assertEqual(entry !== null, true, "expected to find the measurement bulletin entry");
  assertEqual(entry?.documentType, OfficialTemplateCatalogDocumentType.MeasurementBulletin, "documentType mismatch");
  assertEqual(entry?.displayName, "Boletim de Medicao", "displayName mismatch");
});

runTest("returns null for a document type outside the enum", () => {
  const entry = findOfficialTemplateCatalogEntry("NOT_A_REAL_DOCUMENT_TYPE" as OfficialTemplateCatalogDocumentType);

  assertEqual(entry, null, "expected null for an unknown document type");
});

runTest("lists only active entries", () => {
  const activeEntries = listActiveOfficialTemplateCatalogEntries();

  assertEqual(
    activeEntries.every((entry) => entry.active),
    true,
    "expected every listed entry to be active",
  );
  assertEqual(
    activeEntries.some((entry) => entry.documentType === OfficialTemplateCatalogDocumentType.Checklist),
    false,
    "expected the inactive Checklist entry to be excluded",
  );
  assertEqual(activeEntries.length < getOfficialTemplateCatalog().length, true, "expected fewer active entries than total entries");
});

runTest("isSupportedOfficialDocumentType recognizes known and rejects unknown values", () => {
  assertEqual(isSupportedOfficialDocumentType("MEASUREMENT_BULLETIN"), true, "expected MEASUREMENT_BULLETIN to be supported");
  assertEqual(isSupportedOfficialDocumentType("WORK_ORDER"), true, "expected WORK_ORDER to be supported");
  assertEqual(isSupportedOfficialDocumentType("NOT_A_REAL_DOCUMENT_TYPE"), false, "expected an unknown value to be unsupported");
  assertEqual(isSupportedOfficialDocumentType(""), false, "expected an empty string to be unsupported");
});

runTest("summarizeOfficialTemplateCatalog matches catalog state", () => {
  const summary = summarizeOfficialTemplateCatalog();
  const catalog = getOfficialTemplateCatalog();

  assertEqual(summary.totalEntries, catalog.length, "totalEntries mismatch");
  assertEqual(summary.activeEntries, catalog.filter((entry) => entry.active).length, "activeEntries mismatch");
  assertEqual(summary.inactiveEntries, catalog.filter((entry) => !entry.active).length, "inactiveEntries mismatch");
  assertEqual(summary.activeEntries + summary.inactiveEntries, summary.totalEntries, "active + inactive should equal total");
});

runTest("catalog is deeply immutable", () => {
  const catalog = getOfficialTemplateCatalog();

  assertEqual(Object.isFrozen(catalog), true, "catalog array should be frozen");
  assertEqual(Object.isFrozen(catalog[0]), true, "catalog entry should be frozen");
  assertEqual(Object.isFrozen(catalog[0]!.recommendedSections), true, "recommendedSections should be frozen");
  assertEqual(Object.isFrozen(catalog[0]!.recommendedRequiredFields), true, "recommendedRequiredFields should be frozen");
});

runTest("repeated calls return independently frozen, structurally identical results", () => {
  const first = getOfficialTemplateCatalog();
  const second = getOfficialTemplateCatalog();

  assertEqual(first === second, false, "expected each call to return a fresh array instance");
  assertEqual(JSON.stringify(first), JSON.stringify(second), "expected structurally identical catalog output");
});

runTest("getOfficialTemplateCatalog is deterministic across calls", () => {
  const first = JSON.stringify(getOfficialTemplateCatalog());
  const second = JSON.stringify(getOfficialTemplateCatalog());
  const third = JSON.stringify(getOfficialTemplateCatalog());

  assertEqual(first, second, "expected deterministic catalog output (1 vs 2)");
  assertEqual(second, third, "expected deterministic catalog output (2 vs 3)");
});

runTest("summarizeOfficialTemplateCatalog is deterministic across calls", () => {
  const first = JSON.stringify(summarizeOfficialTemplateCatalog());
  const second = JSON.stringify(summarizeOfficialTemplateCatalog());

  assertEqual(first, second, "expected deterministic summary output");
});

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourcePath = resolve(process.cwd(), "src", "domain", "official-template-engine", "official-template-catalog.ts");
  const sourceCode = readFileSync(sourcePath, "utf8").toLowerCase();

  [
    "date.now(",
    "math.random(",
    "crypto.randomuuid",
    "uuid()",
    "measurement-workspace",
    "approval-workflow",
    "export-engine",
    "decision-case",
    "engines/decision",
    "business-fact",
    "react",
    "next",
    "supabase",
    "\"fs\"",
    "'fs'",
    "node:fs",
    "\"path\"",
    "'path'",
    "node:path",
    "pdf-lib",
    "pdfkit",
    "from \"docx\"",
    "from 'docx'",
    "throw ",
  ].forEach((forbidden) => {
    assertEqual(
      sourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in domain source: ${forbidden}`,
    );
  });
});

function isBlank(value: string): boolean {
  return value.trim().length === 0;
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
