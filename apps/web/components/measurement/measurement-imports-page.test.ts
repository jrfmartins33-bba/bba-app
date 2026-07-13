import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Epic 20, Sprint 20.1E.1B. Este repositório não tem infraestrutura de
// render/DOM (nenhum jsdom/testing-library) -- por isso a lógica real
// (tradução de status, humanLabel, ação) foi extraída para
// measurement-imports-view-model.ts/measurement-imports-client.ts,
// testados separadamente, e este arquivo faz checagem estática de
// código-fonte (mesmo padrão já usado em
// app/api/measurement/imports/route.test.ts para validar as
// exportações de route.ts).

const currentDir = dirname(fileURLToPath(import.meta.url));
const PAGE_SOURCE = readFileSync(join(currentDir, "measurement-imports-page.tsx"), "utf8");
const CLIENT_SOURCE = readFileSync(join(currentDir, "measurement-imports-client.ts"), "utf8");
const VIEW_MODEL_SOURCE = readFileSync(join(currentDir, "measurement-imports-view-model.ts"), "utf8");
const ALL_SOURCE = `${PAGE_SOURCE}\n${CLIENT_SOURCE}\n${VIEW_MODEL_SOURCE}`;

async function main(): Promise<void> {
  await runTest("página não renderiza measurementBulletinImportId como texto -- só em key/href", () => {
    const linesWithId = PAGE_SOURCE.split("\n").filter((line) => line.includes("measurementBulletinImportId"));
    assertTrue(linesWithId.length > 0, "esperava ao menos uma referência a measurementBulletinImportId (key/href)");
    linesWithId.forEach((line) => {
      assertTrue(
        line.includes("key=") || line.includes("href") || line.includes("import type") || line.includes("Link"),
        `linha usa measurementBulletinImportId fora de key/href, possível UUID exposto: ${line.trim()}`
      );
    });
  });

  await runTest("nenhum acesso a Supabase na página/cliente/view-model de Medições", () => {
    // Checa uso real (import/chamada), não a palavra em comentários --
    // page.tsx documenta deliberadamente a ausência de acesso direto.
    assertTrue(
      !/from\s+["'][^"']*supabase[^"']*["']|createServerClient|createBrowserClient|getSupabaseBrowserClient|getSupabaseRouteHandlerClient|@supabase\//i.test(
        ALL_SOURCE
      ),
      "não deve importar/chamar Supabase -- só GET /api/measurement/imports"
    );
  });

  await runTest("nenhuma chamada ao Decision Brief builder", () => {
    assertTrue(!/decision-brief|buildMeasurementDecisionBrief/i.test(ALL_SOURCE), "não deve importar/chamar o builder do Decision Brief");
  });

  await runTest("nenhuma importação de outro Studio (bba-project/geospatial)", () => {
    assertTrue(!/bba-project|geospatial/i.test(ALL_SOURCE), "Studio de Medições não pode importar internos de outro Studio");
  });

  await runTest("página não referencia o Import Lab", () => {
    assertTrue(!/import lab|measurement-import-lab/i.test(ALL_SOURCE), "/medicoes não deve oferecer Import Lab");
  });

  await runTest("página não calcula readiness ou confidence", () => {
    assertTrue(!/readiness|confidence|reliabilityindex/i.test(ALL_SOURCE), "readiness/confidence pertencem ao Decision Brief (20.1E.2+), não à listagem");
  });

  await runTest("ação de abrir relatório depende de canOpenReport (analysisAvailable), não de status", () => {
    assertTrue(PAGE_SOURCE.includes("canOpenReport(item)"), "a página deve delegar a regra de ação ao view-model, não reimplementá-la");
  });
}

async function runTest(name: string, testCase: () => void): Promise<void> {
  testCase();
  console.log(`ok - ${name}`);
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
