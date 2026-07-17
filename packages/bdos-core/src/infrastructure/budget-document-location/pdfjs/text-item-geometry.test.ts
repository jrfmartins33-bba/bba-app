import { deriveTextItemPlacement } from "./text-item-geometry";
import type { TextItemGeometryInput, TextItemGeometryStyleInput } from "./text-item-geometry";
import type { PhysicalDocumentTextItemPlacement } from "../../../domain/budget-document-location/physical-document-read.types";

/**
 * Portão de caracterização geométrica (Sprint 21.4A.2.f.0, seções 7-8).
 * Os valores de `viewportTransform`/`itemTransform`/`itemWidth`/`style`
 * usados abaixo para 0°/90°/180°/270°, `viewBox` deslocado, `userUnit` e
 * coordenadas fracionárias foram lidos diretamente da `pdfjs-dist@6.1.200`
 * real (`page.getViewport(...)`, `page.getTextContent()`) sobre PDFs
 * sintéticos hand-rolled equivalentes aos de
 * `testing/synthetic-pdf-bytes.ts` — não valores inventados. As bounding
 * boxes esperadas foram derivadas de forma independente (script de
 * caracterização, não o código de produção) e canonicalizadas com a
 * mesma política de seis casas decimais.
 */

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const HELVETICA_24PT_STYLE: TextItemGeometryStyleInput = { ascent: 0.718, descent: -0.207, vertical: false };

function assertPlaced(
  placement: PhysicalDocumentTextItemPlacement,
): asserts placement is Extract<PhysicalDocumentTextItemPlacement, { status: "placed" }> {
  if (placement.status !== "placed") {
    throw new Error(`expected status "placed", got "${placement.status}" (reasonCode: ${String(placement.reasonCode)})`);
  }
}

function assertUnresolved(
  placement: PhysicalDocumentTextItemPlacement,
  expectedStatus: Exclude<PhysicalDocumentTextItemPlacement["status"], "placed">,
  expectedReasonCode: string,
): void {
  assertEqual(placement.status, expectedStatus);
  assertEqual(placement.geometry, null);
  assertEqual(placement.reasonCode, expectedReasonCode);
}

function baseInput(overrides: Partial<TextItemGeometryInput> = {}): TextItemGeometryInput {
  return {
    itemTransform: [24, 0, 0, 24, 72, 700],
    itemWidth: 32.016,
    itemDir: "ltr",
    style: HELVETICA_24PT_STYLE,
    viewportTransform: [1, 0, 0, -1, 0, 792],
    pageWidthPoints: 612,
    pageHeightPoints: 792,
    ...overrides,
  };
}

// --- 1-4: the four supported page rotations (empirically verified against real pdfjs-dist@6.1.200) ---

runTest("scenario 1: page rotation 0deg produces the expected canonical bounding box", () => {
  const placement = deriveTextItemPlacement(baseInput());
  assertPlaced(placement);
  assertEqual(placement.geometry.leftPoints, 72);
  assertEqual(placement.geometry.topPoints, 74.768);
  assertEqual(placement.geometry.rightPoints, 104.016);
  assertEqual(placement.geometry.bottomPoints, 96.968);
  assertEqual(placement.geometry.widthPoints, 32.016);
  assertEqual(placement.geometry.heightPoints, 22.2);
  assertEqual(placement.geometry.centerXPoints, 88.008);
  assertEqual(placement.geometry.centerYPoints, 85.868);
  assertEqual(placement.geometry.pageBoundsRelation, "inside");
});

runTest("scenario 2: page rotation 90deg produces the expected canonical bounding box", () => {
  const placement = deriveTextItemPlacement(
    baseInput({ viewportTransform: [0, 1, 1, 0, 0, 0], pageWidthPoints: 792, pageHeightPoints: 612 }),
  );
  assertPlaced(placement);
  assertEqual(placement.geometry.leftPoints, 695.032);
  assertEqual(placement.geometry.topPoints, 72);
  assertEqual(placement.geometry.rightPoints, 717.232);
  assertEqual(placement.geometry.bottomPoints, 104.016);
  assertEqual(placement.geometry.pageBoundsRelation, "inside");
});

