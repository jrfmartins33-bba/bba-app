declare const process: { cwd(): string };

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  OfficialDocumentType,
  OfficialTemplateStatus,
  OfficialTemplateValidationRuleSeverity,
  activateOfficialTemplate,
  addOfficialTemplateField,
  addOfficialTemplatePlaceholder,
  addOfficialTemplateSection,
  archiveOfficialTemplate,
  createOfficialTemplate,
  deprecateOfficialTemplate,
  summarizeOfficialTemplate,
  type CreateOfficialTemplateInput,
  type OfficialTemplate,
  type OfficialTemplateResult,
} from "./index";

const templateId = "template-boletim-medicao-001";
const templateName = "Boletim de Medicao Padrao";
const templateVersion = "1.0.0";
const actor = "engineer-marcos";
const occurredAt = "2026-07-03T09:00:00Z";
const correlationId = "official-template-engine-correlation-001";
const createdBy = "template-office";
const sourceSystem = "engineering-os";

runTest("valid creation", () => {
  const result = createOfficialTemplate(createTemplateInputFixture());

  assertSuccess(result, "expected template creation success");
  assertEqual(result.template.id, templateId, "id mismatch");
  assertEqual(result.template.name, templateName, "name mismatch");
  assertEqual(result.template.documentType, OfficialDocumentType.MeasurementBulletin, "documentType mismatch");
  assertEqual(result.template.version, templateVersion, "version mismatch");
  assertEqual(result.template.status, OfficialTemplateStatus.Draft, "initial status mismatch");
  assertEqual(result.template.sections.length, 1, "sections count mismatch");
  assertEqual(result.template.fields.length, 1, "fields count mismatch");
  assertEqual(result.template.placeholders.length, 1, "placeholders count mismatch");
  assertEqual(result.template.validationRules.length, 1, "validationRules count mismatch");
  assertEqual(result.template.timeline.length, 1, "timeline count mismatch");
  assertEqual(result.template.timeline[0]?.type, "template_created", "timeline type mismatch");
  assertEqual(result.template.trace.length, 1, "trace count mismatch");
});

runTest("rejects missing id", () => {
  const result = createOfficialTemplate(createTemplateInputFixture({ id: "" }));

  assertFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing name", () => {
  const result = createOfficialTemplate(createTemplateInputFixture({ name: "" }));

  assertFailure(result, "expected missing name failure");
  assertEqual(result.errors[0]?.code, "missing_name", "error code mismatch");
});

runTest("rejects missing version", () => {
  const result = createOfficialTemplate(createTemplateInputFixture({ version: "" }));

  assertFailure(result, "expected missing version failure");
  assertEqual(result.errors[0]?.code, "missing_version", "error code mismatch");
});

runTest("rejects duplicate section id", () => {
  const result = createOfficialTemplate(
    createTemplateInputFixture({
      sections: [sectionInputFixture({ id: "section-1" }), sectionInputFixture({ id: "section-1" })],
    }),
  );

  assertFailure(result, "expected duplicate section id failure");
  assertEqual(result.errors[0]?.code, "duplicate_section_id", "error code mismatch");
});

runTest("rejects duplicate field id", () => {
  const result = createOfficialTemplate(
    createTemplateInputFixture({
      fields: [
        fieldInputFixture({ id: "field-1", key: "field-key-1" }),
        fieldInputFixture({ id: "field-1", key: "field-key-2" }),
      ],
    }),
  );

  assertFailure(result, "expected duplicate field id failure");
  assertEqual(result.errors[0]?.code, "duplicate_field_id", "error code mismatch");
});

runTest("rejects duplicate field key", () => {
  const result = createOfficialTemplate(
    createTemplateInputFixture({
      fields: [
        fieldInputFixture({ id: "field-1", key: "field-key-1" }),
        fieldInputFixture({ id: "field-2", key: "field-key-1" }),
      ],
    }),
  );

  assertFailure(result, "expected duplicate field key failure");
  assertEqual(result.errors[0]?.code, "duplicate_field_key", "error code mismatch");
});

runTest("rejects duplicate placeholder key", () => {
  const result = createOfficialTemplate(
    createTemplateInputFixture({
      placeholders: [
        placeholderInputFixture({ key: "placeholder-1" }),
        placeholderInputFixture({ key: "placeholder-1" }),
      ],
    }),
  );

  assertFailure(result, "expected duplicate placeholder key failure");
  assertEqual(result.errors[0]?.code, "duplicate_placeholder_key", "error code mismatch");
});

