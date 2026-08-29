/**
 * Testes direcionados — orquestração da Fatia A (com fakes; sem rede/DB).
 * Fixtures fictícias, nenhum número pessoal.
 */
import { InboundChannelMessageStatus, type ParsedWhatsAppImageMessage } from "@bba/bdos-core/domain/inbound-channel";
import { sha256HexOfString } from "./whatsapp-signature";
import type {
  ClaimInboundChannelMessageInput,
  ClaimInboundChannelMessageResult,
  InboundChannelMessageRepository,
  InboundChannelMessageRow,
} from "./inbound-channel-message-repository";
import type { WhatsAppMediaResult } from "./whatsapp-media";
import {
  ingestWhatsAppImage,
  toIsoFromWhatsAppTimestamp,
  type DocumentRegistrar,
  type StorageUploader,
  type WhatsAppIngestDeps,
} from "./whatsapp-ingest-service";

const PENDING: Array<{ name: string; fn: () => Promise<void> | void }> = [];
function runTest(name: string, fn: () => Promise<void> | void): void {
  PENDING.push({ name, fn });
}
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}
function assertEqual<T>(a: T, b: T, m: string): void {
  if (a !== b) throw new Error(`${m}: expected ${String(b)}, got ${String(a)}`);
}

const COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROJECT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PHONE_NUMBER_ID = "111111111111111";
const WA_ID = "10005550000";
const MSG_ID = "wamid.FIXTURE-INGEST-1";

const IMAGE: ParsedWhatsAppImageMessage = {
  kind: "image",
  providerMessageId: MSG_ID,
  senderWaId: WA_ID,
  providerTimestamp: "1735689600",
  phoneNumberId: PHONE_NUMBER_ID,
  mediaId: "MEDIA-FIXTURE-1",
  declaredMimeType: "image/jpeg",
};

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02, 0x03]);

function okMedia(): WhatsAppMediaResult {
  return {
    outcome: "downloaded",
    bytes: JPEG_BYTES,
    sha256: sha256HexOfString("content"),
    mimeType: "image/jpeg",
    sizeBytes: JPEG_BYTES.byteLength,
    providerSha256: "provider-sha-ignored",
  };
}

class FakeRepo implements InboundChannelMessageRepository {
  rows = new Map<string, InboundChannelMessageRow>();
  claims: ClaimInboundChannelMessageInput[] = [];
  private seq = 0;

  seed(row: Partial<InboundChannelMessageRow> & { provider_account_id: string; provider_message_id: string }): void {
    const full: InboundChannelMessageRow = {
      id: row.id ?? `row-${++this.seq}`,
      company_id: row.company_id ?? COMPANY_ID,
      engineering_project_id: row.engineering_project_id ?? PROJECT_ID,
      channel: "whatsapp-cloud-api",
      provider_account_id: row.provider_account_id,
      provider_message_id: row.provider_message_id,
      provider_media_id: row.provider_media_id ?? null,
      sender_external_id: row.sender_external_id ?? WA_ID,
      message_type: row.message_type ?? "image",
      received_at: row.received_at ?? new Date().toISOString(),
      status: row.status ?? InboundChannelMessageStatus.Received,
      document_id: row.document_id ?? null,
      document_version_id: row.document_version_id ?? null,
      error_code: row.error_code ?? null,
      metadata: row.metadata ?? {},
    };
    this.rows.set(this.key(full.provider_account_id, full.provider_message_id), full);
  }
  private key(a: string, m: string): string {
    return `${a}::${m}`;
  }
  async claim(input: ClaimInboundChannelMessageInput): Promise<ClaimInboundChannelMessageResult> {
    this.claims.push(input);
    const k = this.key(input.providerAccountId, input.providerMessageId);
    const existing = this.rows.get(k);
    if (existing) {
      if (existing.status === InboundChannelMessageStatus.Preserved) return { outcome: "already_preserved", row: existing };
      if (existing.status === InboundChannelMessageStatus.Failed) return { outcome: "retry", row: existing };
      return { outcome: "in_progress", row: existing };
    }
    const row: InboundChannelMessageRow = {
      id: `row-${++this.seq}`,
      company_id: input.companyId,
      engineering_project_id: input.engineeringProjectId,
      channel: "whatsapp-cloud-api",
      provider_account_id: input.providerAccountId,
      provider_message_id: input.providerMessageId,
      provider_media_id: input.providerMediaId,
      sender_external_id: input.senderExternalId,
      message_type: input.messageType,
      received_at: input.receivedAt,
      status: InboundChannelMessageStatus.Received,
      document_id: null,
      document_version_id: null,
      error_code: null,
      metadata: input.metadata ?? {},
    };
    this.rows.set(k, row);
    return { outcome: "claimed", row };
  }
  async attachDocument(id: string, patch: { documentId: string; documentVersionId?: string | null }): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.id === id) {
        this.rows.set(this.key(row.provider_account_id, row.provider_message_id), {
          ...row,
          document_id: patch.documentId,
          document_version_id: patch.documentVersionId ?? row.document_version_id,
        });
      }
    }
  }
  async markPreserved(id: string, patch: { documentId: string; documentVersionId: string }): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.id === id) {
        this.rows.set(this.key(row.provider_account_id, row.provider_message_id), {
          ...row,
          status: InboundChannelMessageStatus.Preserved,
          document_id: patch.documentId,
          document_version_id: patch.documentVersionId,
          error_code: null,
        });
      }
    }
  }
  async markFailed(id: string, patch: { errorCode: string }): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.id === id) {
        this.rows.set(this.key(row.provider_account_id, row.provider_message_id), {
          ...row,
          status: InboundChannelMessageStatus.Failed,
          error_code: patch.errorCode,
        });
      }
    }
  }
  only(): InboundChannelMessageRow {
    assert(this.rows.size === 1, `esperado exatamente 1 ledger row, tem ${this.rows.size}`);
    return [...this.rows.values()][0];
  }
}

