/**
 * Sprint 21.4B.3A.3 — fechamento consolidado. Analisador de argumentos
 * puro para `orchestrate-corrected-evaluation-v2.ts` — o orquestrador
 * exige `--final-output-dir <caminho>` e deve falhar ANTES de qualquer
 * validação ou execução quando o argumento está ausente ou malformado.
 * Extraído para um módulo próprio (nunca definido dentro do
 * orquestrador, que chama `main()` incondicionalmente ao ser
 * carregado) para que possa ser testado por importação direta, sem
 * disparar a execução real.
 */
export function parseFinalOutputDirArg(argv: ReadonlyArray<string>): string {
  const idx = argv.indexOf("--final-output-dir");
  if (idx === -1) {
    throw new Error("orchestrate-corrected-evaluation-v2: --final-output-dir <path> é obrigatório. Nenhuma saída bruta foi lida.");
  }
  if (idx === argv.length - 1) {
    throw new Error("orchestrate-corrected-evaluation-v2: --final-output-dir requer um valor de caminho. Nenhuma saída bruta foi lida.");
  }
  const value = argv[idx + 1];
  if (value.length === 0 || value.startsWith("--")) {
    throw new Error("orchestrate-corrected-evaluation-v2: --final-output-dir requer um caminho não vazio como valor. Nenhuma saída bruta foi lida.");
  }
  return value;
}
