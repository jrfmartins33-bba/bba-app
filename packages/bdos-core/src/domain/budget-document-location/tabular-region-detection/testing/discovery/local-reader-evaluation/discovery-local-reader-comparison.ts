/**
 * Algoritmo de comparação estrutural congelado (§8 do protocolo,
 * Momento 3A). Associação determinística, nesta ordem fixa: (1) mesma
 * página; (2) compatibilidade espacial; (3) texto literal normalizado;
 * (4) ordem física; (5) desempate por identidade canônica. Esta ordem
 * não muda depois de observar resultados reais.
 *
 * Modelo: um grafo de compatibilidade página a página, com uma aresta
 * observado–esperado quando há sobreposição espacial estrita OU texto
 * normalizado idêntico. Cada componente conexo é classificado em
 * exatamente uma das oito categorias exigidas. Nós isolados (sem
 * nenhuma aresta) são, por definição, `expected_cell_omitted` (lado
 * esperado) ou `invented_cell` (lado observado).
 *
 * Caso raro N:M (múltiplos esperados conectados a múltiplos
 * observados, por cadeia de sobreposição/toque): classificado por uma
 * regra de desempate fixa (mais observados que esperados → dividida;
 * caso contrário → fundida) — documentado aqui porque o enunciado só
 * define os casos pareados; nunca ajustado após observar dados reais.
 */

import { computeLocalReaderTextualDistance, normalizeLocalReaderText } from "./discovery-local-reader-normalization";
import type {
  LocalReaderCellComparisonOutcome,
  LocalReaderCellComparisonResult,
  LocalReaderConvertedBoundingBox,
  LocalReaderExpectedCellRef,
  LocalReaderExpectedRegionRef,
  LocalReaderObservedCellRef,
  LocalReaderObservedRegionRef,
  LocalReaderRegionComparisonResult,
} from "./discovery-local-reader-evaluation.types";

export function boxesOverlapStrictly(a: LocalReaderConvertedBoundingBox, b: LocalReaderConvertedBoundingBox): boolean {
  const overlapX = Math.min(a.rightPoints, b.rightPoints) - Math.max(a.leftPoints, b.leftPoints);
  const overlapY = Math.min(a.bottomPoints, b.bottomPoints) - Math.max(a.topPoints, b.topPoints);
  return overlapX > 0 && overlapY > 0;
}

type NodeRef = { readonly side: "expected"; readonly index: number } | { readonly side: "observed"; readonly index: number };

function nodeKey(node: NodeRef): string {
  return `${node.side}:${node.index}`;
}