runTest("scenario 3: page rotation 180deg produces the expected canonical bounding box", () => {
  const placement = deriveTextItemPlacement(baseInput({ viewportTransform: [-1, 0, 0, 1, 612, 0] }));
  assertPlaced(placement);
  assertEqual(placement.geometry.leftPoints, 507.984);
  assertEqual(placement.geometry.topPoints, 695.032);
  assertEqual(placement.geometry.rightPoints, 540);
  assertEqual(placement.geometry.bottomPoints, 717.232);
});

runTest("scenario 4: page rotation 270deg produces the expected canonical bounding box", () => {
  const placement = deriveTextItemPlacement(
    baseInput({ viewportTransform: [0, -1, -1, 0, 792, 612], pageWidthPoints: 792, pageHeightPoints: 612 }),
  );
  assertPlaced(placement);
  assertEqual(placement.geometry.leftPoints, 74.768);
  assertEqual(placement.geometry.topPoints, 507.984);
  assertEqual(placement.geometry.rightPoints, 96.968);
  assertEqual(placement.geometry.bottomPoints, 540);
});

// --- 5: shifted viewBox (translation absorbed by viewport.transform, item unaffected) ---

runTest("scenario 5: a shifted viewBox origin is fully absorbed by viewportTransform, same result as unshifted", () => {
  const placement = deriveTextItemPlacement(
    baseInput({ viewportTransform: [1, 0, 0, -1, -100, 892], itemTransform: [24, 0, 0, 24, 172, 800] }),
  );
  assertPlaced(placement);
  assertEqual(placement.geometry.leftPoints, 72);
  assertEqual(placement.geometry.rightPoints, 104.016);
  assertEqual(placement.geometry.topPoints, 74.768);
  assertEqual(placement.geometry.bottomPoints, 96.968);
});

// --- 6: userUnit != 1 ---

runTest("scenario 6: userUnit 2 scales the bounding box through viewportTransform", () => {
  const placement = deriveTextItemPlacement(
    baseInput({ viewportTransform: [2, 0, 0, -2, 0, 1584], pageWidthPoints: 1224, pageHeightPoints: 1584 }),
  );
  assertPlaced(placement);
  assertEqual(placement.geometry.leftPoints, 144);
  assertEqual(placement.geometry.topPoints, 149.536);
  assertEqual(placement.geometry.rightPoints, 208.032);
  assertEqual(placement.geometry.bottomPoints, 193.936);
});

// --- 7: fractional coordinates ---

runTest("scenario 7: fractional coordinates and font size canonicalize without drift", () => {
  const placement = deriveTextItemPlacement(
    baseInput({ itemTransform: [13.5, 0, 0, 13.5, 72.333, 700.777], itemWidth: 18.009 }),
  );
  assertPlaced(placement);
  assertEqual(placement.geometry.leftPoints, 72.333);
  assertEqual(placement.geometry.topPoints, 81.53);
  assertEqual(placement.geometry.rightPoints, 90.342);
  assertEqual(placement.geometry.bottomPoints, 94.0175);
  assertEqual(placement.geometry.widthPoints, 18.009);
  assertEqual(placement.geometry.heightPoints, 12.4875);
  assertEqual(placement.geometry.centerXPoints, 81.3375);
  assertEqual(placement.geometry.centerYPoints, 87.77375);
});

// --- 8-9: horizontal text, ltr ---

runTest("scenario 8-9: common horizontal ltr text is placed", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemDir: "ltr" }));
  assertEqual(placement.status, "placed");
});

// --- 10: rtl explicitly unsupported in this version ---

runTest("scenario 10: rtl is explicitly unsupported in this version (no synthetic proof available)", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemDir: "rtl" }));
  assertUnresolved(placement, "unresolved_unsupported_orientation", "text_item_orientation_unsupported");
});