class FakeStorage implements StorageUploader {
  uploads: { path: string; bytes: Uint8Array; contentType: string }[] = [];
  mode: "uploaded" | "already_exists" | "transient_error" = "uploaded";
  async upload(input: { path: string; bytes: Uint8Array; contentType: "image/jpeg" | "image/png" }) {
    this.uploads.push(input);
    return this.mode === "transient_error"
      ? ({ outcome: "transient_error", reason: "upload_failed" } as const)
      : ({ outcome: this.mode } as const);
  }
}

class FakeRegistrar implements DocumentRegistrar {
  docCalls: { correlationId: string; metadata: Record<string, unknown> }[] = [];
  versionCalls: Parameters<DocumentRegistrar["registerVersion"]>[0][] = [];
  docMode: "created" | "transient_error" = "created";
  versionMode: "created" | "reused" | "transient_error" = "created";
  private n = 0;
  async registerDocument(input: { correlationId: string; metadata: Record<string, unknown> }) {
    this.docCalls.push(input);
    return this.docMode === "transient_error"
      ? ({ outcome: "transient_error", reason: "persistence_failure" } as const)
      : ({ outcome: "created", documentId: `doc-${++this.n}` } as const);
  }
  async registerVersion(input: Parameters<DocumentRegistrar["registerVersion"]>[0]) {
    this.versionCalls.push(input);
    return this.versionMode === "transient_error"
      ? ({ outcome: "transient_error", reason: "persistence_failure" } as const)
      : ({ outcome: this.versionMode, documentVersionId: `ver-${++this.n}` } as const);
  }
}

function makeDeps(over: Partial<WhatsAppIngestDeps> = {}): {
  deps: WhatsAppIngestDeps;
  repo: FakeRepo;
  storage: FakeStorage;
  registrar: FakeRegistrar;
  mediaCalls: string[];
} {
  const repo = new FakeRepo();
  const storage = new FakeStorage();
  const registrar = new FakeRegistrar();
  const mediaCalls: string[] = [];
  const deps: WhatsAppIngestDeps = {
    repo,
    companyId: COMPANY_ID,
    engineeringProjectId: PROJECT_ID,
    fetchMedia: async (mediaId) => {
      mediaCalls.push(mediaId);
      return okMedia();
    },
    storage,
    documents: registrar,
    sha256HexOfString,
    now: () => "2026-08-29T00:00:00.000Z",
    ...over,
  };
  return { deps, repo, storage, registrar, mediaCalls };
}

// 1 — caminho feliz
runTest("imagem válida → preservada: 1 ledger, 1 upload, 1 documento, 1 versão, status Preserved", async () => {
  const { deps, repo, storage, registrar, mediaCalls } = makeDeps();
  const out = await ingestWhatsAppImage(IMAGE, deps);
  assert(out.http === 200 && out.outcome === "preserved", "http 200 preserved");
  assertEqual(mediaCalls.length, 1, "1 download");
  assertEqual(storage.uploads.length, 1, "1 upload no storage");
  assertEqual(registrar.docCalls.length, 1, "1 DocumentArtifact");
  assertEqual(registrar.versionCalls.length, 1, "1 DocumentVersion");
  const row = repo.only();
  assertEqual(row.status, InboundChannelMessageStatus.Preserved, "ledger Preserved");
  assert(row.document_id !== null && row.document_version_id !== null, "ledger com document + version");
});

