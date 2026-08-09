/**
 * Static source-code guards for the homologation authentication surface
 * (login page, dashboard shell, /admin/* layout). Same textual-scan
 * pattern as studio-boundaries.test.ts in this folder -- no jsdom/
 * testing-library in this repo, so page/component behavior is verified
 * by reading the compiled-away-nothing source and asserting on the
 * literal code shape rather than by rendering.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LOGIN_PAGE = resolve(__dirname, "..", "app", "(auth)", "login", "page.tsx");
const DASHBOARD_SHELL = resolve(__dirname, "..", "components", "bba-dashboard-shell.tsx");
const ADMIN_LAYOUT = resolve(__dirname, "..", "app", "(dashboard)", "admin", "layout.tsx");

const loginSource = readFileSync(LOGIN_PAGE, "utf8");
const shellSource = readFileSync(DASHBOARD_SHELL, "utf8");
const adminLayoutSource = readFileSync(ADMIN_LAYOUT, "utf8");

runTest("1. login nao inicia com email preenchido", () => {
  assertTrue(
    /useState<?[^>]*>?\(\s*""\s*\)/.test(loginSource) || /setEmail.*useState\(""\)/.test(loginSource),
    "esperava useState(\"\") para o campo de email na página de login",
  );
  assertTrue(
    !/useState\(\s*["'][^"']+@[^"']+["']\s*\)/.test(loginSource),
    "o campo de email não pode iniciar com um valor pré-preenchido",
  );
});

runTest("2. login nao inicia com senha preenchida", () => {
  assertTrue(
    !/useState\(\s*["']Teste123!?["']\s*\)/.test(loginSource),
    "o campo de senha não pode iniciar com uma senha pré-preenchida",
  );
});

runTest("3. login nao menciona senha demo", () => {
  assertTrue(!/Teste123/.test(loginSource), "a página de login não pode mencionar a senha de contas demo");
});

runTest("4. login nao promete fallback demo", () => {
  assertTrue(
    !/dados de demonstra|MVP abre com dados/i.test(loginSource),
    "a página de login não pode prometer um fallback de dados de demonstração",
  );
});

runTest("5. admin apos login direciona para /admin", () => {
  assertTrue(
    /bba_admin["']\s*\?\s*["']\/admin["']/.test(loginSource),
    "esperava um redirecionamento condicional para /admin quando profile.role === \"bba_admin\"",
  );
});

runTest("6. client apos login direciona para /hoje", () => {
  assertTrue(
    /["']\/admin["']\s*:\s*["']\/hoje["']/.test(loginSource),
    "esperava um redirecionamento para /hoje no ramo não-admin do login",
  );
});

runTest("7. login nao permite entrar sem Supabase configurado", () => {
  assertTrue(
    /isSupabaseConfigured/.test(loginSource),
    "a página de login deve checar isSupabaseConfigured antes de aceitar credenciais",
  );
  const guardIndex = loginSource.indexOf("isSupabaseConfigured");
  const formIndex = loginSource.indexOf("<form");
  assertTrue(guardIndex >= 0 && formIndex >= 0 && guardIndex < formIndex, "o guard de Supabase deve vir antes do formulário de login");
});

runTest("8. /admin exige profile.role === \"bba_admin\"", () => {
  assertTrue(
    /profile\.role\s*!==\s*["']bba_admin["']/.test(adminLayoutSource),
    "esperava um teste explícito de profile.role !== \"bba_admin\" no layout de /admin",
  );
});

runTest("9. cliente nao alcanca children do admin layout", () => {
  const deniedIndex = adminLayoutSource.indexOf("Acesso restrito ao Admin BBA");
  const childrenIndex = adminLayoutSource.lastIndexOf("{children}");
  assertTrue(deniedIndex >= 0 && childrenIndex >= 0, "não foi possível localizar o guard e o render de children no layout de /admin");
  assertTrue(
    deniedIndex < childrenIndex,
    "o guard de \"Acesso restrito\" deve ser um retorno antecipado antes de {children}, para nunca expor conteúdo de Admin a um não-admin",
  );
});

runTest("10. admin alcanca children do admin layout", () => {
  assertTrue(/return\s*<>\{children\}<\/>/.test(adminLayoutSource), "esperava que o ramo autorizado do layout de /admin renderize {children}");
});

runTest("11. sessao ainda nao hidratada mostra estado neutro (nao decide 'restrito' cedo demais)", () => {
  assertTrue(
    /session\s*===\s*null/.test(adminLayoutSource) && /Carregando/.test(adminLayoutSource),
    "esperava um estado de carregamento neutro para session === null, antes de qualquer decisão de acesso",
  );
});

runTest("12. sem Supabase configurado, o shell nao renderiza o dashboard demo (sem Maria Oliveira)", () => {
  assertTrue(
    /isSupabaseConfigured/.test(shellSource),
    "o BbaDashboardShell deve checar isSupabaseConfigured antes de renderizar Sidebar/children",
  );

  const guardIndex = shellSource.indexOf("if (!isSupabaseConfigured)");
  const sidebarIndex = shellSource.indexOf("<Sidebar");
  assertTrue(guardIndex >= 0 && sidebarIndex >= 0, "não foi possível localizar o guard e o render do Sidebar no shell");
  assertTrue(
    guardIndex < sidebarIndex,
    "o guard de Supabase ausente deve ser um retorno antecipado antes do Sidebar/children, para nunca expor o dashboard demo",
  );

  const guardBlockEnd = shellSource.indexOf("return (", guardIndex + 1) + 400;
  const guardBlock = shellSource.slice(guardIndex, Math.min(guardBlockEnd, sidebarIndex));
  assertTrue(
    !/profile\.(full_name|email)/.test(guardBlock),
    "o estado de configuração ausente não pode referenciar profile.full_name/email (nunca deve exibir Maria Oliveira)",
  );
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}
