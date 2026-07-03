declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  OfficialTemplateCatalogDocumentType,
  findOfficialTemplateLibraryEntry,
  getOfficialTemplateLibrary,
  listActiveOfficialTemplateLibrary,
  listTemplatesByDocumentType,
  summarizeOfficialTemplateLibrary,
} from "./index";

runTest("library loads with entries for every catalog document type used", () => {
  const library = getOfficialTemplateLibrary();

  assertEqual(library.length, 12, "expected 12 library entries");
  library.forEach((entry) => {
    assertEqual(isBlank(entry.id), false, `entry missing id: ${JSON.stringify(entry)}`);
    assertEqual(isBlank(entry.name), false, `entry ${entry.id} missing name`);
    assertEqual(isBlank(entry.description), false, `entry ${entry.id} missing description`);
    assertEqual(isBlank(entry.version), false, `entry ${entry.id} missing version`);
    assertEqual(Array.isArray(entry.tags), true, `entry ${entry.id} tags must never be null`);
    assertEqual(typeof entry.active, "boolean", `entry ${entry.id} active must be boolean`);
    assertEqual(entry.composition.rootBlocks.length > 0, true, `entry ${entry.id} must have a non-trivial composition`);
  });
});

runTest("all library entry ids are unique", () => {
  const library = getOfficialTemplateLibrary();
  const seen = new Set<string>();

  library.forEach((entry) => {
    assertEqual(seen.has(entry.id), false, `id ${entry.id} is duplicated`);
    seen.add(entry.id);
  });
});

runTest("all library entry names are unique", () => {
  const library = getOfficialTemplateLibrary();
  const seen = new Set<string>();

  library.forEach((entry) => {
    assertEqual(seen.has(entry.name), false, `name ${entry.name} is duplicated`);
    seen.add(entry.name);
  });
});

runTest("entries are sorted alphabetically by name", () => {
  const library = getOfficialTemplateLibrary();
  const names = library.map((entry) => entry.name);
  const sorted = [...names].sort((left, right) => left.localeCompare(right));

  assertEqual(JSON.stringify(names), JSON.stringify(sorted), "expected library to be sorted alphabetically by name");
});

runTest("every documentType exists in the catalog", () => {
  const library = getOfficialTemplateLibrary();
  const knownTypes = new Set(Object.values(OfficialTemplateCatalogDocumentType));

  library.forEach((entry) => {
    assertEqual(knownTypes.has(entry.documentType), true, `entry ${entry.id} references unknown documentType ${entry.documentType}`);
  });
});

runTest("finds an existing library entry by id", () => {
  const entry = findOfficialTemplateLibraryEntry("lib-measurement-bulletin-v1");

  assertEqual(entry !== null, true, "expected to find the measurement bulletin library entry");
  assertEqual(entry?.id, "lib-measurement-bulletin-v1", "id mismatch");
  assertEqual(entry?.documentType, OfficialTemplateCatalogDocumentType.MeasurementBulletin, "documentType mismatch");
});

runTest("returns null for an unknown library entry id", () => {
  const entry = findOfficialTemplateLibraryEntry("does-not-exist");

  assertEqual(entry, null, "expected null for an unknown library entry id");
});

runTest("lists only active library entries", () => {
  const activeEntries = listActiveOfficialTemplateLibrary();

  assertEqual(
    activeEntries.every((entry) => entry.active),
    true,
    "expected every listed entry to be active",
  );
  assertEqual(
    activeEntries.some((entry) => entry.id === "lib-checklist-v1"),
    false,
    "expected the inactive Checklist library entry to be excluded",
  );
  assertEqual(activeEntries.length < getOfficialTemplateLibrary().length, true, "expected fewer active entries than total entries");
});

runTest("listTemplatesByDocumentType filters correctly", () => {
  const measurementEntries = listTemplatesByDocumentType(OfficialTemplateCatalogDocumentType.MeasurementBulletin);

  assertEqual(measurementEntries.length, 1, "expected exactly one measurement bulletin library entry");
  assertEqual(measurementEntries[0]?.documentType, OfficialTemplateCatalogDocumentType.MeasurementBulletin, "documentType mismatch");

  const workOrderEntries = listTemplatesByDocumentType(OfficialTemplateCatalogDocumentType.WorkOrder);
  assertEqual(workOrderEntries.length, 1, "expected exactly one work order library entry");

  const noneMatching = listTemplatesByDocumentType("NOT_A_REAL_TYPE" as OfficialTemplateCatalogDocumentType);
  assertEqual(noneMatching.length, 0, "expected zero matches for an unrecognized document type");
});

