/**
 * Problema B (Sprint 21.4B.3A.3, Momento 3C.1 → implementado no Momento
 * 3C.2A). Assinatura e algoritmo congelados em
 * `EPIC_21_SPRINT_4B3A3_MOMENTO3C1_METRIC_CORRECTION_PREREGISTRATION.md`
 * §4. Substitui, apenas para consumidores v2, a classificação final de
 * `associateObservedRegionsToReference` (v1, `discovery-local-reader-comparison.ts`,
 * NUNCA alterada) — reaproveitando exatamente a mesma formação de
 * grafo/componentes (aresta quando sobreposição espacial estrita OU texto
 * normalizado idêntico; mesmo particionamento por componente conexo;
 * mesma ordenação determinística por id) — mas nunca colapsando
 * componentes N:1/1:N em `"recovered"` sem evidência textual real.
 *
 * A formação de grafo/componentes é uma CÓPIA AUDITADA da de v1 (linha a
 * linha equivalente), não uma extração — v1 não pode ser tocado para
 * expor um auxiliar neutro (proibido pelo enunciado do Momento 3C.2). A
 * fidelidade da cópia é verificada por um teste de equivalência estrutural
 * dedicado (`discovery-local-reader-comparison-v2.test.ts`), que roda v1 e
 * v2 sobre a mesma entrada sintética e confirma que produzem exatamente
 * os mesmos componentes (mesmos ids esperados, mesmos ids observados) —
 * apenas a classificação final pode divergir.
 */

import { boxesOverlapStrictly } from "../discovery-local-reader-comparison";
import { normalizeLocalReaderText } from "../discovery-local-reader-normalization";
import type { LocalReaderExpectedRegionRef, LocalReaderObservedRegionRef } from "../discovery-local-reader-evaluation.types";
import type { LocalReaderRegionComponentResultV2 } from "./discovery-local-reader-evaluation-v2.types";

type NodeRefV2 = { readonly side: "expected"; readonly index: number } | { readonly side: "observed"; readonly index: number };

function nodeKeyV2(node: NodeRefV2): string {
  return `${node.side}:${node.index}`;
}

export function associateObservedRegionsToReferenceV2(
  expectedRegions: ReadonlyArray<LocalReaderExpectedRegionRef>,
  observedRegions: ReadonlyArray<LocalReaderObservedRegionRef>,
): ReadonlyArray<LocalReaderRegionComponentResultV2> {
  const results: LocalReaderRegionComponentResultV2[] = [];
  const pages = new Set<number>([...expectedRegions.map((e) => e.realPageNumber), ...observedRegions.map((o) => o.realPageNumber)]);

  for (const page of [...pages].sort((a, b) => a - b)) {
    // --- Formação de grafo/componentes: cópia auditada de v1 (§4, ver
    // cabeçalho deste arquivo) — nunca ajustada além de espelhar v1. ---
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
    const allNodes: NodeRefV2[] = [
      ...expected.map((_, index): NodeRefV2 => ({ side: "expected", index })),
      ...observed.map((_, index): NodeRefV2 => ({ side: "observed", index })),
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
      const queue: NodeRefV2[] = [startNode];
      const queued = new Set<string>([nodeKeyV2(startNode)]);

      while (queue.length > 0) {
        const node = queue.shift()!;
        if (node.side === "expected") {
          if (visitedExpected.has(node.index)) continue;
          visitedExpected.add(node.index);
          componentExpected.push(node.index);
          for (const oi of expectedNeighbors[node.index]) {
            const key = nodeKeyV2({ side: "observed", index: oi });
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
            const key = nodeKeyV2({ side: "expected", index: ei });
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

      // --- Classificação final v2 (§4 do pré-registro) — a única parte
      // que diverge de v1. Ordem fixa, primeira regra aplicável. ---
      let outcome: LocalReaderRegionComponentResultV2["outcome"];
      if (referenceRegionIds.length === 0) {
        outcome = "observed_region_additional";
      } else if (observedRegionIds.length === 0) {
        outcome = "expected_region_omitted";
      } else if (referenceRegionIds.length === 1 && observedRegionIds.length === 1) {
        outcome = expectedNodes[0].normalizedText === observedNodes[0].normalizedText ? "spatial_and_textual_match" : "spatial_overlap_without_text_match";
      } else if (referenceRegionIds.length === 1 && observedRegionIds.length > 1) {
        outcome = "expected_regions_split_across_observed";
      } else if (referenceRegionIds.length > 1 && observedRegionIds.length === 1) {
        outcome = "multiple_expected_regions_merged";
      } else {
        // N:M raro — mesma regra de desempate fixa já congelada para
        // células em v1 (discovery-local-reader-comparison.ts §8):
        // mais observados que esperados → dividida; caso contrário → fundida.
        outcome = observedRegionIds.length > referenceRegionIds.length ? "expected_regions_split_across_observed" : "multiple_expected_regions_merged";
      }

      results.push({ id, referenceRegionIds, observedRegionIds, outcome });
    }
  }

  return results.sort((a, b) => a.id.localeCompare(b.id));
}