// 2 — path do storage: hash da chave, nunca o provider_message_id cru; começa com companyId
runTest("storage path: começa com companyId, contém hashes, nunca o provider_message_id cru", async () => {
  const { deps, storage } = makeDeps();
  await ingestWhatsAppImage(IMAGE, deps);
  const path = storage.uploads[0].path;
  assert(path.startsWith(`${COMPANY_ID}/documents/whatsapp/${PROJECT_ID}/`), "prefixo determinístico");
  assert(!path.includes(MSG_ID) && !path.includes("wamid"), "sem id de mensagem cru");
  assert(/\/[0-9a-f]{64}\/[0-9a-f]{64}\.jpg$/.test(path), "messageKeyHash/contentSha256.jpg");
});

// 3 — DocumentArtifact/DocumentVersion recebem os dados corretos de rastreabilidade
runTest("DocumentVersion recebe SHA/MIME/size/storageReference; correlationId = provider_message_id", async () => {
  const { deps, storage, registrar } = makeDeps();
  await ingestWhatsAppImage(IMAGE, deps);
  const v = registrar.versionCalls[0];
  assertEqual(v.sha256, sha256HexOfString("content"), "sha256 dos bytes baixados");
  assertEqual(v.mimeType, "image/jpeg", "mime real");
  assertEqual(v.sizeBytes, JPEG_BYTES.byteLength, "size dos bytes");
  assertEqual(v.storageReference, storage.uploads[0].path, "storageReference = path do upload");
  assertEqual(v.originalFileName, "whatsapp-image.jpg", "nome controlado, sem inventar fornecedor");
  assertEqual(v.correlationId, MSG_ID, "correlationId = provider_message_id");
  assertEqual(registrar.docCalls[0].correlationId, MSG_ID, "documento: correlationId = provider_message_id");
  const meta = registrar.docCalls[0].metadata;
  assertEqual(meta.providerMessageId, MSG_ID, "metadata rastreável");
  assert(!("rawWebhook" in meta) && !("body" in meta), "sem raw webhook inteiro na metadata");
  assert(!JSON.stringify(meta).toLowerCase().includes("bearer"), "sem token na metadata");
});

// 4 — retry após Preserved: zero novo download/storage/documento
runTest("retry de mensagem já Preserved → zero novo download/storage/documento", async () => {
  const { deps, repo, storage, registrar, mediaCalls } = makeDeps();
  repo.seed({
    provider_account_id: PHONE_NUMBER_ID,
    provider_message_id: MSG_ID,
    status: InboundChannelMessageStatus.Preserved,
    document_id: "doc-existing",
    document_version_id: "ver-existing",
  });
  const out = await ingestWhatsAppImage(IMAGE, deps);
  assert(out.http === 200 && out.outcome === "already_preserved", "already_preserved");
  assertEqual(mediaCalls.length, 0, "sem download");
  assertEqual(storage.uploads.length, 0, "sem upload");
  assertEqual(registrar.docCalls.length, 0, "sem novo documento");
  assertEqual(repo.rows.size, 1, "sem segunda identidade de ingresso");
});

// 5 — concorrência: segundo webhook idêntico enquanto o primeiro está em andamento
runTest("webhook idêntico com ledger em andamento → in_progress, sem duplicar trabalho", async () => {
  const { deps, repo, storage, registrar, mediaCalls } = makeDeps();
  repo.seed({ provider_account_id: PHONE_NUMBER_ID, provider_message_id: MSG_ID, status: InboundChannelMessageStatus.Received });
  const out = await ingestWhatsAppImage(IMAGE, deps);
  assert(out.http === 200 && out.outcome === "in_progress", "in_progress");
  assertEqual(mediaCalls.length + storage.uploads.length + registrar.docCalls.length, 0, "zero efeitos");
  assertEqual(repo.rows.size, 1, "uma única identidade");
});

// 6 — recuperação: ledger já tem document_id (mas versão falhou antes)
runTest("recuperação: document_id já no ledger → reutiliza, não cria novo DocumentArtifact", async () => {
  const { deps, repo, registrar } = makeDeps();
  repo.seed({
    provider_account_id: PHONE_NUMBER_ID,
    provider_message_id: MSG_ID,
    status: InboundChannelMessageStatus.Failed,
    error_code: "version_persistence_failure",
    document_id: "doc-recovered",
  });
  const out = await ingestWhatsAppImage(IMAGE, deps);
  assert(out.http === 200 && out.outcome === "preserved", "preserved no retry");
  assertEqual(registrar.docCalls.length, 0, "não recria DocumentArtifact");
  assertEqual(registrar.versionCalls[0].documentId, "doc-recovered", "reutiliza o document_id do ledger");
  assertEqual(repo.only().document_id, "doc-recovered", "ledger mantém o mesmo documento");
});

