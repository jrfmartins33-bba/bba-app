import {
  ExportDocumentFormat,
  ExportDocumentType,
  ExportPackageReferenceType,
  ExportPackageStatus,
  ExportPackageValidationSeverity,
  createExportPackage,
  prepareExportPackage,
  summarizeExportPackage,
  validateExportPackage,
  type CreateExportPackageInput,
  type ExportDocumentRequestInput,
  type ExportPackage,
  type ExportPackageResult,
} from "./index";

const exportPackageId = "export-package-lagoa-do-arroz-8";
const organizationId = "organization-alpha-engenharia";
const referenceId = "measurement-bulletin-lagoa-do-arroz-8";
const actor = "engineer-marcos";
const occurredAt = "2026-06-15T10:30:00Z";
const correlationId = "export-package-correlation-001";
const createdBy = "field-office";
const sourceSystem = "engineering-os";

runTest("valid creation", () => {
  const result = createExportPackage(createPackageInputFixture());

  assertSuccess(result, "expected export package creation success");
  assertEqual(result.exportPackage.id, exportPackageId, "id mismatch");
  assertEqual(result.exportPackage.organizationId, organizationId, "organization mismatch");
  assertEqual(result.exportPackage.reference.id, referenceId, "reference id mismatch");
  assertEqual(
    result.exportPackage.status,
    ExportPackageStatus.Draft,
    "initial status mismatch",
  );
  assertEqual(result.exportPackage.documents.length, 2, "documents count mismatch");
  assertEqual(result.exportPackage.descriptors.length, 0, "descriptors should be empty pre-preparation");
  assertEqual(
    result.exportPackage.summary.totalDocumentsRequested,
    2,
    "summary totalDocumentsRequested mismatch",
  );
});

