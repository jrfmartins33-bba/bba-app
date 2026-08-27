import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// "Controle Gerencial da Execução" — teste direcionado estático (sem
// render/DOM), mesmo padrão de measurement-review-page.test.ts.

const currentDir = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(currentDir, rel), "utf8");

const PAGE = read("measurement-managerial-control-page.tsx");
const ITEM_ROW = read("measurement-managerial-control-item-row.tsx");
const VIEW_MODEL = read("measurement-managerial-control-view-model.ts");
const CLIENT = read("measurement-managerial-control-client.ts");
const SERVICE = read("../../lib/bdos/measurement-managerial-control-service.ts");
const ROUTE = read("../../app/api/measurement/imports/[measurementBulletinImportId]/managerial-control/route.ts");
const ROUTE_HANDLER = read("../../app/api/measurement/imports/[measurementBulletinImportId]/managerial-control/managerial-control-route-handler.ts");
const REVIEW_PAGE = read("measurement-review-page.tsx");
const OBRA_CARD = read("measurement-physical-financial-obra-card.tsx");

function ok(name: string, fn: () => void) {
  fn();
  console.log(`ok - ${name}`);
}
function assertTrue(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

ok("rota é GET somente-leitura — nenhuma escrita de negócio", () => {
  assertTrue(ROUTE.includes("export async function GET("), "GET existe");
  assertTrue(!/export async function (POST|PUT|PATCH|DELETE)/.test(ROUTE), "sem verbos de escrita");
  assertTrue(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(ROUTE_HANDLER), "route-handler nunca escreve");
  assertTrue(!/certif/i.test(ROUTE_HANDLER) || !/\.insert|\.update/.test(ROUTE_HANDLER), "nunca certifica");
});

ok("serviço é função pura — dinheiro em decimal canônico, sem float", () => {
  assertTrue(SERVICE.includes('from "@bba/bdos-core/domain/measurement-certification"'), "usa a camada decimal canônica");
  assertTrue(SERVICE.includes("canonicalizeMeasurementDecimal") && SERVICE.includes("addMeasurementDecimals"), "somas canônicas");
  assertTrue(!/parseFloat\(|Number\.parseFloat\(/.test(SERVICE), "nenhum parseFloat");
  assertTrue(!/Number\(/.test(ITEM_ROW), "linha do item nunca converte para float");
  assertTrue(!/\.\w+Decimal\s*[-+*/]\s*\w/.test(ITEM_ROW), "linha do item nunca faz aritmética sobre decimais");
});

ok("vocabulário: nunca 'atrasado/adiantado/no prazo' no item", () => {
  const bad = /atrasad[ao]|adiantad[ao]|\bno prazo\b|em atraso/i;
  for (const [label, src] of [["página", PAGE], ["linha", ITEM_ROW], ["view-model", VIEW_MODEL], ["serviço", SERVICE]] as const) {
    assertTrue(!bad.test(src), `${label} não usa vocabulário temporal proibido para o item`);
  }
});

ok("distingue documental × certificado — 'certificado = 0' não é 'sem execução'", () => {
  assertTrue(SERVICE.includes("documentaryHistoryImported: false"), "histórico documental marcado como não importado");
  assertTrue(PAGE.includes("Histórico acumulado item a item ainda não importado") || ITEM_ROW.includes("ainda não importado"), "página deixa explícito");
  assertTrue(/certifica[çc][ãa]o hist[óo]rica registrada/i.test(PAGE) || /nenhuma certifica/i.test(PAGE), "explica o significado de certificado = 0");
  assertTrue(SERVICE.includes("obraReference"), "posição real da obra (Curva S) exposta à parte para contraste");
});

ok("reconciliação contratual AUTORITATIVA da Base Contratual — nunca 'soma de itens arredondados − oficial'", () => {
  const HANDLER = read("../../app/api/measurement/imports/[measurementBulletinImportId]/managerial-control/managerial-control-route-handler.ts");
  assertTrue(HANDLER.includes("findContractBaselineByProject"), "usa a Base Contratual existente, não uma segunda fonte");
  assertTrue(HANDLER.includes("derivedItemsTotalDecimal") && HANDLER.includes("contractualRoundingAdjustmentDecimal"), "soma técnica + ajuste vêm da Base Contratual");
  assertTrue(SERVICE.includes("itemsTechnicalTotalDecimal") && SERVICE.includes("contractRoundingAdjustmentDecimal"), "campos autoritativos no resumo");
  assertTrue(!SERVICE.includes("contractAdjustmentDecimal"), "o antigo campo derivado (soma canônica − oficial) foi removido");
  assertTrue(/soma t[ée]cnica dos itens/i.test(PAGE) && /ajuste contratual de arredondamento/i.test(PAGE) && /valor oficial do contrato/i.test(PAGE), "a reconciliação é exibida com os três termos");
  assertTrue(/nunca é rateado pelos itens/i.test(PAGE), "diz explicitamente que o ajuste não é rateado");
});

ok("§1 — sem dupla contagem: BM atual só entra no acumulado enquanto o ciclo não está certificado", () => {
  const HANDLER = read("../../app/api/measurement/imports/[measurementBulletinImportId]/managerial-control/managerial-control-route-handler.ts");
  assertTrue(HANDLER.includes("getMeasurementCycleByWorkspaceId"), "resolve o estado do CICLO do próprio workspace, não 'existe alguma certificação'");
  assertTrue(HANDLER.includes("currentBulletinCertified"), "flag propagada ao serviço");
  assertTrue(SERVICE.includes("currentBulletinCertified"), "serviço consome a flag");
  assertTrue(/Evita DUPLA CONTAGEM|dupla contagem/i.test(SERVICE), "o serviço documenta a regra");
  assertTrue(/valor do período continua vis|neste per[íi]odo/i.test(PAGE) || ITEM_ROW.includes("Sem medição neste período"), "o valor do período segue visível à parte");
});

ok("cores §25 — sem verde para quantidades; azul/neutro/amber", () => {
  assertTrue(VIEW_MODEL.includes('return "info"') && VIEW_MODEL.includes('return "caution"') && VIEW_MODEL.includes('return "neutral"'), "três tons");
  assertTrue(!/return "positive"|--status-green/.test(VIEW_MODEL), "nunca verde no controle de quantidades");
});

ok("filtros e busca existem (código, descrição, grupo, situação, período, sem medição)", () => {
  assertTrue(VIEW_MODEL.includes("applyManagerialFilter"), "filtro determinístico");
  for (const f of ["search", "groupCode", "status", "onlyMeasuredThisPeriod", "onlyWithoutMeasurement", "onlyAboveContractQuantity"]) {
    assertTrue(VIEW_MODEL.includes(f), `filtro ${f}`);
  }
  assertTrue(PAGE.includes("Buscar por código ou serviço"), "campo de busca");
});

ok("todos os itens do contrato — contagem vem do servidor, nunca hardcode", () => {
  assertTrue(!/\b300\b/.test(SERVICE) && !/\b300\b/.test(PAGE), "nenhum 300 hardcoded");
  assertTrue(SERVICE.includes("input.contractItems.length"), "total = base contratual");
});

ok("acesso a partir da tela Revisar medição + Grupo → Itens reutiliza a mesma página", () => {
  assertTrue(REVIEW_PAGE.includes("Ver controle gerencial por item"), "link na tela de revisão");
  assertTrue(REVIEW_PAGE.includes("/controle-gerencial"), "aponta para a rota do controle gerencial");
  assertTrue(OBRA_CARD.includes("Ver itens do grupo") && OBRA_CARD.includes("?grupo="), "Grupo → Itens filtrado, mesma rota");
  assertTrue(PAGE.includes('searchParams.get("grupo")'), "a página aplica o filtro de grupo da URL");
});

ok("client valida o envelope estruturalmente antes de aceitar", () => {
  assertTrue(CLIENT.includes("extractValidView"), "validação estrutural");
  assertTrue(CLIENT.includes("STATUS_VALUES"), "status restrito a valores conhecidos");
});
