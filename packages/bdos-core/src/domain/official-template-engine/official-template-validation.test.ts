declare const process: { cwd(): string };

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  OfficialDocumentType,
  OfficialTemplateStatus,
  ValidationSeverity,
  createOfficialTemplate,
  validateOfficialTemplate,
  validateTemplateFields,
  validateTemplatePlaceholders,
  validateTemplateSections,
  validateTemplateStructure,
  validateTemplateValidationRules,
  type CreateOfficialTemplateInput,
  type OfficialTemplate,
  type OfficialTemplateResult,
} from "./index";

const templateId = "template-boletim-medicao-001";
const templateName = "Boletim de Medicao Padrao";
const templateVersion = "1.0.0";
const actor = "engineer-marcos";
const occurredAt = "2026-07-03T09:00:00Z";
const correlationId = "official-template-validation-correlation-001";
const createdBy = "template-office";
const sourceSystem = "engineering-os";

runTest("valid template produces no errors", () => {
  const result = validateOfficialTemplate(createTemplateFixture());

  assertEqual(result.valid, true, "expected template to be valid");
  assertEqual(result.errors.length, 0, "expected no errors on a valid template");
});

runTest("valid but Draft template produces the inactive_template warning", () => {
  const result = validateOfficialTemplate(createTemplateFixture());

  assertEqual(result.valid, true, "expected valid despite the warning");
  assertEqual(
    result.warnings.some((warning) => warning.code === "inactive_template"),
    true,
    "expected an inactive_template warning on a Draft template",
  );
});

runTest("empty template produces empty_template, missing_section and missing_field errors", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    sections: [],
    fields: [],
    placeholders: [],
    validationRules: [],
  };
  const result = validateOfficialTemplate(template);

  assertEqual(result.valid, false, "expected empty template to be invalid");
  assertHasCode(result.errors, "empty_template");
  assertHasCode(result.errors, "missing_section");
  assertHasCode(result.errors, "missing_field");
  assertHasCode(result.errors, "missing_required_field");
});

runTest("template without sections fails missing_section", () => {
  const template: OfficialTemplate = { ...createTemplateFixture(), sections: [] };
  const result = validateTemplateSections(template);

  assertHasCode(result, "missing_section");
});

runTest("template without fields fails missing_field and missing_required_field", () => {
  const template: OfficialTemplate = { ...createTemplateFixture(), fields: [] };
  const result = validateTemplateFields(template);

  assertHasCode(result, "missing_field");
  assertHasCode(result, "missing_required_field");
});

runTest("a section with a blank title fails missing_name", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    sections: [{ ...createTemplateFixture().sections[0]!, title: "" }],
  };
  const result = validateTemplateSections(template);

  assertHasCode(result, "missing_name");
});

runTest("a section with no fields assigned produces a section_without_fields warning", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    sections: [
      ...createTemplateFixture().sections,
      { id: "section-2", title: "Fotos", order: 2, description: null, metadata: {} },
    ],
  };
  const issues = validateTemplateSections(template);
  const warning = issues.find((issue) => issue.code === "section_without_fields");

  assertEqual(warning !== undefined, true, "expected a section_without_fields warning");
  assertEqual(warning?.severity, ValidationSeverity.Warning, "expected warning severity");
});

runTest("negative section order fails invalid_order", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    sections: [{ ...createTemplateFixture().sections[0]!, order: -1 }],
  };
  const result = validateTemplateSections(template);

  assertHasCode(result, "invalid_order");
});

runTest("non-integer section order fails invalid_order", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    sections: [{ ...createTemplateFixture().sections[0]!, order: 1.5 }],
  };
  const result = validateTemplateSections(template);

  assertHasCode(result, "invalid_order");
});

runTest("zero section order fails invalid_order", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    sections: [{ ...createTemplateFixture().sections[0]!, order: 0 }],
  };
  const result = validateTemplateSections(template);

  assertHasCode(result, "invalid_order");
});

