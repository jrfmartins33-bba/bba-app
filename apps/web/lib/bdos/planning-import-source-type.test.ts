import { detectPlanningImportSourceType, sniffPlanningImportSourceTypeFromBytes } from "./planning-import-source-type";

// Epic 18 (Resilient Planning Import) — cobre a parte do requisito F
// ("extensão inválida", "MIME inválido") que é lógica pura, sem I/O.
// O restante do requisito F (arquivo pequeno/grande, import de outra
// empresa, planningImportId inexistente, upload ausente, falha do
// parser, caminho feliz ponta a ponta) exige sessão autenticada real
// contra o Supabase — não testável pelo runner `npx tsx` deste
// repositório (mesma limitação já documentada em
// EXECUTION_ENGINE_E2E_CHECKLIST.md). Ver
// docs/testing/RESILIENT_PLANNING_IMPORT_E2E_CHECKLIST.md.

runTest("modo leve (sem bytes): reconhece .xlsx por extensão", () => {
  const result = detectPlanningImportSourceType("cronograma.xlsx", "application/octet-stream");
  assertEqual(result, "excel", "extensão .xlsx deve bastar, mesmo sem MIME correto");
});

runTest("modo leve: reconhece .xml por extensão", () => {
  const result = detectPlanningImportSourceType("cronograma.xml", "application/octet-stream");
  assertEqual(result, "ms-project-xml", "extensão .xml deve bastar, mesmo sem MIME correto");
});

runTest("modo leve: reconhece por MIME correto mesmo com extensão ausente/errada", () => {
  const xlsxByMime = detectPlanningImportSourceType(
    "arquivo-sem-extensao",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  const xmlByMime = detectPlanningImportSourceType("arquivo-sem-extensao", "text/xml");
  assertEqual(xlsxByMime, "excel", "MIME de xlsx deve bastar sem a extensão");
  assertEqual(xmlByMime, "ms-project-xml", "MIME de xml deve bastar sem a extensão");
});

runTest("modo leve: extensão/MIME não reconhecidos, sem bytes -> null (nunca adivinha)", () => {
  const result = detectPlanningImportSourceType("relatorio.pdf", "application/pdf");
  assertEqual(result, null, "extensão/MIME inválidos sem bytes disponíveis devem retornar null, nunca um palpite");
});

runTest("modo completo: sniffing de bytes reconhece .xlsx (assinatura ZIP) mesmo com extensão ambígua", () => {
  const zipSignatureBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  const result = detectPlanningImportSourceType("arquivo-sem-extensao", "application/octet-stream", zipSignatureBytes);
  assertEqual(result, "excel", "assinatura ZIP nos bytes deve identificar como excel quando extensão/MIME são ambíguos");
});

runTest("modo completo: sniffing de bytes reconhece XML (primeiro byte '<') mesmo com extensão ambígua", () => {
  const xmlBytes = new TextEncoder().encode("<Project></Project>");
  const result = detectPlanningImportSourceType("arquivo-sem-extensao", "application/octet-stream", xmlBytes);
  assertEqual(result, "ms-project-xml", "primeiro byte '<' deve identificar como XML quando extensão/MIME são ambíguos");
});

runTest("modo completo: bytes realmente não reconhecidos -> null", () => {
  const randomBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
  const result = detectPlanningImportSourceType("arquivo-sem-extensao", "application/octet-stream", randomBytes);
  assertEqual(result, null, "bytes que não batem com nenhuma assinatura conhecida devem retornar null, nunca um palpite");
});

runTest("sniffPlanningImportSourceTypeFromBytes nunca olha para o nome do arquivo — é isso que torna a detecção de mismatch em 'process' possível (Ajuste 2)", () => {
  // Um arquivo chamado "arquivo.xlsx" declararia 'excel' via
  // detectPlanningImportSourceType (extensão tem prioridade) — mas se
  // o conteúdo real for XML, sniffPlanningImportSourceTypeFromBytes
  // (usado por process/route.ts, nunca a função com prioridade de
  // extensão) precisa flagrar a divergência, não confirmar o nome.
  const declaredByExtension = detectPlanningImportSourceType("arquivo.xlsx", "application/octet-stream");
  const sniffedFromRealContent = sniffPlanningImportSourceTypeFromBytes(new TextEncoder().encode("<Project></Project>"));

  assertEqual(declaredByExtension, "excel", "declarado por extensão .xlsx no prepare-upload");
  assertEqual(sniffedFromRealContent, "ms-project-xml", "mas o conteúdo real é XML — process deve tratar isso como falha, nunca aceitar o nome do arquivo como verdade");
});

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