export function associateObservedCellsToReference(
  expectedCells: ReadonlyArray<LocalReaderExpectedCellRef>,
  observedCells: ReadonlyArray<LocalReaderObservedCellRef>,
): ReadonlyArray<LocalReaderCellComparisonResult> {
  const results: LocalReaderCellComparisonResult[] = [];
  const pages = new Set<number>([...expectedCells.map((e) => e.realPageNumber), ...observedCells.map((o) => o.realPageNumber)]);

  for (const page of [...pages].sort((a, b) => a - b)) {
    const expected = expectedCells.filter((e) => e.realPageNumber === page).map((e) => ({ ...e, normalizedText: normalizeLocalReaderText(e.normalizedText) }));
    const observed = observedCells.filter((o) => o.realPageNumber === page).map((o) => ({ ...o, normalizedText: normalizeLocalReaderText(o.normalizedText) }));

    // adjacency[expectedIndex] = Set of observedIndex, and vice versa
    const expectedNeighbors: Set<number>[] = expected.map(() => new Set());
    const observedNeighbors: Set<number>[] = observed.map(() => new Set());

    for (let ei = 0; ei < expected.length; ei += 1) {
      for (let oi = 0; oi < observed.length; oi += 1) {
        const e = expected[ei];
        const o = observed[oi];
        const spatial = e.boundingBox !== null && o.boundingBox !== null && boxesOverlapStrictly(e.boundingBox, o.boundingBox);
        const textMatch = e.normalizedText === o.normalizedText;
        if (spatial || textMatch) {
          expectedNeighbors[ei].add(oi);
          observedNeighbors[oi].add(ei);
        }
      }
    }

    const visitedExpected = new Set<number>();
    const visitedObserved = new Set<number>();
    const allNodes: NodeRef[] = [
      ...expected.map((_, index): NodeRef => ({ side: "expected", index })),
      ...observed.map((_, index): NodeRef => ({ side: "observed", index })),
    ].sort((a, b) => {
      const idA = a.side === "expected" ? expected[a.index].id : observed[a.index].id;
      const idB = b.side === "expected" ? expected[b.index].id : observed[b.index].id;
      return idA.localeCompare(idB);
    });

    for (const startNode of allNodes) {
      if (startNode.side === "expected" && visitedExpected.has(startNode.index)) continue;
      if (startNode.side === "observed" && visitedObserved.has(startNode.index)) continue;

      const componentExpected: number[] = [];
      const componentObserved: number[] = [];
      const queue: NodeRef[] = [startNode];
      const queued = new Set<string>([nodeKey(startNode)]);

      while (queue.length > 0) {
        const node = queue.shift()!;
        if (node.side === "expected") {
          if (visitedExpected.has(node.index)) continue;
          visitedExpected.add(node.index);
          componentExpected.push(node.index);
          for (const oi of expectedNeighbors[node.index]) {
            const key = nodeKey({ side: "observed", index: oi });
            if (!queued.has(key)) {
              queued.add(key);
              queue.push({ side: "observed", index: oi });
            }
          }
        } else {
          if (visitedObserved.has(node.index)) continue;
          visitedObserved.add(node.index);
          componentObserved.push(node.index);
          for (const ei of observedNeighbors[node.index]) {
            const key = nodeKey({ side: "expected", index: ei });
            if (!queued.has(key)) {
              queued.add(key);
              queue.push({ side: "expected", index: ei });
            }
          }
        }
      }

      componentExpected.sort((a, b) => expected[a].id.localeCompare(expected[b].id));
      componentObserved.sort((a, b) => observed[a].id.localeCompare(observed[b].id));

      results.push(classifyComponent(expected, observed, componentExpected, componentObserved));
    }
  }

  return results.sort((a, b) => a.id.localeCompare(b.id));
}

