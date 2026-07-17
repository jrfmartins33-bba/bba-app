import {
  STRUCTURE_RECONSTRUCTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION,
  canonicalizeOutputGaps,
  canonicalizeOutputGeometryBounds,
  canonicalizeStructureReconstructionOutputGeometry,
} from "./structure-reconstruction-output-geometry-canonicalization";

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "values differ"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

runTest("has a stable version identity", () => {
  assertEqual(STRUCTURE_RECONSTRUCTION_OUTPUT_GEOMETRY_CANONICALIZATION_VERSION, "structure-reconstruction-output-geometry-canonicalization-v1");
});

runTest("removes the classic binary floating point artifact of 0.1 + 0.2", () => {
  const artifact = 0.1 + 0.2; // 0.30000000000000004
  assertEqual(artifact === 0.3, false, "test setup: this must actually be an artifact, not already clean");
  assertEqual(canonicalizeStructureReconstructionOutputGeometry(artifact), 0.3);
});

runTest("removes the artifact from a right-minus-left width subtraction", () => {
  const left = 1;
  const right = 1 + (0.1 + 0.2); // 1.3000000000000003
  const rawWidth = right - left; // 0.30000000000000004
  assertEqual(canonicalizeStructureReconstructionOutputGeometry(rawWidth), 0.3);
});

runTest("normalizes -0 to 0", () => {
  const negativeZero = -0;
  assertEqual(Object.is(negativeZero, -0), true, "test setup: this must actually be -0");
  assertEqual(Object.is(canonicalizeStructureReconstructionOutputGeometry(negativeZero), -0), false);
  assertEqual(canonicalizeStructureReconstructionOutputGeometry(negativeZero), 0);
});

runTest("rounds to exactly six decimal places, symmetric for negative values", () => {
  assertEqual(canonicalizeStructureReconstructionOutputGeometry(1.23456789), 1.234568);
  assertEqual(canonicalizeStructureReconstructionOutputGeometry(-1.23456789), -1.234568);
});

// --- coerência entre limites, dimensões e centros (auditoria pós-PR #69, §3) ---
// Aplica-se igualmente a linha, segmento e bloco: os três contratos de
// saída compartilham exatamente esta forma geométrica (`GeometryBounds`) e
// passam pela mesma função — não há caminho de canonicalização separado
// por tipo de estrutura.

runTest("derives widthPoints/heightPoints/centerXPoints/centerYPoints from the canonicalized bounds, never from the draft's own raw values", () => {
  const bounds = {
    leftPoints: 0,
    topPoints: 0,
    rightPoints: 0.1 + 0.2, // raw artifact; canonicalizes to 0.3
    bottomPoints: 0.1 + 0.2,
    // Deliberately inconsistent with left/top/right/bottom, to prove these
    // raw fields are never used as the source of the derived output.
    widthPoints: 999,
    heightPoints: 999,
    centerXPoints: 999,
    centerYPoints: 999,
  };
  const canonical = canonicalizeOutputGeometryBounds(bounds);
  assertEqual(canonical.leftPoints, 0);
  assertEqual(canonical.rightPoints, 0.3);
  assertEqual(canonical.widthPoints, 0.3, "width must be derived from canonicalized right-left, never the raw draft value");
  assertEqual(canonical.heightPoints, 0.3);
  assertEqual(canonical.centerXPoints, 0.15, "center must be derived from the canonicalized bounds, never the raw draft value");
  assertEqual(canonical.centerYPoints, 0.15);
});

runTest("a degenerate zero-size box (left === right) canonicalizes to zero width/height, not the pre-canonicalization artifact", () => {
  const artifact = 0.1 + 0.2;
  const bounds = {
    leftPoints: artifact,
    topPoints: artifact,
    rightPoints: artifact,
    bottomPoints: artifact,
    widthPoints: artifact,
    heightPoints: artifact,
    centerXPoints: artifact,
    centerYPoints: artifact,
    horizontalOrder: 7,
  };
  const canonical = canonicalizeOutputGeometryBounds(bounds);
  assertEqual(canonical.leftPoints, 0.3);
  assertEqual(canonical.rightPoints, 0.3);
  assertEqual(canonical.widthPoints, 0, "left === right after canonicalization must derive a zero width, never re-canonicalize the stale raw width");
  assertEqual(canonical.heightPoints, 0);
  assertEqual(canonical.centerXPoints, 0.3);
  assertEqual(canonical.centerYPoints, 0.3);
  assertEqual(canonical.horizontalOrder, 7, "non-geometric fields must be preserved unchanged");
});

runTest("adversarial: bounds straddling the six-decimal rounding boundary remain internally coherent (left=0.0000004, right=0.0000006)", () => {
  const bounds = {
    leftPoints: 0.0000004,
    topPoints: 0.0000004,
    rightPoints: 0.0000006,
    bottomPoints: 0.0000006,
    widthPoints: 0,
    heightPoints: 0,
    centerXPoints: 0,
    centerYPoints: 0,
  };
  const canonical = canonicalizeOutputGeometryBounds(bounds);

  // The two raw inputs round to different sides of the boundary
  // (0.0000004 -> 0, 0.0000006 -> 0.000001) — exactly the scenario that
  // independent per-field canonicalization could get wrong.
  assertEqual(canonical.leftPoints, 0);
  assertEqual(canonical.rightPoints, 0.000001);
  assertEqual(canonical.leftPoints <= canonical.rightPoints, true);
  assertEqual(canonical.topPoints <= canonical.bottomPoints, true);
  assertEqual(canonical.widthPoints >= 0, true);
  assertEqual(canonical.heightPoints >= 0, true);
  assertEqual(canonical.widthPoints, canonicalizeStructureReconstructionOutputGeometry(canonical.rightPoints - canonical.leftPoints));
  assertEqual(canonical.heightPoints, canonicalizeStructureReconstructionOutputGeometry(canonical.bottomPoints - canonical.topPoints));
  assertEqual(canonical.centerXPoints, canonicalizeStructureReconstructionOutputGeometry((canonical.leftPoints + canonical.rightPoints) / 2));
  assertEqual(canonical.centerYPoints, canonicalizeStructureReconstructionOutputGeometry((canonical.topPoints + canonical.bottomPoints) / 2));
});

runTest("throws when handed bounds that are already internally incoherent before canonicalization (defensive integrity guard)", () => {
  // right < left after canonicalization is impossible from any of this
  // Sprint's own line/segment/block algorithms (they always compute right
  // via max and left via min), but the guard must still catch it if it
  // were ever to happen — proving the guard is not dead code.
  const bounds = {
    leftPoints: 10,
    topPoints: 0,
    rightPoints: 5,
    bottomPoints: 10,
    widthPoints: 0,
    heightPoints: 0,
    centerXPoints: 0,
    centerYPoints: 0,
  };
  let threw = false;
  try {
    canonicalizeOutputGeometryBounds(bounds);
  } catch {
    threw = true;
  }
  assertEqual(threw, true, "expected an internally incoherent left/right pair to be rejected, not silently accepted");
});

runTest("canonicalizeOutputGaps canonicalizes every element of the array", () => {
  const artifact = 0.1 + 0.2;
  const canonical = canonicalizeOutputGaps([artifact, 1.0, artifact]);
  assertEqual(JSON.stringify(canonical), JSON.stringify([0.3, 1.0, 0.3]));
});

runTest("canonicalizeOutputGaps preserves an empty array", () => {
  assertEqual(JSON.stringify(canonicalizeOutputGaps([])), JSON.stringify([]));
});