// --- 11: ttb (vertical) unsupported ---

runTest("scenario 11: ttb direction is unsupported", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemDir: "ttb" }));
  assertUnresolved(placement, "unresolved_unsupported_orientation", "text_item_orientation_unsupported");
});

runTest("scenario 11b: style.vertical=true is unsupported even if dir reports ltr", () => {
  const placement = deriveTextItemPlacement(baseInput({ style: { ascent: 0.718, descent: -0.207, vertical: true } }));
  assertUnresolved(placement, "unresolved_unsupported_orientation", "text_item_orientation_unsupported");
});

// --- 12: inclined matrix ---

runTest("scenario 12: an inclined (rotated) item transform is unsupported, not silently boxed", () => {
  const placement = deriveTextItemPlacement(
    baseInput({ itemTransform: [16.9704, 16.9704, -16.9704, 16.9704, 200, 400] }),
  );
  assertUnresolved(placement, "unresolved_unsupported_orientation", "text_item_orientation_unsupported");
});

// --- 13: sheared matrix ---

runTest("scenario 13: a sheared item transform is unsupported, not silently boxed", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemTransform: [24, 7.2, 4.8, 24, 72, 700] }));
  assertUnresolved(placement, "unresolved_unsupported_orientation", "text_item_orientation_unsupported");
});

// --- 14: transform absent ---

runTest("scenario 14: an absent item transform is missing geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemTransform: null }));
  assertUnresolved(placement, "unresolved_missing_geometry", "text_item_geometry_missing");
});

runTest("scenario 14b: an absent viewport transform is missing geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ viewportTransform: undefined }));
  assertUnresolved(placement, "unresolved_missing_geometry", "text_item_geometry_missing");
});

// --- 15: incomplete transform ---

runTest("scenario 15: an incomplete (wrong-length) item transform is invalid geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemTransform: [24, 0, 0, 24, 72] }));
  assertUnresolved(placement, "unresolved_invalid_geometry", "text_item_geometry_invalid");
});

// --- 16: non-finite transform ---

runTest("scenario 16: a non-finite item transform component is invalid geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemTransform: [24, 0, 0, Number.NaN, 72, 700] }));
  assertUnresolved(placement, "unresolved_invalid_geometry", "text_item_geometry_invalid");
});

runTest("scenario 16b: an infinite item transform component is invalid geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemTransform: [24, 0, 0, 24, Number.POSITIVE_INFINITY, 700] }));
  assertUnresolved(placement, "unresolved_invalid_geometry", "text_item_geometry_invalid");
});

// --- 17: negative width ---

runTest("scenario 17: a negative item width is invalid geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemWidth: -5 }));
  assertUnresolved(placement, "unresolved_invalid_geometry", "text_item_geometry_invalid");
});

// --- 18: zero width ---

runTest("scenario 18: a zero item width is permitted and produces a zero-width placed geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemWidth: 0 }));
  assertPlaced(placement);
  assertEqual(placement.geometry.widthPoints, 0);
  assertEqual(placement.geometry.leftPoints, placement.geometry.rightPoints);
});

// --- 19: non-finite width ---

runTest("scenario 19: a non-finite item width is invalid geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemWidth: Number.NaN }));
  assertUnresolved(placement, "unresolved_invalid_geometry", "text_item_geometry_invalid");
});

// --- 20: style absent ---

runTest("scenario 20: an absent style is missing geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ style: null }));
  assertUnresolved(placement, "unresolved_missing_geometry", "text_item_geometry_missing");
});

// --- 21: invalid ascent ---

runTest("scenario 21: a non-finite ascent is invalid geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ style: { ascent: Number.NaN, descent: -0.207, vertical: false } }));
  assertUnresolved(placement, "unresolved_invalid_geometry", "text_item_geometry_invalid");
});

// --- 22: invalid descent ---