runTest("every entry's composition is structurally valid", () => {
  const library = getOfficialTemplateLibrary();

  library.forEach((entry) => {
    const ids = new Set<string>();
    entry.composition.rootBlocks.forEach((block) => {
      assertEqual(ids.has(block.id), false, `duplicate block id ${block.id} inside entry ${entry.id}`);
      ids.add(block.id);
      assertEqual(Number.isInteger(block.order) && block.order > 0, true, `invalid order in entry ${entry.id}`);
    });
  });
});

runTest("summarizeOfficialTemplateLibrary matches library state", () => {
  const summary = summarizeOfficialTemplateLibrary();
  const library = getOfficialTemplateLibrary();

  assertEqual(summary.totalEntries, library.length, "totalEntries mismatch");
  assertEqual(summary.activeEntries, library.filter((entry) => entry.active).length, "activeEntries mismatch");
  assertEqual(summary.inactiveEntries, library.filter((entry) => !entry.active).length, "inactiveEntries mismatch");
  assertEqual(summary.activeEntries + summary.inactiveEntries, summary.totalEntries, "active + inactive should equal total");
  assertEqual(summary.documentTypesCovered, 12, "expected all 12 document types to be covered");
});

runTest("library is deeply immutable", () => {
  const library = getOfficialTemplateLibrary();

  assertEqual(Object.isFrozen(library), true, "library array should be frozen");
  assertEqual(Object.isFrozen(library[0]), true, "library entry should be frozen");
  assertEqual(Object.isFrozen(library[0]!.tags), true, "tags should be frozen");
  assertEqual(Object.isFrozen(library[0]!.composition), true, "composition should be frozen");
  assertEqual(Object.isFrozen(library[0]!.composition.rootBlocks), true, "composition rootBlocks should be frozen");
});

runTest("filtered results (active / by documentType) are also frozen", () => {
  const activeEntries = listActiveOfficialTemplateLibrary();
  const byType = listTemplatesByDocumentType(OfficialTemplateCatalogDocumentType.MeasurementBulletin);

  assertEqual(Object.isFrozen(activeEntries), true, "active entries array should be frozen");
  assertEqual(Object.isFrozen(byType), true, "documentType-filtered array should be frozen");
});

runTest("getOfficialTemplateLibrary is deterministic across calls", () => {
  const first = JSON.stringify(getOfficialTemplateLibrary());
  const second = JSON.stringify(getOfficialTemplateLibrary());
  const third = JSON.stringify(getOfficialTemplateLibrary());

  assertEqual(first, second, "expected deterministic library output (1 vs 2)");
  assertEqual(second, third, "expected deterministic library output (2 vs 3)");
});

runTest("summarizeOfficialTemplateLibrary is deterministic across calls", () => {
  const first = JSON.stringify(summarizeOfficialTemplateLibrary());
  const second = JSON.stringify(summarizeOfficialTemplateLibrary());

  assertEqual(first, second, "expected deterministic summary output");
});

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourcePath = resolve(process.cwd(), "src", "domain", "official-template-engine", "official-template-library.ts");
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
    "engineering-contract",
    "engineering-project-context",
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
  ].forEach((forbidden) => {
    assertEqual(
      sourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in domain source: ${forbidden}`,
    );
  });
});

runTest("only intra-domain sibling modules are imported (catalog, composition, shared)", () => {
  const sourcePath = resolve(process.cwd(), "src", "domain", "official-template-engine", "official-template-library.ts");
  const sourceCode = readFileSync(sourcePath, "utf8");
  const importSources = [...sourceCode.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  const allowedSiblings = new Set([
    "./official-template-catalog",
    "./official-template-composition",
    "./official-template-shared",
  ]);

  assertEqual(importSources.length > 0, true, "expected the library module to have at least one import");

  importSources.forEach((source) => {
    assertEqual(allowedSiblings.has(source), true, `unexpected import outside the allowed sibling modules: ${source}`);
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
