/** Testes direcionados — download da mídia Meta (com fetch fake). */
import { fetchWhatsAppMedia } from "./whatsapp-media";
import { sha256HexOfBytes } from "./whatsapp-signature";

const PENDING: Array<{ name: string; fn: () => Promise<void> }> = [];
function runTest(name: string, fn: () => Promise<void>): void {
  PENDING.push({ name, fn });
}
function assert(c: boolean, m: string): void {
  if (!c) throw new Error(`Assertion failed: ${m}`);
}
function assertEqual<T>(a: T, b: T, m: string): void {
  if (a !== b) throw new Error(`${m}: expected ${String(b)}, got ${String(a)}`);
}

const ACCESS_TOKEN = "fixture-access-token";
const GRAPH = "v21.0";
const PHONE_NUMBER_ID = "111111111111111";
const MEDIA_ID = "MEDIA-FIXTURE";
const TEMP_URL = "https://lookaside.fbsbx.com/whatsapp_business/attachments/fixture";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0x10, 0x20, 0x30, 0x40]);

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
function bytesResponse(bytes: Uint8Array, contentType: string, headers: Record<string, string> = {}): Response {
  return new Response(bytes as unknown as BodyInit, { status: 200, headers: { "content-type": contentType, ...headers } });
}

function fakeFetch(handlers: {
  meta?: (url: string, init?: RequestInit) => Response | Promise<Response>;
  media?: (url: string, init?: RequestInit) => Response | Promise<Response>;
}): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("graph.facebook.com")) {
      return handlers.meta
        ? handlers.meta(url, init)
        : jsonResponse({ url: TEMP_URL, mime_type: "image/jpeg", sha256: "meta-sha", file_size: JPEG.byteLength });
    }
    return handlers.media ? handlers.media(url, init) : bytesResponse(JPEG, "image/jpeg");
  }) as typeof fetch;
}

runTest("download em dois passos: Graph /{media-id} → URL temporária → GET autenticado", async () => {
  const seen: { url: string; auth: string | null }[] = [];
  const fetchImpl = fakeFetch({
    meta: (url, init) => {
      seen.push({ url, auth: (init?.headers as Record<string, string>)?.authorization ?? null });
      return jsonResponse({ url: TEMP_URL, mime_type: "image/jpeg", sha256: "meta-sha", file_size: JPEG.byteLength });
    },
    media: (url, init) => {
      seen.push({ url, auth: (init?.headers as Record<string, string>)?.authorization ?? null });
      return bytesResponse(JPEG, "image/jpeg");
    },
  });
  const r = await fetchWhatsAppMedia(MEDIA_ID, { accessToken: ACCESS_TOKEN, graphVersion: GRAPH, phoneNumberId: PHONE_NUMBER_ID, fetchImpl });
  assert(r.outcome === "downloaded", "baixou");
  if (r.outcome !== "downloaded") return;
  assertEqual(r.sha256, sha256HexOfBytes(JPEG), "SHA-256 sobre os bytes reais");
  assertEqual(r.mimeType, "image/jpeg", "mime");
  assertEqual(r.sizeBytes, JPEG.byteLength, "size");
  assertEqual(r.providerSha256, "meta-sha", "sha da Meta só em metadata técnica");
  assert(seen[0].url.includes(`/${GRAPH}/${MEDIA_ID}`) && seen[0].url.includes(`phone_number_id=${PHONE_NUMBER_ID}`), "passo A = Graph /{media-id}");
  assertEqual(seen[1].url, TEMP_URL, "passo B usa a URL retornada pela Meta (não a do webhook)");
  assert(seen[0].auth === `Bearer ${ACCESS_TOKEN}` && seen[1].auth === `Bearer ${ACCESS_TOKEN}`, "ambos autenticados");
});

runTest("MIME fora de jpeg/png (e sem magic bytes) → unsupported_media", async () => {
  const fetchImpl = fakeFetch({
    meta: () => jsonResponse({ url: TEMP_URL, mime_type: "application/pdf" }),
    media: () => bytesResponse(new Uint8Array([0x25, 0x50, 0x44, 0x46]), "application/pdf"),
  });
  const r = await fetchWhatsAppMedia(MEDIA_ID, { accessToken: ACCESS_TOKEN, graphVersion: GRAPH, phoneNumberId: PHONE_NUMBER_ID, fetchImpl });
  assertEqual(r.outcome, "unsupported_media", "pdf rejeitado");
});

runTest("arquivo > limite (por file_size declarado) → too_large sem baixar", async () => {
  let mediaCalled = false;
  const fetchImpl = fakeFetch({
    meta: () => jsonResponse({ url: TEMP_URL, mime_type: "image/jpeg", file_size: 6 * 1024 * 1024 }),
    media: () => {
      mediaCalled = true;
      return bytesResponse(JPEG, "image/jpeg");
    },
  });
  const r = await fetchWhatsAppMedia(MEDIA_ID, { accessToken: ACCESS_TOKEN, graphVersion: GRAPH, phoneNumberId: PHONE_NUMBER_ID, fetchImpl, maxBytes: 5 * 1024 * 1024 });
  assertEqual(r.outcome, "too_large", "declarado grande demais");
  assert(!mediaCalled, "nem tenta baixar");
});

runTest("stream maior que o limite real → too_large mesmo sem content-length", async () => {
  const big = new Uint8Array(64);
  const fetchImpl = fakeFetch({
    meta: () => jsonResponse({ url: TEMP_URL, mime_type: "image/jpeg" }),
    media: () => new Response(big as unknown as BodyInit, { status: 200, headers: { "content-type": "image/jpeg" } }),
  });
  const r = await fetchWhatsAppMedia(MEDIA_ID, { accessToken: ACCESS_TOKEN, graphVersion: GRAPH, phoneNumberId: PHONE_NUMBER_ID, fetchImpl, maxBytes: 16 });
  assertEqual(r.outcome, "too_large", "corta a leitura ao ultrapassar");
});

runTest("Graph indisponível → transient_error", async () => {
  const fetchImpl = fakeFetch({ meta: () => new Response("nope", { status: 503 }) });
  const r = await fetchWhatsAppMedia(MEDIA_ID, { accessToken: ACCESS_TOKEN, graphVersion: GRAPH, phoneNumberId: PHONE_NUMBER_ID, fetchImpl });
  assertEqual(r.outcome, "transient_error", "503 é transitório");
});

void (async () => {
  for (const { name, fn } of PENDING) {
    await fn();
    console.log(`ok - ${name}`);
  }
  console.log("\nTodos os testes de download de mídia da Fatia A passaram.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
