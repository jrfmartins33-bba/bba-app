/**
 * Sprint 21.4B.3A.3 — fechamento consolidado. Analisador de argumentos
 * puro para `run-local-reader-evaluation-v2.ts` — o executor exige
 * `--output-dir <caminho>` e deve falhar ANTES de ler qualquer saída
 * bruta quando o argumento está ausente ou malformado. Nenhum destino
 * é hardcoded aqui nem no executor.
 */
export function parseOutputDirArg(argv: ReadonlyArray<string>): string {
  const idx = argv.indexOf("--output-dir");
  if (idx === -1) {
    throw new Error("run-local-reader-evaluation-v2: --output-dir <path> é obrigatório. Nenhuma saída bruta foi lida.");
  }
  if (idx === argv.length - 1) {
    throw new Error("run-local-reader-evaluation-v2: --output-dir requer um valor de caminho. Nenhuma saída bruta foi lida.");
  }
  const value = argv[idx + 1];
  if (value.length === 0 || value.startsWith("--")) {
    throw new Error("run-local-reader-evaluation-v2: --output-dir requer um caminho não vazio como valor. Nenhuma saída bruta foi lida.");
  }
  return value;
}