runTest("rejects missing id", () => {
  const result = createExportPackage(createPackageInputFixture({ id: "" }));

  assertFailure(result, "expected missing id failure");
  assertEqual(result.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejects missing organizationId", () => {
  const result = createExportPackage(createPackageInputFixture({ organizationId: "" }));

  assertFailure(result, "expected missing organization failure");
  assertEqual(result.errors[0]?.code, "missing_organization_id", "error code mismatch");
});

runTest("rejects missing reference", () => {
  const input = createPackageInputFixture();
  const result = createExportPackage({
    ...input,
    reference: null as unknown as CreateExportPackageInput["reference"],
  });

  assertFailure(result, "expected missing reference failure");
  assertEqual(result.errors[0]?.code, "missing_reference", "error code mismatch");
});

runTest("rejects missing reference id", () => {
  const input = createPackageInputFixture();
  const result = createExportPackage({
    ...input,
    reference: { ...input.reference, id: "" },
  });

  assertFailure(result, "expected missing reference id failure");
  assertEqual(result.errors[0]?.code, "missing_reference_id", "error code mismatch");
});

runTest("rejects missing document id", () => {
  const result = createExportPackage(
    createPackageInputFixture({
      documents: [createDocumentInputFixture({ id: "" })],
    }),
  );

  assertFailure(result, "expected missing document id failure");
  assertEqual(result.errors[0]?.code, "missing_document_id", "error code mismatch");
});

runTest("rejects missing document type", () => {
  const result = createExportPackage(
    createPackageInputFixture({
      documents: [
        createDocumentInputFixture({
          type: null as unknown as ExportDocumentType,
        }),
      ],
    }),
  );

  assertFailure(result, "expected missing document type failure");
  assertEqual(result.errors[0]?.code, "missing_document_type", "error code mismatch");
});

runTest("rejects missing document format", () => {
  const result = createExportPackage(
    createPackageInputFixture({
      documents: [
        createDocumentInputFixture({
          format: null as unknown as ExportDocumentFormat,
        }),
      ],
    }),
  );

  assertFailure(result, "expected missing document format failure");
  assertEqual(result.errors[0]?.code, "missing_document_format", "error code mismatch");
});

runTest("rejects duplicate document id", () => {
  const result = createExportPackage(
    createPackageInputFixture({
      documents: [
        createDocumentInputFixture({ id: "doc-001" }),
        createDocumentInputFixture({ id: "doc-001" }),
      ],
    }),
  );

  assertFailure(result, "expected duplicate document id failure");
  assertEqual(result.errors[0]?.code, "duplicate_document_id", "error code mismatch");
});

runTest("validates without issues when content is sound", () => {
  const exportPackage = createPackageFixture();
  const result = validateExportPackage({ exportPackage, actor, occurredAt });

  assertSuccess(result, "expected validation success");
  assertEqual(
    result.exportPackage.status,
    ExportPackageStatus.Validated,
    "status mismatch after validation",
  );
  assertEqual(
    result.exportPackage.validationIssues.length,
    0,
    "expected no validation issues",
  );
});

runTest("validates with absence of documents", () => {
  const exportPackage = createPackageFixture({ documents: [] });
  const result = validateExportPackage({ exportPackage, actor, occurredAt });

  assertSuccess(result, "expected validation success");
  assertEqual(result.exportPackage.validationIssues.length, 1, "expected one issue");
  assertEqual(
    result.exportPackage.validationIssues[0]?.code,
    "no_documents_requested",
    "issue code mismatch",
  );
  assertEqual(
    result.exportPackage.validationIssues[0]?.severity,
    ExportPackageValidationSeverity.Blocking,
    "issue severity mismatch",
  );
});

runTest("validates with duplicate document types", () => {
  const exportPackage = createPackageFixture({
    documents: [
      createDocumentInputFixture({
        id: "doc-001",
        type: ExportDocumentType.CustomDocument,
        format: ExportDocumentFormat.Excel,
      }),
      createDocumentInputFixture({
        id: "doc-002",
        type: ExportDocumentType.CustomDocument,
        format: ExportDocumentFormat.Pdf,
      }),
    ],
  });
  const result = validateExportPackage({ exportPackage, actor, occurredAt });

  assertSuccess(result, "expected validation success");
  const duplicateIssue = result.exportPackage.validationIssues.find(
    (issue) => issue.code === "duplicate_document_type",
  );
  assertEqual(duplicateIssue !== undefined, true, "expected duplicate_document_type issue");
  assertEqual(
    duplicateIssue?.severity,
    ExportPackageValidationSeverity.Blocking,
    "issue severity mismatch",
  );
});

runTest("validates with incompatible document format", () => {
  const exportPackage = createPackageFixture({
    documents: [
      createDocumentInputFixture({
        id: "doc-001",
        type: ExportDocumentType.OfficialMeasurementSpreadsheet,
        format: ExportDocumentFormat.Pdf,
      }),
    ],
  });
  const result = validateExportPackage({ exportPackage, actor, occurredAt });

  assertSuccess(result, "expected validation success");
  const incompatibleIssue = result.exportPackage.validationIssues.find(
    (issue) => issue.code === "incompatible_document_format",
  );
  assertEqual(
    incompatibleIssue !== undefined,
    true,
    "expected incompatible_document_format issue",
  );
  assertEqual(
    incompatibleIssue?.severity,
    ExportPackageValidationSeverity.Blocking,
    "issue severity mismatch",
  );
});

runTest("validates with a warning when reference is not finalized", () => {
  const exportPackage = createPackageFixture({
    reference: {
      type: ExportPackageReferenceType.MeasurementBulletin,
      id: referenceId,
      code: "MB-LAGOA-DO-ARROZ-8",
      name: "Medicao 8 - Lagoa do Arroz",
      status: "Draft",
      metadata: { source: "bulletin-generator" },
    },
  });
  const result = validateExportPackage({ exportPackage, actor, occurredAt });

  assertSuccess(result, "expected validation success");
  const warningIssue = result.exportPackage.validationIssues.find(
    (issue) => issue.code === "reference_not_finalized",
  );
  assertEqual(warningIssue !== undefined, true, "expected reference_not_finalized issue");
  assertEqual(
    warningIssue?.severity,
    ExportPackageValidationSeverity.Warning,
    "issue severity mismatch",
  );
});

runTest("valid preparation", () => {
  const exportPackage = createPackageFixture();
  const validated = validateExportPackage({ exportPackage, actor, occurredAt });
  assertSuccess(validated, "expected validation success");

  const prepared = prepareExportPackage({
    exportPackage: validated.exportPackage,
    actor,
    occurredAt,
  });

  assertSuccess(prepared, "expected preparation success");
  assertEqual(
    prepared.exportPackage.status,
    ExportPackageStatus.Prepared,
    "status mismatch after preparation",
  );
  assertEqual(prepared.exportPackage.descriptors.length, 2, "descriptors count mismatch");
  assertEqual(
    prepared.exportPackage.summary.totalDocumentsPrepared,
    2,
    "summary totalDocumentsPrepared mismatch",
  );
});

runTest("blocks preparation when blocking issues are present", () => {
  const exportPackage = createPackageFixture({
    documents: [
      createDocumentInputFixture({
        id: "doc-001",
        type: ExportDocumentType.OfficialMeasurementSpreadsheet,
        format: ExportDocumentFormat.Pdf,
      }),
    ],
  });
  const validated = validateExportPackage({ exportPackage, actor, occurredAt });
  assertSuccess(validated, "expected validation success");

  const prepared = prepareExportPackage({
    exportPackage: validated.exportPackage,
    actor,
    occurredAt,
  });

  assertFailure(prepared, "expected preparation to be blocked");
  assertEqual(
    prepared.errors[0]?.code,
    "blocking_validation_issues",
    "error code mismatch",
  );
});

runTest("blocks preparation before validation", () => {
  const exportPackage = createPackageFixture();
  const result = prepareExportPackage({ exportPackage, actor, occurredAt });

  assertFailure(result, "expected preparation to be blocked before validation");
  assertEqual(result.errors[0]?.code, "export_package_not_validated", "error code mismatch");
});

runTest("blocks mutation on a terminal (prepared) export package", () => {
  const exportPackage = createPackageFixture();
  const validated = validateExportPackage({ exportPackage, actor, occurredAt });
  assertSuccess(validated, "expected validation success");
  const prepared = prepareExportPackage({
    exportPackage: validated.exportPackage,
    actor,
    occurredAt,
  });
  assertSuccess(prepared, "expected preparation success");

  const revalidateAttempt = validateExportPackage({
    exportPackage: prepared.exportPackage,
    actor,
    occurredAt,
  });
  assertFailure(revalidateAttempt, "expected revalidation to be blocked on terminal package");
  assertEqual(
    revalidateAttempt.errors[0]?.code,
    "export_package_terminal",
    "error code mismatch",
  );

  const reprepareAttempt = prepareExportPackage({
    exportPackage: prepared.exportPackage,
    actor,
    occurredAt,
  });
  assertFailure(reprepareAttempt, "expected repreparation to be blocked on terminal package");
  assertEqual(
    reprepareAttempt.errors[0]?.code,
    "export_package_terminal",
    "error code mismatch",
  );
});

runTest("summarizeExportPackage is deterministic and matches stored summary", () => {
  const exportPackage = createPackageFixture();
  const validated = validateExportPackage({ exportPackage, actor, occurredAt });
  assertSuccess(validated, "expected validation success");
  const prepared = prepareExportPackage({
    exportPackage: validated.exportPackage,
    actor,
    occurredAt,
  });
  assertSuccess(prepared, "expected preparation success");

  const summary = summarizeExportPackage(prepared.exportPackage);

  assertEqual(
    summary.totalDocumentsRequested,
    prepared.exportPackage.summary.totalDocumentsRequested,
    "totalDocumentsRequested mismatch",
  );
  assertEqual(
    summary.totalDocumentsPrepared,
    prepared.exportPackage.summary.totalDocumentsPrepared,
    "totalDocumentsPrepared mismatch",
  );
});

runTest("descriptor is deterministic and contains no physical artifacts", () => {
  const buildPrepared = () => {
    const created = createExportPackage(createPackageInputFixture());
    assertSuccess(created, "expected creation success");
    const validated = validateExportPackage({
      exportPackage: created.exportPackage,
      actor,
      occurredAt,
    });
    assertSuccess(validated, "expected validation success");
    const prepared = prepareExportPackage({
      exportPackage: validated.exportPackage,
      actor,
      occurredAt,
    });
    assertSuccess(prepared, "expected preparation success");
    return prepared.exportPackage;
  };

  const first = buildPrepared();
  const second = buildPrepared();

  assertEqual(
    JSON.stringify(first.descriptors),
    JSON.stringify(second.descriptors),
    "expected deterministic descriptors",
  );

  first.descriptors.forEach((descriptor) => {
    assertEqual("path" in descriptor, false, "descriptor should not contain a path key");
    assertEqual("buffer" in descriptor, false, "descriptor should not contain a buffer key");
    assertEqual("binary" in descriptor, false, "descriptor should not contain a binary key");
    assertEqual("base64" in descriptor, false, "descriptor should not contain a base64 key");
    assertEqual(
      descriptor.fileNameSuggestion.includes("/"),
      false,
      "fileNameSuggestion should not contain a forward slash",
    );
    assertEqual(
      descriptor.fileNameSuggestion.includes("\\"),
      false,
      "fileNameSuggestion should not contain a backslash",
    );
    assertEqual(
      descriptor.fileNameSuggestion.includes(":"),
      false,
      "fileNameSuggestion should not contain a drive separator",
    );
  });
});

runTest("immutable output", () => {
  const result = createExportPackage(createPackageInputFixture());

  assertSuccess(result, "expected export package creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.exportPackage), true, "exportPackage should be frozen");
  assertEqual(
    Object.isFrozen(result.exportPackage.documents),
    true,
    "documents should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.exportPackage.documents[0]),
    true,
    "document should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.exportPackage.descriptors),
    true,
    "descriptors should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.exportPackage.trace),
    true,
    "trace should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.exportPackage.summary),
    true,
    "summary should be frozen",
  );
  assertEqual(
    Object.isFrozen(result.exportPackage.metadata),
    true,
    "metadata should be frozen",
  );
});

runTest("deterministic output", () => {
  const input = createPackageInputFixture();
  const first = JSON.stringify(createExportPackage(input));
  const second = JSON.stringify(createExportPackage(input));

  assertEqual(first, second, "expected deterministic output");
});

runTest("preserves traceability", () => {
  const result = createExportPackage(createPackageInputFixture());
  assertSuccess(result, "expected export package creation success");
  assertEqual(
    result.exportPackage.metadata["correlationId"],
    correlationId,
    "correlation id mismatch",
  );
  assertEqual(result.exportPackage.metadata["createdBy"], createdBy, "created by mismatch");
  assertEqual(
    result.exportPackage.metadata["sourceSystem"],
    sourceSystem,
    "source system mismatch",
  );
  assertEqual(result.exportPackage.trace.length, 1, "trace should record creation");
  assertEqual(
    result.exportPackage.trace[0]?.action,
    "export_package_created",
    "trace action mismatch",
  );

  const validated = validateExportPackage({
    exportPackage: result.exportPackage,
    actor,
    occurredAt,
  });
  assertSuccess(validated, "expected validation success");
  assertEqual(validated.exportPackage.trace.length, 2, "trace should grow after validation");

  const prepared = prepareExportPackage({
    exportPackage: validated.exportPackage,
    actor,
    occurredAt,
  });
  assertSuccess(prepared, "expected preparation success");
  assertEqual(prepared.exportPackage.trace.length, 3, "trace should grow after preparation");
});

runTest(
  "does not reference decision engine, business facts, template engine, filesystem or real file generation",
  () => {
    const exportPackage = createPackageFixture();
    const validated = validateExportPackage({ exportPackage, actor, occurredAt });
    assertSuccess(validated, "expected validation success");
    const prepared = prepareExportPackage({
      exportPackage: validated.exportPackage,
      actor,
      occurredAt,
    });
    assertSuccess(prepared, "expected preparation success");

    const serialized = JSON.stringify(prepared.exportPackage).toLowerCase();

    [
      "buffer",
      "base64",
      "binary",
      "filesystem",
      "writefile",
      "readfile",
      "fs.write",
      "decisionengine",
      "decision_engine",
      "businessfact",
      "business_fact",
      "cashflow",
      "cash_flow",
      "forecast",
      "revenueintelligence",
      "revenue_intelligence",
      "templateengine",
      "template_engine",
      "uuid",
    ].forEach((forbidden) => {
      assertEqual(
        serialized.includes(forbidden),
        false,
        `unexpected concept in output: ${forbidden}`,
      );
    });
  },
);

function createPackageFixture(
  overrides: Partial<CreateExportPackageInput> = {},
): ExportPackage {
  const result = createExportPackage(createPackageInputFixture(overrides));
  assertSuccess(result, "expected export package fixture creation");
  return result.exportPackage;
}

function createPackageInputFixture(
  overrides: Partial<CreateExportPackageInput> = {},
): CreateExportPackageInput {
  return {
    id: overrides.id ?? exportPackageId,
    organizationId: overrides.organizationId ?? organizationId,
    reference:
      overrides.reference ??
      {
        type: ExportPackageReferenceType.MeasurementBulletin,
        id: referenceId,
        code: "MB-LAGOA-DO-ARROZ-8",
        name: "Medicao 8 - Lagoa do Arroz",
        status: "Finalized",
        metadata: { source: "bulletin-generator" },
      },
    documents:
      overrides.documents ??
      [
        createDocumentInputFixture({
          id: "doc-001",
          type: ExportDocumentType.OfficialMeasurementSpreadsheet,
          format: ExportDocumentFormat.Excel,
          label: "Planilha Oficial de Medicao",
        }),
        createDocumentInputFixture({
          id: "doc-002",
          type: ExportDocumentType.OfficialMeasurementPdf,
          format: ExportDocumentFormat.Pdf,
          label: "PDF Oficial de Medicao",
        }),
      ],
    actor: overrides.actor ?? actor,
    occurredAt: overrides.occurredAt ?? occurredAt,
    correlationId: overrides.correlationId ?? correlationId,
    createdBy: overrides.createdBy ?? createdBy,
    sourceSystem: overrides.sourceSystem ?? sourceSystem,
    metadata: overrides.metadata ?? { source: "export-engine" },
  };
}

function createDocumentInputFixture(
  overrides: Partial<ExportDocumentRequestInput> = {},
): ExportDocumentRequestInput {
  return {
    id: overrides.id ?? "doc-001",
    type:
      overrides.type === undefined
        ? ExportDocumentType.OfficialMeasurementSpreadsheet
        : overrides.type,
    format:
      overrides.format === undefined ? ExportDocumentFormat.Excel : overrides.format,
    label: overrides.label ?? "Planilha Oficial de Medicao",
    metadata: overrides.metadata ?? { source: "export-engine" },
  };
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
  result: ExportPackageResult,
  message: string,
): asserts result is Extract<ExportPackageResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertFailure(
  result: ExportPackageResult,
  message: string,
): asserts result is Extract<ExportPackageResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
