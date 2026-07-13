import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Epic 20, Sprint 20.1E.1B. Checagem estática (mesmo padrão de
// route.test.ts) de que a navegação para Medições existe em um único
// ponto por arquivo, aponta para /medicoes, e que a rota legada
// /memorias não é mais acessível ao usuário como página real.

const currentDir = dirname(fileURLToPath(import.meta.url));
const NAV_CONFIG_SOURCE = readFileSync(join(currentDir, "workspace-nav-config.ts"), "utf8");
const SIDEBAR_SOURCE = readFileSync(join(currentDir, "sidebar.tsx"), "utf8");
const ENGENHARIA_PAGE_SOURCE = readFileSync(
  join(currentDir, "..", "app", "(dashboard)", "workspaces", "engenharia", "page.tsx"),
  "utf8"
);
const MEMORIAS_PAGE_SOURCE = readFileSync(join(currentDir, "..", "app", "(dashboard)", "memorias", "page.tsx"), "utf8");

async function main(): Promise<void> {
  await runTest("workspace-nav-config.ts não contém mais 'Studio de Medições' nem href /memorias", () => {
    assertTrue(!NAV_CONFIG_SOURCE.includes("Studio de Medições"), "nome legado não deve mais existir");
    assertTrue(!NAV_CONFIG_SOURCE.includes("/memorias"), "href legado não deve mais existir");
    assertTrue(NAV_CONFIG_SOURCE.includes(`"Medições"`) && NAV_CONFIG_SOURCE.includes("/medicoes"), "deve existir uma única entrada Medições -> /medicoes");
  });

  await runTest("sidebar.tsx (Studios, visão Admin) não contém mais 'Studio de Medições' nem href /memorias", () => {
    assertTrue(!SIDEBAR_SOURCE.includes("Studio de Medições"), "nome legado não deve mais existir");
    assertTrue(!SIDEBAR_SOURCE.includes("/memorias"), "href legado não deve mais existir");
    assertTrue(SIDEBAR_SOURCE.includes("/medicoes"), "deve apontar para /medicoes");
  });

  await runTest("workspaces/engenharia/page.tsx não duplica mais o card de Medições", () => {
    assertTrue(!ENGENHARIA_PAGE_SOURCE.includes("Studio de Medições"), "nome legado não deve mais existir");
    assertTrue(!ENGENHARIA_PAGE_SOURCE.includes("/memorias"), "href legado não deve mais existir");
    const medicoesCardCount = (ENGENHARIA_PAGE_SOURCE.match(/id:\s*"medicoes"/g) ?? []).length;
    assertTrue(medicoesCardCount === 1, `esperava exatamente 1 card "medicoes", encontrado ${medicoesCardCount}`);
  });

  await runTest("/memorias redireciona para /medicoes (redirect(), mesmo padrão de app/page.tsx)", () => {
    assertTrue(MEMORIAS_PAGE_SOURCE.includes(`redirect("/medicoes")`), "página legada deve chamar redirect(\"/medicoes\")");
    assertTrue(!MEMORIAS_PAGE_SOURCE.includes("MEMORIES"), "array hardcoded legado não deve mais existir/ser acessível");
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
