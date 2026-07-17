import type { BudgetDocumentTabularRegionDetectionProfile } from "./budget-document-tabular-region-detection.types";

export const TABULAR_REGION_FORMATION_RULE_ID = "tabular-region-maximal-shared-alignment-window-v1" as const;
export const TABULAR_REGION_FORMATION_RULE_VERSION = 1 as const;

export interface RegionFormationLine {
  readonly lineKey: string;
  /** 1-based, denso e único por página (garantido pela validação de entrada). */
  readonly verticalOrder: number;
}

export interface RegionFormationAlignment {
  readonly alignmentKey: string;
  readonly lineKeys: ReadonlyArray<string>;
}

/**
 * Janela contígua candidata a região tabular (§11-12). Nunca exposta como
 * uma `TabularRegionCandidate` diretamente — apenas as janelas com
 * `conflicted: false` tornam-se regiões confirmadas; as demais alimentam a
 * disposição `unresolved_tabular_region_ambiguity` de todas as suas
 * linhas, sem exceção parcial (§12: "impedir que as formações conflitantes
 * sejam declaradas válidas como se não houvesse conflito" — a formação
 * inteira é invalidada, nunca apenas o trecho literalmente disputado).
 */
export interface TabularRegionFormationWindow {
  /** Linhas participantes, em ordem vertical, sem duplicação. */
  readonly lineKeys: ReadonlyArray<string>;
  /** Interseção de assinaturas de alinhamento de todas as linhas membro, em ordem canônica (ordenação lexicográfica das chaves) — sempre `>= minimumRecurrentAlignmentCount`. */
  readonly supportingAlignmentKeys: ReadonlyArray<string>;
  /** `true` quando esta janela compartilha ao menos uma linha com outra janela maximal — nenhuma das duas se torna região confirmada. */
  readonly conflicted: boolean;
}

function intersect(a: ReadonlySet<string>, b: ReadonlySet<string>): Set<string> {
  const result = new Set<string>();
  a.forEach((value) => {
    if (b.has(value)) {
      result.add(value);
    }
  });
  return result;
}

/**
 * Forma janelas contíguas candidatas a região tabular a partir das
 * assinaturas de alinhamento de cada linha (§11-12). Para cada posição
 * inicial `i`, estende gulosamente para a direita enquanto a interseção
 * corrente de assinaturas permanecer com tamanho `>= minimumRecurrentAlignmentCount`
 * — a interseção é monotonicamente não-crescente à medida que a janela
 * cresce, então a extensão maximal para cada `i` é única e determinística
 * (nunca depende da ordem de descoberta). Uma janela só é mantida quando
 * estender um passo à esquerda deixaria de ser válida (maximalidade à
 * esquerda) — o mesmo argumento de monotonicidade garante que checar
 * apenas o vizinho imediato à esquerda já é suficiente (se estender um
 * passo já invalida, estender mais passos também invalida). Janelas
 * maximais que compartilham ao menos uma posição de linha são marcadas
 * como conflitantes (§12) — nunca fundidas, nunca escolhidas
 * silenciosamente. Contiguidade é definida inteiramente por `verticalOrder`
 * consecutivo — nenhuma tolerância de lacuna vertical adicional (§9-10).
 */
export function formTabularRegionCandidateWindows(
  lines: ReadonlyArray<RegionFormationLine>,
  alignments: ReadonlyArray<RegionFormationAlignment>,
  profile: BudgetDocumentTabularRegionDetectionProfile,
): ReadonlyArray<TabularRegionFormationWindow> {
  const orderedLines = [...lines].sort((a, b) => a.verticalOrder - b.verticalOrder);
  const n = orderedLines.length;
  const lineKeyToPosition = new Map(orderedLines.map((line, position) => [line.lineKey, position]));

  const signatureByPosition: Array<Set<string>> = orderedLines.map(() => new Set<string>());
  alignments.forEach((alignment) => {
    alignment.lineKeys.forEach((lineKey) => {
      const position = lineKeyToPosition.get(lineKey);
      if (position !== undefined) {
        signatureByPosition[position].add(alignment.alignmentKey);
      }
    });
  });

  interface CandidateWindow {
    readonly start: number;
    readonly end: number;
    readonly support: ReadonlySet<string>;
  }

  const maximalWindows: CandidateWindow[] = [];

  for (let start = 0; start < n; start += 1) {
    let support = new Set(signatureByPosition[start]);
    let end = start;
    while (end + 1 < n) {
      const nextSupport = intersect(support, signatureByPosition[end + 1]);
      if (nextSupport.size < profile.minimumRecurrentAlignmentCount) {
        break;
      }
      support = nextSupport;
      end += 1;
    }

    const length = end - start + 1;
    if (length < profile.minimumRegionLineCount || support.size < profile.minimumRecurrentAlignmentCount) {
      continue;
    }

    if (start > 0) {
      const leftExtended = intersect(signatureByPosition[start - 1], support);
      if (leftExtended.size >= profile.minimumRecurrentAlignmentCount) {
        continue;
      }
    }

    maximalWindows.push({ start, end, support });
  }

  const conflicted = maximalWindows.map(() => false);
  for (let a = 0; a < maximalWindows.length; a += 1) {
    for (let b = a + 1; b < maximalWindows.length; b += 1) {
      const overlaps = maximalWindows[a].start <= maximalWindows[b].end && maximalWindows[b].start <= maximalWindows[a].end;
      if (overlaps) {
        conflicted[a] = true;
        conflicted[b] = true;
      }
    }
  }

  return maximalWindows.map((window, index) => ({
    lineKeys: orderedLines.slice(window.start, window.end + 1).map((line) => line.lineKey),
    supportingAlignmentKeys: [...window.support].sort(),
    conflicted: conflicted[index],
  }));
}