runTest("duplicate section orders fail duplicate_order", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    sections: [
      { id: "section-1", title: "Identificacao", order: 1, description: null, metadata: {} },
      { id: "section-2", title: "Fotos", order: 1, description: null, metadata: {} },
    ],
  };
  const result = validateTemplateSections(template);

  assertHasCode(result, "duplicate_order");
});

runTest("duplicate field keys fail duplicate_field_key", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    fields: [
      { id: "field-1", key: "field-key-1", sectionId: "section-1", label: "Responsavel", required: true, description: null, metadata: {} },
      { id: "field-2", key: "field-key-1", sectionId: "section-1", label: "Responsavel Duplicado", required: false, description: null, metadata: {} },
    ],
  };
  const result = validateTemplateFields(template);

  assertHasCode(result, "duplicate_field_key");
});

runTest("a field with a blank label fails missing_name", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    fields: [{ ...createTemplateFixture().fields[0]!, label: "" }],
  };
  const result = validateTemplateFields(template);

  assertHasCode(result, "missing_name");
});

runTest("no required field fails missing_required_field", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    fields: [{ ...createTemplateFixture().fields[0]!, required: false }],
  };
  const result = validateTemplateFields(template);

  assertHasCode(result, "missing_required_field");
});

runTest("duplicate placeholder keys fail duplicate_placeholder", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    placeholders: [
      { key: "placeholder-1", label: "A", fieldKey: "field-key-1", description: null, metadata: {} },
      { key: "placeholder-1", label: "B", fieldKey: "field-key-1", description: null, metadata: {} },
    ],
  };
  const result = validateTemplatePlaceholders(template);

  assertHasCode(result, "duplicate_placeholder");
});

runTest("a placeholder referencing an unknown field key fails missing_placeholder_reference", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    placeholders: [
      { key: "placeholder-1", label: "A", fieldKey: "unknown-field-key", description: null, metadata: {} },
    ],
  };
  const result = validateTemplatePlaceholders(template);

  assertHasCode(result, "missing_placeholder_reference");
});

runTest("a validation rule referencing an unknown field key fails invalid_validation_rule", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    validationRules: [
      {
        id: "rule-1",
        description: "Regra invalida.",
        appliesToFieldKey: "unknown-field-key",
        severity: createTemplateFixture().validationRules[0]!.severity,
        metadata: {},
      },
    ],
  };
  const result = validateTemplateValidationRules(template);

  assertHasCode(result, "invalid_validation_rule");
});

runTest("duplicate validation rule ids fail duplicate_validation_rule", () => {
  const baseRule = createTemplateFixture().validationRules[0]!;
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    validationRules: [baseRule, { ...baseRule, id: baseRule.id }],
  };
  const result = validateTemplateValidationRules(template);

  assertHasCode(result, "duplicate_validation_rule");
});

runTest("Active template produces no status warning", () => {
  const template: OfficialTemplate = { ...createTemplateFixture(), status: OfficialTemplateStatus.Active };
  const result = validateTemplateStructure(template);

  assertEqual(
    result.some((issue) => issue.code === "inactive_template" || issue.code === "deprecated_template" || issue.code === "archived_template"),
    false,
    "expected no status warning for an Active template",
  );
});

runTest("Deprecated template produces a deprecated_template warning", () => {
  const template: OfficialTemplate = { ...createTemplateFixture(), status: OfficialTemplateStatus.Deprecated };
  const result = validateTemplateStructure(template);

  assertHasCode(result, "deprecated_template");
});

runTest("Archived template produces an archived_template warning", () => {
  const template: OfficialTemplate = { ...createTemplateFixture(), status: OfficialTemplateStatus.Archived };
  const result = validateTemplateStructure(template);

  assertHasCode(result, "archived_template");
});

