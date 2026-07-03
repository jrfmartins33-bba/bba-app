declare const process: { cwd(): string };

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  OfficialTemplateBlockType,
  createOfficialTemplateComposition,
  findOfficialTemplateBlock,
  listOfficialTemplateBlocks,
  summarizeOfficialTemplateComposition,
  validateOfficialTemplateComposition,
  type CreateOfficialTemplateCompositionInput,
  type OfficialTemplateBlockInput,
  type OfficialTemplateComposition,
  type OfficialTemplateCompositionResult,
} from "./index";

runTest("valid creation builds a composition tree", () => {
  const result = createOfficialTemplateComposition(validCompositionInputFixture());

  assertSuccess(result, "expected composition creation success");
  assertEqual(result.composition.rootBlocks.length, 2, "expected two root blocks");
  assertEqual(result.composition.rootBlocks[0]?.id, "block-header", "first root block id mismatch");
  assertEqual(result.composition.rootBlocks[1]?.children.length, 2, "expected two children under the body block");
  assertEqual(result.composition.rootBlocks[1]?.children[0]?.id, "block-contract-info", "child id mismatch");
});

runTest("optional fields default correctly (required=false, repeatable=false, children=[])", () => {
  const input: CreateOfficialTemplateCompositionInput = {
    rootBlocks: [{ id: "block-1", type: OfficialTemplateBlockType.Text, name: "Texto Livre", order: 1 }],
  };
  const result = createOfficialTemplateComposition(input);

  assertSuccess(result, "expected creation success");
  assertEqual(result.composition.rootBlocks[0]?.required, false, "expected required to default to false");
  assertEqual(result.composition.rootBlocks[0]?.repeatable, false, "expected repeatable to default to false");
  assertEqual(result.composition.rootBlocks[0]?.children.length, 0, "expected children to default to an empty array");
});

runTest("a valid tree passes validateOfficialTemplateComposition with no errors", () => {
  const created = createOfficialTemplateComposition(validCompositionInputFixture());
  assertSuccess(created, "expected composition creation success");

  const result = validateOfficialTemplateComposition(created.composition);

  assertEqual(result.valid, true, "expected a valid tree to pass validation");
  assertEqual(result.errors.length, 0, "expected no errors on a valid tree");
});

runTest("an invalid tree fails validateOfficialTemplateComposition", () => {
  const invalidComposition: OfficialTemplateComposition = {
    rootBlocks: [
      { id: "", type: OfficialTemplateBlockType.Header, name: "Cabecalho", order: 1, required: true, repeatable: false, children: [] },
    ],
  };

  const result = validateOfficialTemplateComposition(invalidComposition);

  assertEqual(result.valid, false, "expected an invalid tree to fail validation");
  assertHasCode(result.errors, "missing_block_id");
});

runTest("rejects a block with a blank id", () => {
  const result = createOfficialTemplateComposition({
    rootBlocks: [blockInputFixture({ id: "" })],
  });

  assertFailure(result, "expected missing block id failure");
  assertHasCode(result.errors, "missing_block_id");
});

runTest("rejects a block with a blank type", () => {
  const result = createOfficialTemplateComposition({
    rootBlocks: [blockInputFixture({ type: "" as OfficialTemplateBlockType })],
  });

  assertFailure(result, "expected missing block type failure");
  assertHasCode(result.errors, "missing_block_type");
});

runTest("rejects a block with a blank name", () => {
  const result = createOfficialTemplateComposition({
    rootBlocks: [blockInputFixture({ name: "" })],
  });

  assertFailure(result, "expected missing block name failure");
  assertHasCode(result.errors, "missing_block_name");
});

runTest("rejects a duplicate block id at the same level", () => {
  const result = createOfficialTemplateComposition({
    rootBlocks: [blockInputFixture({ id: "block-1", order: 1 }), blockInputFixture({ id: "block-1", order: 2 })],
  });

  assertFailure(result, "expected duplicate block id failure");
  assertHasCode(result.errors, "duplicate_block_id");
});

runTest("rejects a duplicate block id across different levels (global uniqueness)", () => {
  const result = createOfficialTemplateComposition({
    rootBlocks: [
      {
        id: "block-1",
        type: OfficialTemplateBlockType.Header,
        name: "Cabecalho",
        order: 1,
        children: [blockInputFixture({ id: "block-1", order: 1 })],
      },
    ],
  });

  assertFailure(result, "expected duplicate block id failure across levels");
  assertHasCode(result.errors, "duplicate_block_id");
});