runTest("rejects a placeholder referencing an unknown field key", () => {
  const result = createOfficialTemplate(
    createTemplateInputFixture({
      fields: [],
      placeholders: [placeholderInputFixture({ fieldKey: "unknown-field-key" })],
    }),
  );

  assertFailure(result, "expected unknown field reference failure");
  assertEqual(result.errors[0]?.code, "unknown_field_reference", "error code mismatch");
});

runTest("rejects a validation rule referencing an unknown field key", () => {
  const result = createOfficialTemplate(
    createTemplateInputFixture({
      fields: [],
      validationRules: [
        {
          id: "rule-1",
          description: "Field must be filled when applicable.",
          appliesToFieldKey: "unknown-field-key",
        },
      ],
    }),
  );

  assertFailure(result, "expected unknown field reference failure on validation rule");
  assertEqual(result.errors[0]?.code, "unknown_field_reference", "error code mismatch");
});

runTest("rejects non-positive section order", () => {
  const result = createOfficialTemplate(
    createTemplateInputFixture({ sections: [sectionInputFixture({ order: 0 })] }),
  );

  assertFailure(result, "expected invalid section order failure (zero)");
  assertEqual(result.errors[0]?.code, "invalid_section_order", "error code mismatch");
});

runTest("rejects negative section order", () => {
  const result = createOfficialTemplate(
    createTemplateInputFixture({ sections: [sectionInputFixture({ order: -1 })] }),
  );

  assertFailure(result, "expected invalid section order failure (negative)");
  assertEqual(result.errors[0]?.code, "invalid_section_order", "error code mismatch");
});

runTest("rejects non-integer section order", () => {
  const result = createOfficialTemplate(
    createTemplateInputFixture({ sections: [sectionInputFixture({ order: 1.5 })] }),
  );

  assertFailure(result, "expected invalid section order failure (non-integer)");
  assertEqual(result.errors[0]?.code, "invalid_section_order", "error code mismatch");
});

