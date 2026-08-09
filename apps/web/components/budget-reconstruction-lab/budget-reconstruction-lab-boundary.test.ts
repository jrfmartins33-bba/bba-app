import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Epic 21 — Laboratório de Reconstrução Orçamentária. Este repositório não
// tem infraestrutura de render/DOM (nenhum jsdom/testing-library), então a
// fronteira arquitetural do Lab (consumidor do domínio, nunca parte dele)
// é verificada por checagem estática de código-fonte -- mesmo padrão já
// usado em apps/web/components/measurement/measurement-imports-page.test.ts.
// O Motor Determinístico (packages/bdos-core/src/domain/
// budget-table-reconstruction/, PR #83) permanece congelado: o Lab só pode
// importar o tipo público @bba/bdos-core/domain/budget-table-reconstruction.types,
// nunca executar o motor, nunca importar um arquivo interno por caminho
// relativo profundo, e nunca persistir no Supabase.

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentsDir = currentDir;
const libDir = join(currentDir, "..", "..", "lib", "budget");
const pageDir = join(currentDir, "..", "..", "app", "(dashboard)", "admin", "budget-reconstruction-lab");
const cssFile = join(currentDir, "..", "..", "app", "bba-globals.css");

const COMPONENT_FILES = [
  "reconstruction-summary.tsx",
  "reconstruction-status-legend.tsx",
  "reconstruction-filters.tsx",
  "reconstruction-table.tsx",
  "reconstruction-record-detail.tsx",
  "reconstruction-diagnostics.tsx",
].map((fileName) => join(componentsDir, fileName));

const LIB_FILES = ["budget-reconstruction-lab-view-model.ts"].map((fileName) => join(libDir, fileName));
const PAGE_FILES = ["page.tsx"].map((fileName) => join(pageDir, fileName));

const ALL_SOURCE = [...COMPONENT_FILES, ...LIB_FILES, ...PAGE_FILES]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

const TABLE_SOURCE = readFileSync(join(componentsDir, "reconstruction-table.tsx"), "utf8");
const CSS_SOURCE = readFileSync(cssFile, "utf8");

