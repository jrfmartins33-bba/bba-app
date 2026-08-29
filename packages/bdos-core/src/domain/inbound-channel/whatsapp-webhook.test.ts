/**
 * Testes direcionados — Fatia A: ingresso de evidência via WhatsApp (parte pura).
 * Fixtures usam identificadores FICTÍCIOS (nenhum número pessoal).
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  INBOUND_CHANNEL_WHATSAPP,
  InboundChannelMessageStatus,
  WHATSAPP_ALLOWED_MIME_TYPES,
  WHATSAPP_INGEST_DOCUMENT_CONTEXT,
  WHATSAPP_MAX_MEDIA_BYTES,
  WHATSAPP_SOURCE_SYSTEM,
  buildWhatsAppEvidenceStoragePath,
  deriveMessageKeyHash,
  evaluateWhatsAppIngest,
  maskExternalId,
  parseWhatsAppWebhook,
  verifyWhatsAppSubscription,
  type WhatsAppIngestConfig,
} from "./index";

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`ok - ${name}`);
}
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}
function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
function assertThrows(fn: () => void, snippet: string): void {
  try {
    fn();
  } catch (e) {
    if (e instanceof Error && e.message.includes(snippet)) return;
    throw e;
  }
  throw new Error(`Expected throw containing "${snippet}"`);
}

// ---- Fixtures fictícias ----
const VERIFY_TOKEN = "test-verify-token-fixture";
const PHONE_NUMBER_ID = "111111111111111";
const ALLOWED_WA_ID = "10005550000"; // fictício
const OTHER_WA_ID = "10009999999"; // fictício
const COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROJECT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

const CONFIG: WhatsAppIngestConfig = {
  phoneNumberId: PHONE_NUMBER_ID,
  allowedSenderWaId: ALLOWED_WA_ID,
  allowedMimeTypes: WHATSAPP_ALLOWED_MIME_TYPES,
  maxMediaBytes: WHATSAPP_MAX_MEDIA_BYTES,
};

function imageWebhook(over: {
  messageId?: string;
  from?: string;
  phoneNumberId?: string;
  mediaId?: string;
  mime?: string | null;
  type?: string;
} = {}): unknown {
  const message: Record<string, unknown> = {
    id: over.messageId ?? "wamid.FIXTURE-1",
    from: over.from ?? ALLOWED_WA_ID,
    timestamp: "1735689600",
    type: over.type ?? "image",
  };
  if ((over.type ?? "image") === "image") {
    message.image = { id: over.mediaId ?? "MEDIA-FIXTURE-1", mime_type: over.mime === undefined ? "image/jpeg" : over.mime };
  } else {
    message[over.type ?? "text"] = { body: "x" };
  }
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "ENTRY-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "0000", phone_number_id: over.phoneNumberId ?? PHONE_NUMBER_ID },
              messages: [message],
            },
          },
        ],
      },
    ],
  };
}

// 1 — GET token correto → challenge
runTest("GET verificação: token correto retorna o challenge", () => {
  const r = verifyWhatsAppSubscription({ mode: "subscribe", token: VERIFY_TOKEN, challenge: "CHAL-123" }, VERIFY_TOKEN);
  assert(r.outcome === "verified" && r.challenge === "CHAL-123", "challenge exato");
});

// 2 — GET token incorreto → forbidden
runTest("GET verificação: token incorreto → forbidden (403)", () => {
  assertEqual(verifyWhatsAppSubscription({ mode: "subscribe", token: "errado", challenge: "C" }, VERIFY_TOKEN).outcome, "forbidden", "token errado");
  assertEqual(verifyWhatsAppSubscription({ mode: "unsubscribe", token: VERIFY_TOKEN, challenge: "C" }, VERIFY_TOKEN).outcome, "forbidden", "mode errado");
  assertEqual(verifyWhatsAppSubscription({ mode: "subscribe", token: VERIFY_TOKEN, challenge: null }, VERIFY_TOKEN).outcome, "forbidden", "sem challenge");
  assertEqual(verifyWhatsAppSubscription({ mode: "subscribe", token: "", challenge: "C" }, "").outcome, "forbidden", "token vazio nunca verifica");
});

// 3 — parse imagem
runTest("parse: webhook de imagem extrai messageId/wa_id/mediaId/phoneNumberId", () => {
  const p = parseWhatsAppWebhook(imageWebhook());
  assert(p.kind === "image", "kind image");
  if (p.kind !== "image") return;
  assertEqual(p.providerMessageId, "wamid.FIXTURE-1", "messageId");
  assertEqual(p.senderWaId, ALLOWED_WA_ID, "wa_id");
  assertEqual(p.phoneNumberId, PHONE_NUMBER_ID, "phone_number_id do metadata");
  assertEqual(p.mediaId, "MEDIA-FIXTURE-1", "media id de image.id");
  assertEqual(p.declaredMimeType, "image/jpeg", "mime declarado");
});

// 4 — parse texto / status → não é imagem
runTest("parse: texto → other; payload sem mensagem → no_message", () => {
  const t = parseWhatsAppWebhook(imageWebhook({ type: "text" }));
  assert(t.kind === "other" && t.messageType === "text", "texto é other/text");
  const status = {
    object: "whatsapp_business_account",
    entry: [{ id: "E", changes: [{ field: "messages", value: { metadata: { phone_number_id: PHONE_NUMBER_ID }, statuses: [{ status: "delivered" }] } }] }],
  };
  assertEqual(parseWhatsAppWebhook(status).kind, "no_message", "status update → no_message");
  assertEqual(parseWhatsAppWebhook({ object: "page" }).kind, "no_message", "objeto errado → no_message");
});

// 5 — evaluate: imagem válida → preserve
runTest("evaluate: imagem JPEG do remetente/numero corretos → preserve_image", () => {
  const d = evaluateWhatsAppIngest(parseWhatsAppWebhook(imageWebhook()), CONFIG);
  assertEqual(d.action, "preserve_image", "preserva");
});
runTest("evaluate: imagem PNG também é aceita", () => {
  const d = evaluateWhatsAppIngest(parseWhatsAppWebhook(imageWebhook({ mime: "image/png" })), CONFIG);
  assertEqual(d.action, "preserve_image", "png aceita");
});

// 6 — evaluate: tipo não suportado
runTest("evaluate: texto/áudio/vídeo/documento/sticker → ignore_unsupported_type", () => {
  for (const type of ["text", "audio", "video", "document", "sticker", "location", "contacts"]) {
    const d = evaluateWhatsAppIngest(parseWhatsAppWebhook(imageWebhook({ type })), CONFIG);
    assertEqual(d.action, "ignore_unsupported_type", `${type} ignorado`);
  }
});

// 7 — evaluate: MIME declarado fora do escopo
runTest("evaluate: MIME declarado image/webp → ignore_unsupported_media", () => {
  const d = evaluateWhatsAppIngest(parseWhatsAppWebhook(imageWebhook({ mime: "image/webp" })), CONFIG);
  assertEqual(d.action, "ignore_unsupported_media", "webp fora do escopo");
});

// 8 — evaluate: remetente fora da allowlist
runTest("evaluate: wa_id ≠ allowlist → ignore_sender_not_allowlisted (sem download/ledger/documento)", () => {
  const d = evaluateWhatsAppIngest(parseWhatsAppWebhook(imageWebhook({ from: OTHER_WA_ID })), CONFIG);
  assertEqual(d.action, "ignore_sender_not_allowlisted", "remetente não autorizado");
});

// 9 — evaluate: phone_number_id errado
runTest("evaluate: phone_number_id ≠ configurado → ignore_wrong_phone_number (zero efeitos)", () => {
  const img = evaluateWhatsAppIngest(parseWhatsAppWebhook(imageWebhook({ phoneNumberId: "999" })), CONFIG);
  assertEqual(img.action, "ignore_wrong_phone_number", "imagem roteada errado");
  const other = evaluateWhatsAppIngest(parseWhatsAppWebhook(imageWebhook({ type: "text", phoneNumberId: "999" })), CONFIG);
  assertEqual(other.action, "ignore_wrong_phone_number", "não-imagem roteada errado");
});

// 10 — no_message → ignore
runTest("evaluate: no_message → ignore_no_message", () => {
  assertEqual(evaluateWhatsAppIngest({ kind: "no_message" }, CONFIG).action, "ignore_no_message", "sem mensagem");
});

// 11 — storage path determinístico e seguro
runTest("storage path: determinístico, com hash da chave (nunca o provider_message_id cru)", () => {
  const path = buildWhatsAppEvidenceStoragePath({
    companyId: COMPANY_ID,
    engineeringProjectId: PROJECT_ID,
    messageKeyHash: SHA_A,
    contentSha256: SHA_B,
    mimeType: "image/jpeg",
  });
  assertEqual(path, `${COMPANY_ID}/documents/whatsapp/${PROJECT_ID}/${SHA_A}/${SHA_B}.jpg`, "path exato");
  assert(path.startsWith(`${COMPANY_ID}/`), "começa com companyId (exigência da tabela/RLS)");
  assert(!path.includes("wamid"), "não contém id de mensagem cru");
  const png = buildWhatsAppEvidenceStoragePath({
    companyId: COMPANY_ID,
    engineeringProjectId: PROJECT_ID,
    messageKeyHash: SHA_A,
    contentSha256: SHA_B,
    mimeType: "image/png",
  });
  assert(png.endsWith(".png"), "extensão png");
});

// 12 — storage path rejeita traversal / segmentos inseguros
runTest("storage path: rejeita traversal e segmentos inseguros", () => {
  assertThrows(
    () => buildWhatsAppEvidenceStoragePath({ companyId: "../x", engineeringProjectId: PROJECT_ID, messageKeyHash: SHA_A, contentSha256: SHA_B, mimeType: "image/jpeg" }),
    "segmento inseguro",
  );
  assertThrows(
    () => buildWhatsAppEvidenceStoragePath({ companyId: COMPANY_ID, engineeringProjectId: "a/b", messageKeyHash: SHA_A, contentSha256: SHA_B, mimeType: "image/jpeg" }),
    "segmento inseguro",
  );
  assertThrows(
    () => buildWhatsAppEvidenceStoragePath({ companyId: COMPANY_ID, engineeringProjectId: PROJECT_ID, messageKeyHash: "not-a-hash", contentSha256: SHA_B, mimeType: "image/jpeg" }),
    "messageKeyHash não é SHA-256",
  );
  assertThrows(
    () => buildWhatsAppEvidenceStoragePath({ companyId: COMPANY_ID, engineeringProjectId: PROJECT_ID, messageKeyHash: SHA_A, contentSha256: "ZZZ", mimeType: "image/jpeg" }),
    "contentSha256 não é SHA-256",
  );
});

// 13 — deriveMessageKeyHash: determinístico, hash injetado
runTest("deriveMessageKeyHash: determinístico e usa (accountId:messageId), nunca descrição", () => {
  const calls: string[] = [];
  const fakeHash = (input: string): string => {
    calls.push(input);
    return SHA_A;
  };
  const h1 = deriveMessageKeyHash(PHONE_NUMBER_ID, "wamid.X", fakeHash);
  const h2 = deriveMessageKeyHash(PHONE_NUMBER_ID, "wamid.X", fakeHash);
  assertEqual(h1, h2, "mesmo input → mesmo hash");
  assertEqual(calls[0], `${PHONE_NUMBER_ID}:wamid.X`, "hash sobre accountId:messageId");
  assertThrows(() => deriveMessageKeyHash(PHONE_NUMBER_ID, "wamid.X", () => "curto"), "não retornou SHA-256");
});

// 14 — máscara de log
runTest("maskExternalId: nunca expõe o identificador completo", () => {
  assertEqual(maskExternalId(ALLOWED_WA_ID), "****0000", "só os 4 últimos");
  assertEqual(maskExternalId("12"), "****", "curtos totalmente mascarados");
});

// 15 — constantes de contrato
runTest("constantes: contexto/sourceSystem/canal/limites", () => {
  assertEqual(WHATSAPP_INGEST_DOCUMENT_CONTEXT, "project-cost-evidence", "document_context");
  assertEqual(WHATSAPP_SOURCE_SYSTEM, "whatsapp-cloud-api", "sourceSystem");
  assertEqual(INBOUND_CHANNEL_WHATSAPP, "whatsapp-cloud-api", "channel");
  assertEqual(WHATSAPP_MAX_MEDIA_BYTES, 5 * 1024 * 1024, "5 MB");
  assertEqual(WHATSAPP_ALLOWED_MIME_TYPES.join(","), "image/jpeg,image/png", "só JPEG/PNG");
  assertEqual(InboundChannelMessageStatus.Received, "Received", "status enum");
  assertEqual(InboundChannelMessageStatus.Preserved, "Preserved", "status enum");
  assertEqual(InboundChannelMessageStatus.Failed, "Failed", "status enum");
});

// 16 — nenhum número pessoal nas fixtures
runTest("nenhum número pessoal em fixture/fonte deste teste", () => {
  const banned = [/\+55\s?\d/, /\b55\d{9,11}\b/, /whatsapp\.com\/send/i];
  const self = imageWebhook();
  const serialized = JSON.stringify(self);
  for (const re of banned) assert(!re.test(serialized), `fixture sem padrão ${re}`);
});

// ---- Migration DRAFT ----
const MIGRATIONS_DIR = resolve(process.cwd(), "../../supabase/migrations");
const INBOUND_MIGRATION_NAME = "20260829000000_bdos_inbound_channel_messages.sql";
const INBOUND_MIGRATION = readFileSync(resolve(MIGRATIONS_DIR, INBOUND_MIGRATION_NAME), "utf8");
const INBOUND_MIGRATION_EXECUTABLE = INBOUND_MIGRATION.split("\n")
  .map((l) => l.replace(/--.*$/, ""))
  .join("\n");

// 17 — prefixo único e não aplicado
runTest("migration: prefixo único, aditiva, marcada NÃO APLICAR", () => {
  const names = readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith(".sql"));
  const prefixes = names.map((n) => n.slice(0, 14));
  assertEqual(new Set(prefixes).size, prefixes.length, "todos os prefixos de migration são únicos");
  assert(names.includes(INBOUND_MIGRATION_NAME), "a migration existe");
  assert(INBOUND_MIGRATION.includes("NÃO APLICAR"), "cabeçalho de não-aplicação");
  assert(!/INSERT\s+INTO\s+/i.test(INBOUND_MIGRATION_EXECUTABLE), "sem INSERT executável (zero business rows)");
  assert(!/ALTER\s+TABLE\s+(document_artifacts|document_versions|financial_lancamentos|project_cost)/i.test(INBOUND_MIGRATION_EXECUTABLE), "não altera tabelas existentes");
});

// 18 — unique key de identidade de entrega
runTest("migration: UNIQUE (channel, provider_account_id, provider_message_id)", () => {
  assert(
    /CREATE UNIQUE INDEX[^;]*inbound_channel_messages[\s\S]*?\(\s*channel,\s*provider_account_id,\s*provider_message_id\s*\)/i.test(INBOUND_MIGRATION),
    "índice único de identidade de entrega",
  );
  assert(!/UNIQUE[\s\S]{0,120}description/i.test(INBOUND_MIGRATION), "descrição nunca é identidade");
});

// 19 — RLS + grants + revokes
runTest("migration: RLS company-or-admin (SELECT); service_role SELECT/INSERT/UPDATE; sem DELETE; REVOKE antes de GRANT", () => {
  assert(/ALTER TABLE inbound_channel_messages ENABLE ROW LEVEL SECURITY/i.test(INBOUND_MIGRATION), "RLS habilitada");
  assert(
    /CREATE POLICY inbound_channel_messages_select_company_or_admin[\s\S]*?FOR SELECT TO authenticated[\s\S]*?company_id = get_my_company_id\(\) OR is_bba_admin\(\)/i.test(INBOUND_MIGRATION),
    "policy SELECT company-or-admin",
  );
  for (const role of ["PUBLIC", "anon", "authenticated", "service_role"]) {
    assert(new RegExp(`REVOKE ALL ON inbound_channel_messages FROM ${role};`).test(INBOUND_MIGRATION), `REVOKE ALL FROM ${role}`);
  }
  assert(/REVOKE ALL ON inbound_channel_messages FROM[\s\S]*GRANT SELECT ON inbound_channel_messages TO authenticated/.test(INBOUND_MIGRATION), "REVOKE antes de GRANT");
  assert(/GRANT SELECT ON inbound_channel_messages TO authenticated;/.test(INBOUND_MIGRATION), "authenticated: só SELECT");
  assert(/GRANT SELECT, INSERT, UPDATE ON inbound_channel_messages TO service_role;/.test(INBOUND_MIGRATION), "service_role: SELECT/INSERT/UPDATE");
  const grants = INBOUND_MIGRATION_EXECUTABLE.match(/GRANT[\s\S]*?;/gi) ?? [];
  assert(grants.every((g) => !/\bDELETE\b/i.test(g)), "nenhum GRANT concede DELETE");
  const policies = INBOUND_MIGRATION.match(/CREATE POLICY[\s\S]*?;/gi) ?? [];
  assert(
    policies.every((p) => /FOR SELECT/i.test(p) || /WITH CHECK \(false\)|USING \(false\)/i.test(p)),
    "policies de escrita para authenticated são bloqueadas (false)",
  );
  assert(/status IN \('Received', 'Preserved', 'Failed'\)/.test(INBOUND_MIGRATION), "status permitidos da Fatia A");
});

// 20 — Fatia A NÃO toca tabelas de custo, financeiro nem cria DocumentProcessingAttempt
runTest("código da Fatia A não referencia custos/financeiro nem DocumentProcessingAttempt", () => {
  const dir = resolve(process.cwd(), "../../apps/web/lib/integrations/whatsapp");
  const files = readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"));
  assert(files.length >= 4, "arquivos da integração presentes");
  const banned = [
    /project_cost_entries/,
    /project_cost_allocations/,
    /project_cost_centers/,
    /financial_lancamentos/,
    /DocumentProcessingAttempt/,
    /createDocumentProcessingAttempt/,
    /requestDocumentProcessingAttempt/,
    /@anthropic-ai|anthropic-sdk|tesseract|\bopenai\b/i,
    /messages\.create\(/,
  ];
  for (const file of files) {
    const content = readFileSync(resolve(dir, file), "utf8");
    for (const re of banned) {
      assert(!re.test(content), `${file} não contém ${re}`);
    }
  }
  // route handler também
  const route = readFileSync(
    resolve(process.cwd(), "../../apps/web/app/api/integrations/whatsapp/webhook/route.ts"),
    "utf8",
  );
  assert(!/project_cost|financial_lancamentos|DocumentProcessingAttempt|anthropic/i.test(route), "route sem custo/financeiro/attempt/LLM");
});

console.log("\nTodos os testes direcionados da Fatia A (parte pura + migration) passaram.");
