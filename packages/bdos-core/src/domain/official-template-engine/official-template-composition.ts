/**
 * Structural composition model for official documents: a document is
 * described as a tree of reusable blocks (header, sections, tables,
 * signatures, etc). This module only describes the *logical* structure
 * of a document — it knows nothing about layout, rendering, contracts,
 * measurement, engineering, or persistence, and does not integrate with
 * the `OfficialTemplate` aggregate (Sprint 11.5.1), the validation engine
 * (Sprint 11.5.2), or the catalog (Sprint 11.5.3). It is a standalone,
 * self-contained modeling concept, consistent with this sprint's
 * "NÃO faz integração" constraint.
 */
import { freezeDomainObject, isBlank } from "./official-template-shared";

export enum OfficialTemplateBlockType {
  Header = "HEADER",
  Title = "TITLE",
  Subtitle = "SUBTITLE",
  ContractInformation = "CONTRACT_INFORMATION",
  OwnerInformation = "OWNER_INFORMATION",
  ProjectInformation = "PROJECT_INFORMATION",
  ExecutionInformation = "EXECUTION_INFORMATION",
  WorkFront = "WORK_FRONT",
  Segment = "SEGMENT",
  Structure = "STRUCTURE",
  MeasurementTable = "MEASUREMENT_TABLE",
  Text = "TEXT",
  Photo = "PHOTO",
  PhotoGallery = "PHOTO_GALLERY",
  Observation = "OBSERVATION",
  Signature = "SIGNATURE",
  Footer = "FOOTER",
  Annex = "ANNEX",
  SectionBreak = "SECTION_BREAK",
}

export type OfficialTemplateBlockId = string;

export interface OfficialTemplateBlock {
  readonly id: OfficialTemplateBlockId;
  readonly type: OfficialTemplateBlockType;
  readonly name: string;
  readonly order: number;
  readonly required: boolean;
  readonly repeatable: boolean;
  readonly children: ReadonlyArray<OfficialTemplateBlock>;
}

export interface OfficialTemplateBlockInput {
  readonly id: OfficialTemplateBlockId;
  readonly type: OfficialTemplateBlockType;
  readonly name: string;
  readonly order: number;
  readonly required?: boolean;
  readonly repeatable?: boolean;
  readonly children?: ReadonlyArray<OfficialTemplateBlockInput> | null;
}

export interface OfficialTemplateComposition {
  readonly rootBlocks: ReadonlyArray<OfficialTemplateBlock>;
}

export interface CreateOfficialTemplateCompositionInput {
  readonly rootBlocks: ReadonlyArray<OfficialTemplateBlockInput>;
}

export interface OfficialTemplateCompositionSummary {
  readonly totalBlocks: number;
  readonly rootBlockCount: number;
  readonly requiredBlocks: number;
  readonly repeatableBlocks: number;
  readonly maxDepth: number;
}

export type OfficialTemplateCompositionErrorCode =
  | "missing_block_id"
  | "duplicate_block_id"
  | "missing_block_type"
  | "missing_block_name"
  | "invalid_block_order"
  | "duplicate_block_order"
  | "circular_block_reference";

export interface OfficialTemplateCompositionError {
  readonly code: OfficialTemplateCompositionErrorCode;
  readonly message: string;
  readonly path: string;
}

export interface OfficialTemplateCompositionSuccess {
  readonly success: true;
  readonly composition: OfficialTemplateComposition;
  readonly errors: ReadonlyArray<OfficialTemplateCompositionError>;
}

export interface OfficialTemplateCompositionFailure {
  readonly success: false;
  readonly composition: null;
  readonly errors: ReadonlyArray<OfficialTemplateCompositionError>;
}

export type OfficialTemplateCompositionResult =
  | OfficialTemplateCompositionSuccess
  | OfficialTemplateCompositionFailure;

export interface OfficialTemplateCompositionValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<OfficialTemplateCompositionError>;
}

export function createOfficialTemplateComposition(
  input: CreateOfficialTemplateCompositionInput,
): OfficialTemplateCompositionResult {
  const errors = validateBlockTree(input.rootBlocks, "rootBlocks");

  if (errors.length > 0) {
    return freezeDomainObject<OfficialTemplateCompositionFailure>({
      success: false,
      composition: null,
      errors,
    });
  }

  return freezeDomainObject<OfficialTemplateCompositionSuccess>({
    success: true,
    composition: { rootBlocks: buildBlocks(input.rootBlocks) },
    errors: [],
  });
}

export function validateOfficialTemplateComposition(
  composition: OfficialTemplateComposition,
): OfficialTemplateCompositionValidationResult {
  const errors = validateBlockTree(composition.rootBlocks, "rootBlocks");

  return freezeDomainObject<OfficialTemplateCompositionValidationResult>({
    valid: errors.length === 0,
    errors,
  });
}

export function findOfficialTemplateBlock(
  composition: OfficialTemplateComposition,
  blockId: OfficialTemplateBlockId,
): OfficialTemplateBlock | null {
  return findBlockIn(composition.rootBlocks, blockId);
}

