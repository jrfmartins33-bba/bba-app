import { isWorkspaceSubNavItemActive } from "./workspace-subnav-active";

/**
 * Epic 21, Sprint 21.4B.3 — o item "Orçamento" do menu contextual do
 * Workspace Engenharia não acendia em `/orcamentos/demonstracao` porque
 * `sidebar.tsx` usava igualdade exata (`pathname === item.href`).
 * Confere a correção (igualdade exata OU prefixo com barra) e a
 * ausência de falso positivo, para nenhuma outra capacidade (Medições
 * incluída) regredir.
 */

async function main(): Promise<void> {
  await runTest("'/orcamentos' ativo em '/orcamentos'", () => {
    assertEqual(isWorkspaceSubNavItemActive("/orcamentos", "/orcamentos"), true);
  });

  await runTest("'/orcamentos' ativo em '/orcamentos/demonstracao'", () => {
    assertEqual(isWorkspaceSubNavItemActive("/orcamentos/demonstracao", "/orcamentos"), true);
  });

  await runTest("'/orcamentos' ativo em futuras rotas filhas ('/orcamentos/qualquer-coisa')", () => {
    assertEqual(isWorkspaceSubNavItemActive("/orcamentos/qualquer-coisa", "/orcamentos"), true);
  });

  await runTest("rota não relacionada não ativa Orçamento ('/orcamento-extra')", () => {
    assertEqual(isWorkspaceSubNavItemActive("/orcamento-extra", "/orcamentos"), false);
  });

  await runTest("rota não relacionada não ativa Orçamento (prefixo parcial sem barra)", () => {
    assertEqual(isWorkspaceSubNavItemActive("/orcamentosalgo", "/orcamentos"), false);
  });

  await runTest("nenhuma regressão em Medições: '/medicoes' continua ativo em '/medicoes'", () => {
    assertEqual(isWorkspaceSubNavItemActive("/medicoes", "/medicoes"), true);
  });

  await runTest("nenhuma regressão em Medições: rota filha real também ativa (mesma regra, nunca pior que antes)", () => {
    assertEqual(isWorkspaceSubNavItemActive("/medicoes/abc123", "/medicoes"), true);
  });

  await runTest("nenhuma regressão em Medições: rota totalmente diferente não ativa", () => {
    assertEqual(isWorkspaceSubNavItemActive("/geoespacial", "/medicoes"), false);
  });
}

async function runTest(name: string, testCase: () => void): Promise<void> {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