async function main(): Promise<void> {
  await runTest("não importa reconstructBudgetTable nem classifyRecords (nunca executa o motor)", () => {
    assertTrue(
      !/reconstructBudgetTable|classifyRecords|resolveColumns|formCells|formLogicalRows|evaluateArithmetic/.test(
        ALL_SOURCE,
      ),
      "o Lab nunca deve importar/chamar funções executoras do domínio",
    );
  });

  await runTest("não importa nenhum arquivo interno do domínio por caminho relativo profundo", () => {
    assertTrue(
      !/from\s+["'][^"']*packages\/bdos-core\/src\/domain\/budget-table-reconstruction\//.test(ALL_SOURCE),
      "o Lab só pode consumir o pacote via especificador @bba/bdos-core/..., nunca um caminho relativo profundo",
    );
  });

  await runTest("só importa o subpath público de tipos do bdos-core", () => {
    const importLines = ALL_SOURCE.split("\n").filter((line) => line.includes("@bba/bdos-core"));
    assertTrue(importLines.length > 0, "esperava ao menos uma importação de @bba/bdos-core/domain/budget-table-reconstruction.types");
    importLines.forEach((line) => {
      assertTrue(
        line.includes("@bba/bdos-core/domain/budget-table-reconstruction.types"),
        `importação inesperada de @bba/bdos-core fora do subpath de tipos público: ${line.trim()}`,
      );
    });
  });

  await runTest("nenhum acesso a Supabase no Lab (sem persistência)", () => {
    assertTrue(
      !/from\s+["'][^"']*supabase[^"']*["']|createServerClient|createBrowserClient|getSupabaseBrowserClient|getSupabaseRouteHandlerClient|@supabase\//i.test(
        ALL_SOURCE,
      ),
      "o Lab não deve importar/chamar Supabase -- o JSON é processado inteiramente no navegador",
    );
  });

  await runTest("nenhuma chamada de API nova (fetch) criada para o Lab", () => {
    assertTrue(!/fetch\(\s*["'`]\/api\//.test(ALL_SOURCE), "o Lab não deve chamar nenhuma rota /api nova");
  });

  await runTest("nenhuma chamada a provedor de LLM (Anthropic/Claude/OpenAI/BBA Advisor)", () => {
    assertTrue(
      !/anthropic|claude-narrator|advisor-context-builder|copilot/i.test(ALL_SOURCE),
      "o Lab não deve chamar nenhum provedor de LLM nem o BBA Advisor",
    );
  });

  await runTest("nenhum valor econômico reinterpretado com parseFloat/toFixed", () => {
    assertTrue(
      !/parseFloat|\.toFixed\(/.test(ALL_SOURCE),
      "os campos econômicos devem ser exibidos como rawText, nunca recalculados",
    );
  });

  await runTest("página usa <input type=\"file\"> local, sem upload para servidor", () => {
    const pageSource = readFileSync(PAGE_FILES[0]!, "utf8");
    assertTrue(pageSource.includes('type="file"'), "esperava um input de arquivo nativo na página do Lab");
    assertTrue(pageSource.includes("FileReader"), "o arquivo deve ser lido localmente via FileReader");
  });

  await runTest("nenhum dado de DNOCS/Concretisa/Pouso Alegre hardcoded no código produtivo do Lab", () => {
    assertTrue(
      !/concretisa|dnocs|lagoa do arroz|pouso alegre/i.test(ALL_SOURCE),
      "o Lab não pode hardcodar nomes de documentos reais -- o nome exibido é sempre o nome do arquivo escolhido pelo usuário",
    );
  });

  await runTest("a rota é protegida por profile.role === \"bba_admin\" (gate local, sem API nova)", () => {
    const pageSource = readFileSync(PAGE_FILES[0]!, "utf8");
    assertTrue(
      /from\s+["']@bba\/lib["']/.test(pageSource) && /useBbaStore/.test(pageSource),
      "a página deve ler o perfil autenticado do store existente (@bba/lib), sem inventar um novo mecanismo de auth",
    );
    assertTrue(
      /profile\.role\s*===\s*["']bba_admin["']/.test(pageSource),
      "esperava um teste explícito de profile.role === \"bba_admin\" na página do Lab",
    );
    assertTrue(
      pageSource.includes("Acesso restrito ao Admin BBA"),
      "usuário autenticado não-admin deve ver o estado \"Acesso restrito ao Admin BBA\"",
    );

    const guardIndex = pageSource.indexOf("Acesso restrito ao Admin BBA");
    const fileInputCardIndex = pageSource.indexOf("Carregar resultado do motor");
    const summaryRenderIndex = pageSource.indexOf("<ReconstructionSummary");
    assertTrue(
      guardIndex >= 0 && fileInputCardIndex >= 0 && summaryRenderIndex >= 0,
      "não foi possível localizar o guard e o conteúdo do Lab na página para comparar a ordem",
    );
    assertTrue(
      guardIndex < fileInputCardIndex && guardIndex < summaryRenderIndex,
      "o guard de admin deve ser um retorno antecipado antes do conteúdo do Lab, para nunca expor o Lab a um não-admin",
    );
  });

  await runTest("Unidade curta permanece visível integralmente (sem truncamento em JS)", () => {
    assertTrue(
      TABLE_SOURCE.includes("{record.unit ?? EMPTY_DISPLAY}"),
      "a célula de Unidade deve renderizar record.unit diretamente -- nenhum corte de string em JS",
    );
    assertTrue(
      !/record\.unit[^,;]*\.(slice|substring|substr)\(/.test(TABLE_SOURCE),
      "nenhum truncamento manual de record.unit deve existir -- a apresentação de uma linha é responsabilidade só do CSS",
    );
  });

  await runTest("Unidade longa não é despejada sem controle na tabela (classe de reticências aplicada)", () => {
    assertTrue(
      /className="budget-reconstruction-lab-table__unit"/.test(TABLE_SOURCE),
      "a célula de Unidade deve usar a classe budget-reconstruction-lab-table__unit",
    );
    assertTrue(
      /\.budget-reconstruction-lab-table__unit[\s\S]{0,400}?text-overflow:\s*ellipsis/.test(CSS_SOURCE) ||
        /\.budget-reconstruction-lab-table__unit,\s*\n\.budget-reconstruction-lab-table__numeric\s*{[\s\S]{0,200}?text-overflow:\s*ellipsis/.test(
          CSS_SOURCE,
        ),
      "a classe de Unidade do Lab deve aplicar text-overflow: ellipsis (uma linha, sem despejar texto bruto)",
    );
  });

  await runTest("conteúdo completo da Unidade continua disponível (title na tabela + detalhe)", () => {
    assertTrue(
      /data-label="Unidade"[\s\S]{0,200}title=\{record\.unit/.test(TABLE_SOURCE),
      "a célula de Unidade na tabela deve expor o texto completo via atributo title",
    );
    const detailSource = readFileSync(join(componentsDir, "reconstruction-record-detail.tsx"), "utf8");
    assertTrue(
      detailSource.includes("{record.unit ?? EMPTY_DISPLAY}"),
      "o painel de detalhe deve continuar mostrando o valor completo de Unidade",
    );
  });

  await runTest("nenhum conflito de Unidade é inferido pelo comprimento do texto", () => {
    assertTrue(
      !/record\.unit[^,;\n]*\.length/.test(ALL_SOURCE) && !/unit[^,;\n]*\.length\s*[<>]/i.test(TABLE_SOURCE),
      "a apresentação de Unidade não deve decidir nada a partir do comprimento do texto -- o domínio não carrega status estruturado para este campo",
    );
  });

  await runTest("cabeçalho da planilha reconstruída acompanha o scroll (translateY via JS no <thead> real)", () => {
    assertTrue(
      /theadRef/.test(TABLE_SOURCE) && /scrollContainerRef/.test(TABLE_SOURCE),
      "esperava refs para o <thead> e para o container de scroll em reconstruction-table.tsx",
    );
    assertTrue(
      /addEventListener\(\s*["']scroll["']/.test(TABLE_SOURCE),
      "esperava um listener de scroll no container da tabela",
    );
    assertTrue(
      /theadEl\.style\.transform\s*=\s*`translateY\(\$\{scrollEl\.scrollTop\}px\)`/.test(TABLE_SOURCE),
      "esperava que o próprio <thead> (nunca um clone) recebesse translateY igual ao scrollTop do container",
    );
    assertTrue(
      !/<thead[^>]*>[\s\S]*?<thead/.test(TABLE_SOURCE.replace(/\/\/.*$/gm, "")),
      "não deve existir um segundo <thead> clonado -- um único cabeçalho, sempre alinhado às colunas do corpo",
    );
  });

  await runTest("cabeçalho da planilha tem fundo opaco e z-index (evita linhas aparecendo por baixo)", () => {
    const match = CSS_SOURCE.match(/\.budget-reconstruction-lab-table thead th\s*{([\s\S]{0,200}?)}/);
    assertTrue(match !== null, "não foi possível localizar o bloco de regra do cabeçalho");
    const block = match![1]!;
    assertTrue(/background:\s*var\(--app-/.test(block), "o cabeçalho deve declarar um fundo opaco (não a superfície translúcida do Card)");
    assertTrue(!/--app-card\)/.test(block), "o fundo do cabeçalho não deve usar --app-card (translúcido) -- linhas rolando por baixo apareceriam");

    const theadMatch = CSS_SOURCE.match(/\.budget-reconstruction-lab-table thead\s*{([\s\S]{0,100}?)}/);
    assertTrue(theadMatch !== null, "não foi possível localizar o bloco de regra do <thead>");
    assertTrue(/z-index:\s*\d/.test(theadMatch![1]!), "o <thead> deve declarar z-index para pintar acima do corpo da tabela ao ganhar o transform");
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
