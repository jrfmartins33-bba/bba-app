import { createHmac } from "node:crypto";
import { sha256HexOfBytes, sha256HexOfString, verifyMetaWebhookSignature } from "./whatsapp-signature";

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`ok - ${name}`);
}
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}
function assertEqual<T>(a: T, b: T, m: string): void {
  if (a !== b) throw new Error(`${m}: expected ${String(b)}, got ${String(a)}`);
}

const SECRET = "fixture-app-secret";
const RAW = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "E", changes: [] }] });
const sign = (body: string, secret = SECRET): string =>
  `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;

runTest("assinatura válida sobre o RAW body → aceita", () => {
  assert(verifyMetaWebhookSignature(RAW, sign(RAW), SECRET), "assinatura correta aceita");
});

runTest("assinatura inválida → rejeitada", () => {
  assert(!verifyMetaWebhookSignature(RAW, sign(RAW, "outro-segredo"), SECRET), "segredo errado");
  assert(!verifyMetaWebhookSignature(RAW, "sha256=" + "0".repeat(64), SECRET), "hex arbitrário");
  assert(!verifyMetaWebhookSignature(RAW, null, SECRET), "sem header");
  assert(!verifyMetaWebhookSignature(RAW, "deadbeef", SECRET), "sem prefixo sha256=");
  assert(!verifyMetaWebhookSignature(RAW, sign(RAW), ""), "sem app secret");
});

runTest("a assinatura é do RAW body, não de JSON reserializado", () => {
  const raw = '{"object":"whatsapp_business_account","entry":[ ]}'; // espaçamento peculiar
  const reserialized = JSON.stringify(JSON.parse(raw)); // muda os bytes
  assert(raw !== reserialized, "reserialização muda os bytes");
  const header = sign(raw);
  assert(verifyMetaWebhookSignature(raw, header, SECRET), "valida contra o raw");
  assert(!verifyMetaWebhookSignature(reserialized, header, SECRET), "NÃO valida contra o reserializado");
});

runTest("sha256HexOfBytes calcula sobre os bytes reais (64 hex lowercase)", () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const h = sha256HexOfBytes(bytes);
  assert(/^[0-9a-f]{64}$/.test(h), "hex canônico");
  assertEqual(sha256HexOfBytes(bytes), h, "determinístico");
  assert(sha256HexOfBytes(new Uint8Array([1, 2, 3, 4, 6])) !== h, "bytes diferentes → hash diferente");
});

runTest("sha256HexOfString determinístico e canônico", () => {
  const h = sha256HexOfString("111:wamid.X");
  assert(/^[0-9a-f]{64}$/.test(h), "hex canônico");
  assertEqual(sha256HexOfString("111:wamid.X"), h, "determinístico");
});

console.log("\nTodos os testes de assinatura/hash da Fatia A passaram.");