runTest("adds a section (grows trace, not timeline)", () => {
  const template = createTemplateFixture();
  const result = addOfficialTemplateSection({
    template,
    section: sectionInputFixture({ id: "section-2", order: 2 }),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add section success");
  assertEqual(result.template.sections.length, 2, "sections count mismatch after add");
  assertEqual(result.template.timeline.length, 1, "timeline should not grow on section add");
  assertEqual(result.template.trace.length, 2, "trace should grow on section add");
});

runTest("rejects adding a duplicate section id", () => {
  const template = createTemplateFixture();
  const result = addOfficialTemplateSection({
    template,
    section: sectionInputFixture(),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate section id failure on add");
  assertEqual(result.errors[0]?.code, "duplicate_section_id", "error code mismatch");
});

runTest("adds a field", () => {
  const template = createTemplateFixture();
  const result = addOfficialTemplateField({
    template,
    field: fieldInputFixture({ id: "field-2", key: "field-key-2" }),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add field success");
  assertEqual(result.template.fields.length, 2, "fields count mismatch after add");
  assertEqual(result.template.trace.length, 2, "trace should grow on field add");
});

runTest("rejects adding a duplicate field id", () => {
  const template = createTemplateFixture();
  const result = addOfficialTemplateField({
    template,
    field: fieldInputFixture({ key: "field-key-2" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate field id failure on add");
  assertEqual(result.errors[0]?.code, "duplicate_field_id", "error code mismatch");
});

runTest("rejects adding a duplicate field key", () => {
  const template = createTemplateFixture();
  const result = addOfficialTemplateField({
    template,
    field: fieldInputFixture({ id: "field-2" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate field key failure on add");
  assertEqual(result.errors[0]?.code, "duplicate_field_key", "error code mismatch");
});

runTest("adds a placeholder linked to an existing field", () => {
  const template = createTemplateFixture();
  const result = addOfficialTemplatePlaceholder({
    template,
    placeholder: placeholderInputFixture({ key: "placeholder-2", fieldKey: "field-key-1" }),
    actor,
    occurredAt,
  });

  assertSuccess(result, "expected add placeholder success");
  assertEqual(result.template.placeholders.length, 2, "placeholders count mismatch after add");
});

runTest("rejects adding a duplicate placeholder key", () => {
  const template = createTemplateFixture();
  const result = addOfficialTemplatePlaceholder({
    template,
    placeholder: placeholderInputFixture(),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected duplicate placeholder key failure on add");
  assertEqual(result.errors[0]?.code, "duplicate_placeholder_key", "error code mismatch");
});

runTest("rejects adding a placeholder referencing an unknown field key", () => {
  const template = createTemplateFixture();
  const result = addOfficialTemplatePlaceholder({
    template,
    placeholder: placeholderInputFixture({ key: "placeholder-2", fieldKey: "unknown-field-key" }),
    actor,
    occurredAt,
  });

  assertFailure(result, "expected unknown field reference failure on add");
  assertEqual(result.errors[0]?.code, "unknown_field_reference", "error code mismatch");
});

runTest("activation succeeds with at least one section and one required field", () => {
  const template = createTemplateFixture();
  const result = activateOfficialTemplate({ template, actor, occurredAt });

  assertSuccess(result, "expected activation success");
  assertEqual(result.template.status, OfficialTemplateStatus.Active, "status mismatch after activation");
  assertEqual(result.template.timeline.length, 2, "timeline should grow on activation");
  assertEqual(result.template.timeline[1]?.type, "template_activated", "timeline type mismatch");
  assertEqual(result.template.trace.length, 2, "trace should grow on activation");
});

runTest("blocks activation without any section", () => {
  const template: OfficialTemplate = { ...createTemplateFixture(), sections: [] };
  const result = activateOfficialTemplate({ template, actor, occurredAt });

  assertFailure(result, "expected activation blocked without section");
  assertEqual(
    result.errors[0]?.code,
    "template_cannot_activate_without_section",
    "error code mismatch",
  );
});

runTest("blocks activation without any required field", () => {
  const template: OfficialTemplate = {
    ...createTemplateFixture(),
    fields: [{ ...createTemplateFixture().fields[0]!, required: false }],
  };
  const result = activateOfficialTemplate({ template, actor, occurredAt });

  assertFailure(result, "expected activation blocked without required field");
  assertEqual(
    result.errors[0]?.code,
    "template_cannot_activate_without_required_field",
    "error code mismatch",
  );
});

runTest("deprecation succeeds from Active", () => {
  const activated = activateTemplateFixture();
  const result = deprecateOfficialTemplate({ template: activated, actor, occurredAt });

  assertSuccess(result, "expected deprecation success");
  assertEqual(result.template.status, OfficialTemplateStatus.Deprecated, "status mismatch after deprecation");
});

runTest("archival succeeds from Draft, Active and Deprecated", () => {
  const fromDraft = archiveOfficialTemplate({ template: createTemplateFixture(), actor, occurredAt });
  assertSuccess(fromDraft, "expected archival success from Draft");
  assertEqual(fromDraft.template.status, OfficialTemplateStatus.Archived, "status mismatch archiving from Draft");

  const fromActive = archiveOfficialTemplate({ template: activateTemplateFixture(), actor, occurredAt });
  assertSuccess(fromActive, "expected archival success from Active");

  const activated = activateTemplateFixture();
  const deprecatedResult = deprecateOfficialTemplate({ template: activated, actor, occurredAt });
  assertSuccess(deprecatedResult, "expected deprecation to succeed as a setup step");
  const fromDeprecated = archiveOfficialTemplate({ template: deprecatedResult.template, actor, occurredAt });
  assertSuccess(fromDeprecated, "expected archival success from Deprecated");
});

runTest("rejects invalid status transitions", () => {
  const activated = activateTemplateFixture();
  const result = activateOfficialTemplate({ template: activated, actor, occurredAt });

  assertFailure(result, "expected invalid transition failure (Active -> Active)");
  assertEqual(
    result.errors[0]?.code,
    "invalid_official_template_status_transition",
    "error code mismatch",
  );
});

runTest("Archived is terminal and blocks any further status transition", () => {
  const archived = archiveOfficialTemplate({ template: createTemplateFixture(), actor, occurredAt });
  assertSuccess(archived, "expected archival success");

  const result = deprecateOfficialTemplate({ template: archived.template, actor, occurredAt });

  assertFailure(result, "expected terminal block on status transition from Archived");
  assertEqual(result.errors[0]?.code, "template_terminal", "error code mismatch");
});

runTest("Deprecated blocks new sections, fields and placeholders", () => {
  const activated = activateTemplateFixture();
  const deprecatedResult = deprecateOfficialTemplate({ template: activated, actor, occurredAt });
  assertSuccess(deprecatedResult, "expected deprecation to succeed as a setup step");
  const deprecated = deprecatedResult.template;

  const sectionResult = addOfficialTemplateSection({
    template: deprecated,
    section: sectionInputFixture({ id: "section-2", order: 2 }),
    actor,
    occurredAt,
  });
  assertFailure(sectionResult, "expected section add blocked while Deprecated");
  assertEqual(sectionResult.errors[0]?.code, "template_locked_for_structural_changes", "error code mismatch");

  const fieldResult = addOfficialTemplateField({
    template: deprecated,
    field: fieldInputFixture({ id: "field-2", key: "field-key-2" }),
    actor,
    occurredAt,
  });
  assertFailure(fieldResult, "expected field add blocked while Deprecated");
  assertEqual(fieldResult.errors[0]?.code, "template_locked_for_structural_changes", "error code mismatch");

  const placeholderResult = addOfficialTemplatePlaceholder({
    template: deprecated,
    placeholder: placeholderInputFixture({ key: "placeholder-2" }),
    actor,
    occurredAt,
  });
  assertFailure(placeholderResult, "expected placeholder add blocked while Deprecated");
  assertEqual(
    placeholderResult.errors[0]?.code,
    "template_locked_for_structural_changes",
    "error code mismatch",
  );
});

runTest("Archived blocks new sections, fields and placeholders", () => {
  const archived = archiveOfficialTemplate({ template: createTemplateFixture(), actor, occurredAt });
  assertSuccess(archived, "expected archival success");

  const sectionResult = addOfficialTemplateSection({
    template: archived.template,
    section: sectionInputFixture({ id: "section-2", order: 2 }),
    actor,
    occurredAt,
  });
  assertFailure(sectionResult, "expected section add blocked while Archived");
  assertEqual(sectionResult.errors[0]?.code, "template_locked_for_structural_changes", "error code mismatch");
});

runTest("summarizeOfficialTemplate is deterministic and matches template state", () => {
  const template = createTemplateFixture();
  const summary = summarizeOfficialTemplate(template);

  assertEqual(summary.totalSections, 1, "totalSections mismatch");
  assertEqual(summary.totalFields, 1, "totalFields mismatch");
  assertEqual(summary.requiredFields, 1, "requiredFields mismatch");
  assertEqual(summary.totalPlaceholders, 1, "totalPlaceholders mismatch");
  assertEqual(summary.totalValidationRules, 1, "totalValidationRules mismatch");
});

runTest("immutable output", () => {
  const result = createOfficialTemplate(createTemplateInputFixture());

  assertSuccess(result, "expected template creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.template), true, "template should be frozen");
  assertEqual(Object.isFrozen(result.template.sections), true, "sections should be frozen");
  assertEqual(Object.isFrozen(result.template.fields), true, "fields should be frozen");
  assertEqual(Object.isFrozen(result.template.placeholders), true, "placeholders should be frozen");
  assertEqual(Object.isFrozen(result.template.validationRules), true, "validationRules should be frozen");
  assertEqual(Object.isFrozen(result.template.timeline), true, "timeline should be frozen");
  assertEqual(Object.isFrozen(result.template.trace), true, "trace should be frozen");
  assertEqual(Object.isFrozen(result.template.metadata), true, "metadata should be frozen");
});

runTest("deterministic output for identical input", () => {
  const input = createTemplateInputFixture();
  const first = JSON.stringify(createOfficialTemplate(input));
  const second = JSON.stringify(createOfficialTemplate(input));

  assertEqual(first, second, "expected deterministic template creation output");
});

runTest("deterministic output across mutations", () => {
  const buildMutated = () => {
    const template = createTemplateFixture();
    const withField = addOfficialTemplateField({
      template,
      field: fieldInputFixture({ id: "field-2", key: "field-key-2" }),
      actor,
      occurredAt,
    });
    assertSuccess(withField, "expected add field success");
    return withField;
  };

  const first = JSON.stringify(buildMutated());
  const second = JSON.stringify(buildMutated());
  assertEqual(first, second, "expected deterministic mutation output");
});

runTest("preserves traceability (correlationId/createdBy/sourceSystem in metadata)", () => {
  const result = createOfficialTemplate(createTemplateInputFixture());

  assertSuccess(result, "expected template creation success");
  assertEqual(result.template.metadata["correlationId"], correlationId, "correlation id mismatch");
  assertEqual(result.template.metadata["createdBy"], createdBy, "created by mismatch");
  assertEqual(result.template.metadata["sourceSystem"], sourceSystem, "source system mismatch");
  assertEqual(result.template.trace[0]?.actor, actor, "trace actor mismatch");
  assertEqual(result.template.trace[0]?.occurredAt, occurredAt, "trace occurredAt mismatch");
});

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourceCode = readDomainSourceFiles();
  const lowerSourceCode = sourceCode.toLowerCase();

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
    "require(\"docx\")",
  ].forEach((forbidden) => {
    assertEqual(
      lowerSourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in domain source: ${forbidden}`,
    );
  });
});

function createTemplateFixture(): OfficialTemplate {
  const result = createOfficialTemplate(createTemplateInputFixture());
  assertSuccess(result, "expected template fixture creation");
  return result.template;
}

function activateTemplateFixture(): OfficialTemplate {
  const activated = activateOfficialTemplate({ template: createTemplateFixture(), actor, occurredAt });
  assertSuccess(activated, "expected activation to succeed as a setup step");
  return activated.template;
}

function createTemplateInputFixture(
  overrides: Partial<CreateOfficialTemplateInput> = {},
): CreateOfficialTemplateInput {
  return {
    id: overrides.id ?? templateId,
    name: overrides.name ?? templateName,
    documentType: overrides.documentType ?? OfficialDocumentType.MeasurementBulletin,
    version: overrides.version ?? templateVersion,
    description:
      overrides.description === undefined
        ? "Modelo padrao de boletim de medicao para obras publicas."
        : overrides.description,
    sections: overrides.sections ?? [sectionInputFixture()],
    fields: overrides.fields ?? [fieldInputFixture()],
    placeholders: overrides.placeholders ?? [placeholderInputFixture()],
    validationRules:
      overrides.validationRules ??
      [
        {
          id: "rule-1",
          description: "O campo do responsavel tecnico deve estar preenchido.",
          appliesToFieldKey: "field-key-1",
          severity: OfficialTemplateValidationRuleSeverity.Error,
        },
      ],
    actor: overrides.actor ?? actor,
    occurredAt: overrides.occurredAt ?? occurredAt,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "official-template-engine" },
  };
}

function sectionInputFixture(
  overrides: Partial<CreateOfficialTemplateInput["sections"] extends ReadonlyArray<infer T> | null | undefined ? T : never> = {},
) {
  return {
    id: overrides.id ?? "section-1",
    title: overrides.title ?? "Identificacao da Obra",
    order: overrides.order ?? 1,
    description: overrides.description ?? "Dados de identificacao do contrato e da obra.",
    metadata: overrides.metadata ?? {},
  };
}

function fieldInputFixture(
  overrides: Partial<CreateOfficialTemplateInput["fields"] extends ReadonlyArray<infer T> | null | undefined ? T : never> = {},
) {
  return {
    id: overrides.id ?? "field-1",
    key: overrides.key ?? "field-key-1",
    sectionId: overrides.sectionId === undefined ? "section-1" : overrides.sectionId,
    label: overrides.label ?? "Responsavel Tecnico",
    required: overrides.required === undefined ? true : overrides.required,
    description: overrides.description ?? "Nome do responsavel tecnico pela medicao.",
    metadata: overrides.metadata ?? {},
  };
}

function placeholderInputFixture(
  overrides: Partial<CreateOfficialTemplateInput["placeholders"] extends ReadonlyArray<infer T> | null | undefined ? T : never> = {},
) {
  return {
    key: overrides.key ?? "placeholder-1",
    label: overrides.label ?? "Nome do Responsavel Tecnico",
    fieldKey: overrides.fieldKey === undefined ? "field-key-1" : overrides.fieldKey,
    description: overrides.description ?? "Placeholder vinculado ao campo do responsavel tecnico.",
    metadata: overrides.metadata ?? {},
  };
}

function readDomainSourceFiles(): string {
  const domainDir = resolve(process.cwd(), "src", "domain", "official-template-engine");
  return listTsFiles(domainDir)
    .filter((file) => !file.endsWith(".test.ts"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
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

function assertSuccess(
  result: OfficialTemplateResult,
  message: string,
): asserts result is Extract<OfficialTemplateResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertFailure(
  result: OfficialTemplateResult,
  message: string,
): asserts result is Extract<OfficialTemplateResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