runTest("missing template id/name/documentType/version are all reported", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    id: "",
    name: "",
    documentType: "" as OfficialDocumentType,
    version: "",
  };
  const result = validateTemplateStructure(template);

  assertHasCode(result, "missing_id");
  assertHasCode(result, "missing_name");
  assertHasCode(result, "missing_document_type");
  assertHasCode(result, "missing_version");
});

runTest("validateOfficialTemplate performs no mutation on the aggregate", () => {
  const template = createTemplateFixture();
  const before = JSON.stringify(template);

  validateOfficialTemplate(template);

  const after = JSON.stringify(template);
  assertEqual(before, after, "expected the input template to remain untouched");
});

runTest("result is deterministic for identical input", () => {
  const template = createTemplateFixture();
  const first = JSON.stringify(validateOfficialTemplate(template));
  const second = JSON.stringify(validateOfficialTemplate(template));

  assertEqual(first, second, "expected deterministic validation output");
});

runTest("result is deeply immutable", () => {
  const result = validateOfficialTemplate(createTemplateFixture());

  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.errors), true, "errors should be frozen");
  assertEqual(Object.isFrozen(result.warnings), true, "warnings should be frozen");
  if (result.warnings.length > 0) {
    assertEqual(Object.isFrozen(result.warnings[0]), true, "individual warning should be frozen");
  }
});

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourcePath = resolve(process.cwd(), "src", "domain", "official-template-engine", "official-template-validation.ts");
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
    "docx",
    "throw ",
  ].forEach((forbidden) => {
    assertEqual(
      sourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in domain source: ${forbidden}`,
    );
  });
});

runTest("does not touch any file outside this domain directory (sanity import check)", () => {
  const domainDir = resolve(process.cwd(), "src", "domain", "official-template-engine");
  const domainFiles = listTsFiles(domainDir).filter((file) => file.endsWith("official-template-validation.ts"));
  assertEqual(domainFiles.length, 1, "expected exactly one official-template-validation.ts file");
});

function createTemplateFixture(): OfficialTemplate {
  const result = createTemplateInputResult();
  assertSuccess(result, "expected template fixture creation");
  return result.template;
}

function createTemplateInputResult(): OfficialTemplateResult {
  const input: CreateOfficialTemplateInput = {
    id: templateId,
    name: templateName,
    documentType: OfficialDocumentType.MeasurementBulletin,
    version: templateVersion,
    description: "Modelo padrao de boletim de medicao para obras publicas.",
    sections: [{ id: "section-1", title: "Identificacao da Obra", order: 1, description: null }],
    fields: [
      {
        id: "field-1",
        key: "field-key-1",
        sectionId: "section-1",
        label: "Responsavel Tecnico",
        required: true,
        description: null,
      },
    ],
    placeholders: [
      { key: "placeholder-1", label: "Nome do Responsavel Tecnico", fieldKey: "field-key-1", description: null },
    ],
    validationRules: [
      {
        id: "rule-1",
        description: "O campo do responsavel tecnico deve estar preenchido.",
        appliesToFieldKey: "field-key-1",
      },
    ],
    actor,
    occurredAt,
    correlationId,
    createdBy,
    sourceSystem,
    metadata: { source: "official-template-validation" },
  };

  return createOfficialTemplate(input);
}

function listTsFiles(dir: string): ReadonlyArray<string> {
  let entries: ReadonlyArray<string>;

  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const files: string[] = [];

  entries.forEach((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listTsFiles(fullPath));
      return;
    }

    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  });

  return files;
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

function assertHasCode(
  issues: ReadonlyArray<{ readonly code: string }>,
  code: string,
): void {
  if (!issues.some((issue) => issue.code === code)) {
    throw new Error(`expected an issue with code ${code}, got: ${JSON.stringify(issues)}`);
  }
}

function assertSuccess(
  result: OfficialTemplateResult,
  message: string,
): asserts result is Extract<OfficialTemplateResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}
