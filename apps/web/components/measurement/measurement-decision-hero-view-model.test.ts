import { describeConfidence, translateReadiness } from "./measurement-decision-hero-view-model";
import type { ReliabilityIndexResult } from "@bba/bdos-core/decision-brief";

async function main(): Promise<void> {
  await runTest("translateReadiness -- os quatro mapeamentos obrigatórios", () => {
    assertEqual(translateReadiness("ready").label, "Apta para seguir para aprovação");
    assertEqual(translateReadiness("ready_with_reservations").label, "Apta para seguir com ressalvas");
    assertEqual(translateReadiness("not_ready").label, "Não apta no estado atual");
    assertEqual(translateReadiness("inconclusive").label, "Análise inconclusiva");
  });

  await runTest("translateReadiness -- nenhum mapeamento usa vocabulário de aprovação formal", () => {
    const allLabels = (["ready", "ready_with_reservations", "not_ready", "inconclusive"] as const)
      .map((readiness) => translateReadiness(readiness).label)
      .join(" ");
    assertTrue(!/aprovad|reprovad|certificad|homologad|aceit|rejeitad/i.test(allLabels), "readiness é prontidão técnica, não aprovação consumada");
  });

  await runTest("translateReadiness -- cada readiness tem tom/ícone distinto (sinal além da cor)", () => {
    const tones = (["ready", "ready_with_reservations", "not_ready", "inconclusive"] as const).map((r) => translateReadiness(r).icon);
    assertEqual(new Set(tones).size, 4, "cada readiness deve ter um ícone próprio, nunca compartilhado");
  });

  await runTest("describeConfidence -- unavailable nunca produz score/percentual", () => {
    const confidence: ReliabilityIndexResult = { status: "unavailable", reason: "calculation_model_not_defined" };
    assertEqual(describeConfidence(confidence), "Índice ainda não calculado.");
  });

  await runTest("describeConfidence -- available devolve só o label, nunca score/level formatado", () => {
    const confidence: ReliabilityIndexResult = {
      status: "available",
      score: 87,
      level: "healthy",
      label: "Confiança alta",
      factors: [],
      modelVersion: "v-hipotetico"
    };
    const described = describeConfidence(confidence);
    assertEqual(described, "Confiança alta");
    assertTrue(!described.includes("87"), "nunca deve vazar o score numérico nesta Sprint");
    assertTrue(!described.includes("%"), "nunca deve vazar percentual nesta Sprint");
  });
}

async function runTest(name: string, testCase: () => void): Promise<void> {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message ?? "valores diferentes"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(message ?? "esperava true, recebeu false");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