runTest("rejects a duplicate order among siblings", () => {
  const result = createOfficialTemplateComposition({
    rootBlocks: [
      blockInputFixture({ id: "block-1", order: 1 }),
      blockInputFixture({ id: "block-2", order: 1 }),
    ],
  });

  assertFailure(result, "expected duplicate block order failure");
  assertHasCode(result.errors, "duplicate_block_order");
});

runTest("allows the same order at different levels (order uniqueness is per sibling level)", () => {
  const result = createOfficialTemplateComposition({
    rootBlocks: [
      {
        id: "block-1",
        type: OfficialTemplateBlockType.Header,
        name: "Cabecalho",
        order: 1,
        children: [blockInputFixture({ id: "block-2", order: 1 })],
      },
    ],
  });

  assertSuccess(result, "expected success: order 1 reused at a nested level is not a conflict");
});

runTest("rejects a negative order", () => {
  const result = createOfficialTemplateComposition({
    rootBlocks: [blockInputFixture({ order: -1 })],
  });

  assertFailure(result, "expected invalid block order failure (negative)");
  assertHasCode(result.errors, "invalid_block_order");
});

runTest("rejects a zero order", () => {
  const result = createOfficialTemplateComposition({
    rootBlocks: [blockInputFixture({ order: 0 })],
  });

  assertFailure(result, "expected invalid block order failure (zero)");
  assertHasCode(result.errors, "invalid_block_order");
});

runTest("rejects a non-integer order", () => {
  const result = createOfficialTemplateComposition({
    rootBlocks: [blockInputFixture({ order: 1.5 })],
  });

  assertFailure(result, "expected invalid block order failure (non-integer)");
  assertHasCode(result.errors, "invalid_block_order");
});

runTest("detects a circular block reference and does not hang", () => {
  const cyclicBlock: any = {
    id: "block-cycle",
    type: OfficialTemplateBlockType.Text,
    name: "Bloco Ciclico",
    order: 1,
    children: [],
  };
  cyclicBlock.children.push(cyclicBlock);

  const composition: OfficialTemplateComposition = { rootBlocks: [cyclicBlock] };
  const result = validateOfficialTemplateComposition(composition);

  assertEqual(result.valid, false, "expected a cyclic tree to be invalid");
  assertHasCode(result.errors, "circular_block_reference");
});

runTest("findOfficialTemplateBlock finds a nested block by id", () => {
  const created = createOfficialTemplateComposition(validCompositionInputFixture());
  assertSuccess(created, "expected composition creation success");

  const found = findOfficialTemplateBlock(created.composition, "block-contract-info");
  assertEqual(found !== null, true, "expected to find the nested block");
  assertEqual(found?.id, "block-contract-info", "found block id mismatch");
});

runTest("findOfficialTemplateBlock returns null for an unknown id", () => {
  const created = createOfficialTemplateComposition(validCompositionInputFixture());
  assertSuccess(created, "expected composition creation success");

  const found = findOfficialTemplateBlock(created.composition, "does-not-exist");
  assertEqual(found, null, "expected null for an unknown block id");
});

runTest("listOfficialTemplateBlocks returns a flattened, deterministic pre-order list", () => {
  const created = createOfficialTemplateComposition(validCompositionInputFixture());
  assertSuccess(created, "expected composition creation success");

  const blocks = listOfficialTemplateBlocks(created.composition);
  assertEqual(blocks.length, 4, "expected 4 total blocks (2 roots + 2 nested children)");
  assertEqual(blocks.map((block) => block.id).join(","), "block-header,block-body,block-contract-info,block-owner-info", "unexpected flattened order");
});

runTest("summarizeOfficialTemplateComposition matches the composition state", () => {
  const created = createOfficialTemplateComposition(validCompositionInputFixture());
  assertSuccess(created, "expected composition creation success");

  const summary = summarizeOfficialTemplateComposition(created.composition);

  assertEqual(summary.totalBlocks, 4, "totalBlocks mismatch");
  assertEqual(summary.rootBlockCount, 2, "rootBlockCount mismatch");
  assertEqual(summary.requiredBlocks, 2, "requiredBlocks mismatch");
  assertEqual(summary.repeatableBlocks, 1, "repeatableBlocks mismatch");
  assertEqual(summary.maxDepth, 2, "maxDepth mismatch");
});