// 7 — mídia grande demais → Failed + 200
runTest("mídia > 5 MB → ledger Failed(media_too_large), HTTP 200, sem documento", async () => {
  const { deps, repo, registrar } = makeDeps({ fetchMedia: async () => ({ outcome: "too_large" }) });
  const out = await ingestWhatsAppImage(IMAGE, deps);
  assertEqual(out.http, 200, "200");
  assertEqual(repo.only().status, InboundChannelMessageStatus.Failed, "Failed");
  assertEqual(repo.only().error_code, "media_too_large", "error_code técnico");
  assertEqual(registrar.docCalls.length, 0, "sem documento");
});

// 8 — mídia com content-type fora do escopo → Failed + 200
runTest("mídia não-imagem no download → Failed(media_unsupported_content), HTTP 200", async () => {
  const { deps, repo } = makeDeps({ fetchMedia: async () => ({ outcome: "unsupported_media", reason: "content_type_application/pdf" }) });
  const out = await ingestWhatsAppImage(IMAGE, deps);
  assertEqual(out.http, 200, "200");
  assertEqual(repo.only().error_code, "media_unsupported_content", "error_code");
});

// 9 — erro transitório do download → Failed + 500 (permite retry do provider)
runTest("erro transitório no download → Failed + HTTP 500", async () => {
  const { deps, repo } = makeDeps({ fetchMedia: async () => ({ outcome: "transient_error", reason: "media_download_503" }) });
  const out = await ingestWhatsAppImage(IMAGE, deps);
  assertEqual(out.http, 500, "500 para retry");
  assertEqual(repo.only().status, InboundChannelMessageStatus.Failed, "Failed");
  assert((repo.only().error_code ?? "").startsWith("media_"), "error_code técnico controlado");
});

// 10 — storage transitório → Failed + 500
runTest("upload de storage transitório → Failed + 500", async () => {
  const { deps, repo, storage } = makeDeps();
  storage.mode = "transient_error";
  const out = await ingestWhatsAppImage(IMAGE, deps);
  assertEqual(out.http, 500, "500");
  assert((repo.only().error_code ?? "").startsWith("storage_"), "error_code de storage");
});

// 11 — storage already_exists → reutilização controlada, segue para documento
runTest("storage already_exists (path inclui SHA) → reutilização controlada, preserva", async () => {
  const { deps, storage } = makeDeps();
  storage.mode = "already_exists";
  const out = await ingestWhatsAppImage(IMAGE, deps);
  assert(out.http === 200 && out.outcome === "preserved", "preserva mesmo com objeto pré-existente");
});

// 12 — versão transitória → grava document_id e falha 500 (recuperável)
runTest("DocumentVersion transitória → document_id fica no ledger, HTTP 500, retry recupera", async () => {
  const { deps, repo, registrar } = makeDeps();
  registrar.versionMode = "transient_error";
  const out = await ingestWhatsAppImage(IMAGE, deps);
  assertEqual(out.http, 500, "500");
  assertEqual(repo.only().document_id, "doc-1", "document_id preservado no ledger para o retry");
  assertEqual(repo.only().status, InboundChannelMessageStatus.Failed, "Failed");

  // retry: reaproveita o document_id, cria só a versão
  registrar.versionMode = "created";
  const retry = await ingestWhatsAppImage(IMAGE, deps);
  assert(retry.http === 200 && retry.outcome === "preserved", "retry preserva");
  assertEqual(registrar.docCalls.length, 1, "DocumentArtifact criado uma única vez no total");
});

// 13 — claim recebe channel + phone_number_id, não descrição
runTest("claim usa (channel, phone_number_id, provider_message_id) como identidade", async () => {
  const { deps, repo } = makeDeps();
  await ingestWhatsAppImage(IMAGE, deps);
  const c = repo.claims[0];
  assertEqual(c.providerAccountId, PHONE_NUMBER_ID, "provider_account_id = phone_number_id");
  assertEqual(c.providerMessageId, MSG_ID, "provider_message_id");
  assertEqual(c.messageType, "image", "message_type");
});

// 14 — timestamp helper
runTest("toIsoFromWhatsAppTimestamp: segundos → ISO; inválido → null", () => {
  assertEqual(toIsoFromWhatsAppTimestamp("1735689600"), "2025-01-01T00:00:00.000Z", "epoch em segundos");
  assertEqual(toIsoFromWhatsAppTimestamp(""), null, "vazio");
  assertEqual(toIsoFromWhatsAppTimestamp("abc"), null, "não numérico");
});

void (async () => {
  for (const { name, fn } of PENDING) {
    await fn();
    console.log(`ok - ${name}`);
  }
  console.log("\nTodos os testes de orquestração da Fatia A passaram.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