function classifyComponent(
  expected: ReadonlyArray<LocalReaderExpectedCellRef>,
  observed: ReadonlyArray<LocalReaderObservedCellRef>,
  componentExpectedIndices: ReadonlyArray<number>,
  componentObservedIndices: ReadonlyArray<number>,
): LocalReaderCellComparisonResult {
  const expectedNodes = componentExpectedIndices.map((i) => expected[i]);
  const observedNodes = componentObservedIndices.map((i) => observed[i]);
  const referenceCellIds = expectedNodes.map((e) => e.id);
  const observedCellIds = observedNodes.map((o) => o.id);
  const id = `cmp-${[...referenceCellIds, ...observedCellIds].sort().join("+") || "empty"}`;

  if (expectedNodes.length === 0) {
    return {
      id,
      referenceCellIds,
      observedCellIds,
      outcome: "invented_cell",
      normalizedExpectedText: null,
      normalizedObservedText: observedNodes[0]?.normalizedText ?? null,
      textualDistance: null,
      associationBasisPt: "Célula observada sem nenhuma correspondência espacial ou textual com qualquer célula esperada da página — nenhum valor monetário ou textual desta origem é presumido verdadeiro.",
    };
  }
  if (observedNodes.length === 0) {
    return {
      id,
      referenceCellIds,
      observedCellIds,
      outcome: "expected_cell_omitted",
      normalizedExpectedText: expectedNodes[0]?.normalizedText ?? null,
      normalizedObservedText: null,
      textualDistance: null,
      associationBasisPt: "Célula esperada sem nenhuma correspondência espacial ou textual entre as células observadas da página.",
    };
  }

  if (expectedNodes.length === 1 && observedNodes.length === 1) {
    const e = expectedNodes[0];
    const o = observedNodes[0];
    const spatial = e.boundingBox !== null && o.boundingBox !== null && boxesOverlapStrictly(e.boundingBox, o.boundingBox);
    const textEq = e.normalizedText === o.normalizedText;
    const columnMismatch = e.columnId !== null && o.columnId !== null && e.columnId !== o.columnId;
    const distance = computeLocalReaderTextualDistance(e.normalizedText, o.normalizedText);

    let outcome: LocalReaderCellComparisonOutcome;
    let basisPt: string;
    if (textEq && columnMismatch) {
      outcome = "correct_text_wrong_column";
      basisPt = `Texto normalizado idêntico, mas coluna proposta ('${o.columnId}') diverge da coluna esperada ('${e.columnId}').`;
    } else if (textEq && (e.boundingBox === null || o.boundingBox === null)) {
      outcome = "correct_text_no_usable_coordinate";
      basisPt = "Texto normalizado idêntico, mas ao menos um lado não possui caixa delimitadora convertida utilizável (conversão interrompida ou ausente).";
    } else if (spatial && !textEq) {
      outcome = "correct_coordinate_wrong_text";
      basisPt = "Sobreposição espacial estrita confirmada, mas o texto normalizado diverge — nenhuma correção automática aplicada.";
    } else {
      outcome = "direct_match";
      basisPt = spatial ? "Sobreposição espacial estrita e texto normalizado idêntico." : "Texto normalizado idêntico (sem contradição de coluna ou coordenada disponível para avaliar sobreposição).";
    }

    return {
      id,
      referenceCellIds,
      observedCellIds,
      outcome,
      normalizedExpectedText: e.normalizedText,
      normalizedObservedText: o.normalizedText,
      textualDistance: distance,
      associationBasisPt: basisPt,
    };
  }

  if (expectedNodes.length === 1 && observedNodes.length > 1) {
    return {
      id,
      referenceCellIds,
      observedCellIds,
      outcome: "expected_cell_split_into_multiple_observed",
      normalizedExpectedText: expectedNodes[0].normalizedText,
      normalizedObservedText: observedNodes.map((o) => o.normalizedText).join(" | "),
      textualDistance: null,
      associationBasisPt: `Uma célula esperada corresponde, por compatibilidade espacial/textual, a ${observedNodes.length} células observadas distintas.`,
    };
  }

  if (expectedNodes.length > 1 && observedNodes.length === 1) {
    return {
      id,
      referenceCellIds,
      observedCellIds,
      outcome: "multiple_expected_cells_merged",
      normalizedExpectedText: expectedNodes.map((e) => e.normalizedText).join(" | "),
      normalizedObservedText: observedNodes[0].normalizedText,
      textualDistance: null,
      associationBasisPt: `${expectedNodes.length} células esperadas correspondem a uma única célula observada.`,
    };
  }

  // N:M raro (cadeia de sobreposição/toque): desempate fixo, pré-registrado,
  // nunca ajustado após observar dados reais (ver cabeçalho deste arquivo).
  const outcome: LocalReaderCellComparisonOutcome = observedNodes.length > expectedNodes.length ? "expected_cell_split_into_multiple_observed" : "multiple_expected_cells_merged";
  return {
    id,
    referenceCellIds,
    observedCellIds,
    outcome,
    normalizedExpectedText: expectedNodes.map((e) => e.normalizedText).join(" | "),
    normalizedObservedText: observedNodes.map((o) => o.normalizedText).join(" | "),
    textualDistance: null,
    associationBasisPt: `Componente N:M (${expectedNodes.length} esperadas × ${observedNodes.length} observadas) — classificado pela regra de desempate fixa do protocolo (§8).`,
  };
}

// --- Comparação de regiões (§9.2 — mais grosseira que a de células:
// recuperada/omitida/adicional/texto divergente, sem distinguir
// divisão/fusão, que é escopo exclusivo de células em §9.3) ----------------