export function listOfficialTemplateBlocks(
  composition: OfficialTemplateComposition,
): ReadonlyArray<OfficialTemplateBlock> {
  return freezeDomainObject<ReadonlyArray<OfficialTemplateBlock>>(flattenBlocks(composition.rootBlocks));
}

export function summarizeOfficialTemplateComposition(
  composition: OfficialTemplateComposition,
): OfficialTemplateCompositionSummary {
  const allBlocks = flattenBlocks(composition.rootBlocks);

  return {
    totalBlocks: allBlocks.length,
    rootBlockCount: composition.rootBlocks.length,
    requiredBlocks: allBlocks.filter((block) => block.required).length,
    repeatableBlocks: allBlocks.filter((block) => block.repeatable).length,
    maxDepth: computeMaxDepth(composition.rootBlocks),
  };
}

interface BlockLike {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly order: number;
  readonly children?: ReadonlyArray<BlockLike> | null;
}

function validateBlockTree(
  blocks: ReadonlyArray<BlockLike>,
  rootPath: string,
): OfficialTemplateCompositionError[] {
  const errors: OfficialTemplateCompositionError[] = [];
  const seenIds = new Set<string>();

  walkBlocks(blocks, rootPath, new Set<BlockLike>(), errors, seenIds);

  return errors;
}

function walkBlocks(
  blocks: ReadonlyArray<BlockLike>,
  path: string,
  ancestors: ReadonlySet<BlockLike>,
  errors: OfficialTemplateCompositionError[],
  seenIds: Set<string>,
): void {
  const siblingOrders = new Set<number>();

  blocks.forEach((block, index) => {
    const blockPath = `${path}[${index}]`;

    if (ancestors.has(block)) {
      errors.push(
        createCompositionError(
          "circular_block_reference",
          `Block at ${blockPath} is its own ancestor, forming a circular reference.`,
          blockPath,
        ),
      );
      return;
    }

    if (isBlank(block.id)) {
      errors.push(createCompositionError("missing_block_id", "Block id is required.", `${blockPath}.id`));
    } else if (seenIds.has(block.id)) {
      errors.push(
        createCompositionError(
          "duplicate_block_id",
          `Block id ${block.id} is duplicated.`,
          `${blockPath}.id`,
        ),
      );
    } else {
      seenIds.add(block.id);
    }

    if (isBlank(block.type)) {
      errors.push(createCompositionError("missing_block_type", "Block type is required.", `${blockPath}.type`));
    }

    if (isBlank(block.name)) {
      errors.push(createCompositionError("missing_block_name", "Block name is required.", `${blockPath}.name`));
    }

    if (!Number.isInteger(block.order) || block.order <= 0) {
      errors.push(
        createCompositionError(
          "invalid_block_order",
          `Block ${block.id} order must be a positive integer, got ${block.order}.`,
          `${blockPath}.order`,
        ),
      );
    } else if (siblingOrders.has(block.order)) {
      errors.push(
        createCompositionError(
          "duplicate_block_order",
          `Block ${block.id} shares order ${block.order} with another block at the same level.`,
          `${blockPath}.order`,
        ),
      );
    } else {
      siblingOrders.add(block.order);
    }

    const children = block.children ?? [];
    if (children.length > 0) {
      const childAncestors = new Set(ancestors);
      childAncestors.add(block);
      walkBlocks(children, `${blockPath}.children`, childAncestors, errors, seenIds);
    }
  });
}

function findBlockIn(
  blocks: ReadonlyArray<OfficialTemplateBlock>,
  blockId: OfficialTemplateBlockId,
): OfficialTemplateBlock | null {
  for (const block of blocks) {
    if (block.id === blockId) {
      return block;
    }

    const found = findBlockIn(block.children, blockId);
    if (found !== null) {
      return found;
    }
  }

  return null;
}

function flattenBlocks(blocks: ReadonlyArray<OfficialTemplateBlock>): OfficialTemplateBlock[] {
  const flattened: OfficialTemplateBlock[] = [];

  blocks.forEach((block) => {
    flattened.push(block);
    flattened.push(...flattenBlocks(block.children));
  });

  return flattened;
}

function computeMaxDepth(blocks: ReadonlyArray<OfficialTemplateBlock>): number {
  if (blocks.length === 0) {
    return 0;
  }

  return 1 + Math.max(...blocks.map((block) => computeMaxDepth(block.children)));
}

function buildBlocks(inputs: ReadonlyArray<OfficialTemplateBlockInput>): ReadonlyArray<OfficialTemplateBlock> {
  return inputs.map((input) => buildBlock(input));
}

function buildBlock(input: OfficialTemplateBlockInput): OfficialTemplateBlock {
  return {
    id: input.id,
    type: input.type,
    name: input.name,
    order: input.order,
    required: input.required ?? false,
    repeatable: input.repeatable ?? false,
    children: buildBlocks(input.children ?? []),
  };
}

function createCompositionError(
  code: OfficialTemplateCompositionErrorCode,
  message: string,
  path: string,
): OfficialTemplateCompositionError {
  return { code, message, path };
}