runTest("composition output is deeply immutable", () => {
  const result = createOfficialTemplateComposition(validCompositionInputFixture());

  assertSuccess(result, "expected composition creation success");
  assertEqual(Object.isFrozen(result), true, "result should be frozen");
  assertEqual(Object.isFrozen(result.composition), true, "composition should be frozen");
  assertEqual(Object.isFrozen(result.composition.rootBlocks), true, "rootBlocks should be frozen");
  assertEqual(Object.isFrozen(result.composition.rootBlocks[0]), true, "a root block should be frozen");
  assertEqual(Object.isFrozen(result.composition.rootBlocks[1]?.children), true, "nested children array should be frozen");
});

runTest("listOfficialTemplateBlocks output is frozen", () => {
  const created = createOfficialTemplateComposition(validCompositionInputFixture());
  assertSuccess(created, "expected composition creation success");

  const blocks = listOfficialTemplateBlocks(created.composition);
  assertEqual(Object.isFrozen(blocks), true, "flattened block list should be frozen");
});

runTest("creation is deterministic for identical input", () => {
  const input = validCompositionInputFixture();
  const first = JSON.stringify(createOfficialTemplateComposition(input));
  const second = JSON.stringify(createOfficialTemplateComposition(input));

  assertEqual(first, second, "expected deterministic composition creation output");
});

runTest("validateOfficialTemplateComposition is deterministic for identical input", () => {
  const created = createOfficialTemplateComposition(validCompositionInputFixture());
  assertSuccess(created, "expected composition creation success");

  const first = JSON.stringify(validateOfficialTemplateComposition(created.composition));
  const second = JSON.stringify(validateOfficialTemplateComposition(created.composition));

  assertEqual(first, second, "expected deterministic validation output");
});

runTest("does not import any forbidden domain or use non-deterministic constructs", () => {
  const sourcePath = resolve(
    process.cwd(),
    "src",
    "domain",
    "official-template-engine",
    "official-template-composition.ts",
  );
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
    "throw ",
  ].forEach((forbidden) => {
    assertEqual(
      sourceCode.includes(forbidden),
      false,
      `unexpected forbidden construct in domain source: ${forbidden}`,
    );
  });
});

function blockInputFixture(overrides: Partial<OfficialTemplateBlockInput> = {}): OfficialTemplateBlockInput {
  return {
    id: overrides.id ?? "block-1",
    type: overrides.type ?? OfficialTemplateBlockType.Text,
    name: overrides.name ?? "Bloco de Texto",
    order: overrides.order ?? 1,
    required: overrides.required,
    repeatable: overrides.repeatable,
    children: overrides.children,
  };
}

function validCompositionInputFixture(): CreateOfficialTemplateCompositionInput {
  const rootBlocks: ReadonlyArray<OfficialTemplateBlockInput> = [
    {
      id: "block-header",
      type: OfficialTemplateBlockType.Header,
      name: "Cabecalho",
      order: 1,
      required: true,
      repeatable: false,
    },
    {
      id: "block-body",
      type: OfficialTemplateBlockType.Text,
      name: "Corpo do Documento",
      order: 2,
      required: true,
      repeatable: true,
      children: [
        {
          id: "block-contract-info",
          type: OfficialTemplateBlockType.ContractInformation,
          name: "Informacoes do Contrato",
          order: 1,
        },
        {
          id: "block-owner-info",
          type: OfficialTemplateBlockType.OwnerInformation,
          name: "Informacoes do Contratante",
          order: 2,
        },
      ],
    },
  ];

  return { rootBlocks };
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
  errors: ReadonlyArray<{ readonly code: string }>,
  code: string,
): void {
  if (!errors.some((error) => error.code === code)) {
    throw new Error(`expected an error with code ${code}, got: ${JSON.stringify(errors)}`);
  }
}

function assertSuccess(
  result: OfficialTemplateCompositionResult,
  message: string,
): asserts result is Extract<OfficialTemplateCompositionResult, { readonly success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertFailure(
  result: OfficialTemplateCompositionResult,
  message: string,
): asserts result is Extract<OfficialTemplateCompositionResult, { readonly success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}