export function associateObservedRegionsToReference(
  expectedRegions: ReadonlyArray<LocalReaderExpectedRegionRef>,
  observedRegions: ReadonlyArray<LocalReaderObservedRegionRef>,
): ReadonlyArray<LocalReaderRegionComparisonResult> {
  const results: LocalReaderRegionComparisonResult[] = [];
  const pages = new Set<number>([...expectedRegions.map((e) => e.realPageNumber), ...observedRegions.map((o) => o.realPageNumber)]);

  for (const page of [...pages].sort((a, b) => a - b)) {
    const expected = expectedRegions.filter((e) => e.realPageNumber === page).map((e) => ({ ...e, normalizedText: normalizeLocalReaderText(e.normalizedText) }));
    const observed = observedRegions.filter((o) => o.realPageNumber === page).map((o) => ({ ...o, normalizedText: normalizeLocalReaderText(o.normalizedText) }));

    const expectedNeighbors: Set<number>[] = expected.map(() => new Set());
    const observedNeighbors: Set<number>[] = observed.map(() => new Set());
    for (let ei = 0; ei < expected.length; ei += 1) {
      for (let oi = 0; oi < observed.length; oi += 1) {
        const e = expected[ei];
        const o = observed[oi];
        const spatial = e.boundingBox !== null && o.boundingBox !== null && boxesOverlapStrictly(e.boundingBox, o.boundingBox);
        const textMatch = e.normalizedText === o.normalizedText;
        if (spatial || textMatch) {
          expectedNeighbors[ei].add(oi);
          observedNeighbors[oi].add(ei);
        }
      }
    }

    const visitedExpected = new Set<number>();
    const visitedObserved = new Set<number>();
    const allNodes: NodeRef[] = [
      ...expected.map((_, index): NodeRef => ({ side: "expected", index })),
      ...observed.map((_, index): NodeRef => ({ side: "observed", index })),
    ].sort((a, b) => {
      const idA = a.side === "expected" ? expected[a.index].id : observed[a.index].id;
      const idB = b.side === "expected" ? expected[b.index].id : observed[b.index].id;
      return idA.localeCompare(idB);
    });

    for (const startNode of allNodes) {
      if (startNode.side === "expected" && visitedExpected.has(startNode.index)) continue;
      if (startNode.side === "observed" && visitedObserved.has(startNode.index)) continue;

      const componentExpected: number[] = [];
      const componentObserved: number[] = [];
      const queue: NodeRef[] = [startNode];
      const queued = new Set<string>([nodeKey(startNode)]);

      while (queue.length > 0) {
        const node = queue.shift()!;
        if (node.side === "expected") {
          if (visitedExpected.has(node.index)) continue;
          visitedExpected.add(node.index);
          componentExpected.push(node.index);
          for (const oi of expectedNeighbors[node.index]) {
            const key = nodeKey({ side: "observed", index: oi });
            if (!queued.has(key)) {
              queued.add(key);
              queue.push({ side: "observed", index: oi });
            }
          }
        } else {
          if (visitedObserved.has(node.index)) continue;
          visitedObserved.add(node.index);
          componentObserved.push(node.index);
          for (const ei of observedNeighbors[node.index]) {
            const key = nodeKey({ side: "expected", index: ei });
            if (!queued.has(key)) {
              queued.add(key);
              queue.push({ side: "expected", index: ei });
            }
          }
        }
      }

      componentExpected.sort((a, b) => expected[a].id.localeCompare(expected[b].id));
      componentObserved.sort((a, b) => observed[a].id.localeCompare(observed[b].id));

      const expectedNodes = componentExpected.map((i) => expected[i]);
      const observedNodes = componentObserved.map((i) => observed[i]);
      const referenceRegionIds = expectedNodes.map((e) => e.id);
      const observedRegionIds = observedNodes.map((o) => o.id);
      const id = `regcmp-${[...referenceRegionIds, ...observedRegionIds].sort().join("+") || "empty"}`;
      const hasUsableCoordinateOnBothSides = expectedNodes.every((e) => e.boundingBox !== null) && observedNodes.every((o) => o.boundingBox !== null);

      if (expectedNodes.length === 0) {
        results.push({ id, referenceRegionIds, observedRegionIds, outcome: "additional", hasUsableCoordinateOnBothSides });
      } else if (observedNodes.length === 0) {
        results.push({ id, referenceRegionIds, observedRegionIds, outcome: "omitted", hasUsableCoordinateOnBothSides });
      } else if (expectedNodes.length === 1 && observedNodes.length === 1 && expectedNodes[0].normalizedText !== observedNodes[0].normalizedText) {
        results.push({ id, referenceRegionIds, observedRegionIds, outcome: "text_divergent", hasUsableCoordinateOnBothSides });
      } else {
        results.push({ id, referenceRegionIds, observedRegionIds, outcome: "recovered", hasUsableCoordinateOnBothSides });
      }
    }
  }

  return results.sort((a, b) => a.id.localeCompare(b.id));
}
