import { readAllSupabasePages } from "./supabase-complete-read";

void run();

async function run() {
  const persistedRows = Array.from({ length: 1_501 }, (_, index) => ({ id: `line-${String(index).padStart(4, "0")}` }));
  const serverMaximum = 400;
  const requestedRanges: Array<[number, number]> = [];

  const loaded = await readAllSupabasePages(async (from, to) => {
    requestedRanges.push([from, to]);
    const effectiveTo = Math.min(to, from + serverMaximum - 1);
    return { data: persistedRows.slice(from, effectiveTo + 1), error: null };
  }, 1_000);

  equal(loaded.length, 1_501, "todas as linhas devem ser carregadas apesar do teto do servidor");
  equal(new Set(loaded.map((row) => row.id)).size, 1_501, "nenhuma linha deve ser duplicada");
  equal(loaded[1_500]?.id, "line-1500", "a última linha deve estar presente");
  equal(requestedRanges.at(-1)?.[0], 1_501, "a leitura só termina após consultar a primeira página vazia");
  console.log("ok - leitura Supabase pagina até vazio sem perder linhas sob limite menor que o solicitado");
}

function equal<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