runTest("scenario 22: a non-finite descent is invalid geometry", () => {
  const placement = deriveTextItemPlacement(
    baseInput({ style: { ascent: 0.718, descent: Number.NEGATIVE_INFINITY, vertical: false } }),
  );
  assertUnresolved(placement, "unresolved_invalid_geometry", "text_item_geometry_invalid");
});

// --- 23-25: page bounds relation ---

runTest("scenario 23: bounds entirely inside the page is inside", () => {
  const placement = deriveTextItemPlacement(baseInput());
  assertPlaced(placement);
  assertEqual(placement.geometry.pageBoundsRelation, "inside");
});

runTest("scenario 24: bounds partially outside the page is partially_outside", () => {
  const placement = deriveTextItemPlacement(baseInput({ pageWidthPoints: 100, pageHeightPoints: 792 }));
  assertPlaced(placement);
  assertEqual(placement.geometry.pageBoundsRelation, "partially_outside");
});

runTest("scenario 25: bounds entirely outside the page is outside", () => {
  const placement = deriveTextItemPlacement(baseInput({ pageWidthPoints: 10, pageHeightPoints: 10 }));
  assertPlaced(placement);
  assertEqual(placement.geometry.pageBoundsRelation, "outside");
  // never clamped: bounds are unchanged regardless of being outside the (much smaller) page
  assertEqual(placement.geometry.rightPoints, 104.016);
});

// --- 36: -0 normalized ---

runTest("scenario 36: a computed -0 boundary is normalized to positive zero", () => {
  // item transform placed so that left edge lands exactly at x=0 pre-rounding.
  const placement = deriveTextItemPlacement(baseInput({ itemTransform: [24, 0, 0, 24, 0, 700] }));
  assertPlaced(placement);
  assertEqual(Object.is(placement.geometry.leftPoints, 0), true);
});

// --- 37-38: near-zero rounding ---

runTest("scenario 37-38: near-zero magnitudes on either side of zero canonicalize deterministically", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemTransform: [24, 0, 0, 24, 0.0000001, 700] }));
  assertPlaced(placement);
  assertEqual(placement.geometry.leftPoints, 0);
});

// --- degenerate: ascent === descent (zero effective height) ---

runTest("degenerate style with ascent equal to descent produces zero height, which is invalid", () => {
  const placement = deriveTextItemPlacement(baseInput({ style: { ascent: 0.5, descent: 0.5, vertical: false } }));
  assertUnresolved(placement, "unresolved_invalid_geometry", "text_item_geometry_invalid");
});

// --- degenerate: font size zero (y-axis magnitude zero) ---

runTest("a zero font-size y-axis (degenerate transform) is invalid geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ itemTransform: [24, 0, 0, 0, 72, 700] }));
  assertUnresolved(placement, "unresolved_invalid_geometry", "text_item_geometry_invalid");
});

// --- page geometry present but invalid ---

runTest("a non-positive page width is invalid geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ pageWidthPoints: 0 }));
  assertUnresolved(placement, "unresolved_invalid_geometry", "text_item_geometry_invalid");
});

runTest("a non-finite page height is invalid geometry", () => {
  const placement = deriveTextItemPlacement(baseInput({ pageHeightPoints: Number.NaN }));
  assertUnresolved(placement, "unresolved_invalid_geometry", "text_item_geometry_invalid");
});

// --- determinism / repeatability at the function level ---

runTest("is deterministic: identical input produces an identical (JSON-equivalent) placement", () => {
  const input = baseInput();
  const first = deriveTextItemPlacement(input);
  const second = deriveTextItemPlacement({ ...input });
  assertEqual(JSON.stringify(first), JSON.stringify(second));
});

runTest("does not mutate its input", () => {
  const input = baseInput();
  const frozenTransform = Object.freeze([...input.itemTransform as number[]]);
  deriveTextItemPlacement({ ...input, itemTransform: frozenTransform });
  assertEqual(frozenTransform.length, 6);
});
