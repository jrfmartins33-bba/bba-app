import { sha256HexOfBytes } from "./whatsapp-signature";

/**
 * Download da mídia do WhatsApp Cloud API (Fatia A).
 *
 * Passo A: GET Graph `/{media-id}` (autenticado) → URL temporária da Meta.
 * Passo B: GET nessa URL (autenticado) → bytes.
 * NUNCA se usa uma URL vinda diretamente do webhook.
 *
 * Impõe: Content-Type em image/jpeg|png, limite REAL de 5 MB (não confia
 * só em Content-Length), SHA-256 dos bytes efetivamente baixados.
 */

export const WHATSAPP_ALLOWED_DOWNLOAD_MIME: ReadonlyArray<"image/jpeg" | "image/png"> = [
  "image/jpeg",
  "image/png",
];
export const WHATSAPP_MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;

export type WhatsAppMediaResult =
  | {
      readonly outcome: "downloaded";
      readonly bytes: Uint8Array;
      readonly sha256: string;
      readonly mimeType: "image/jpeg" | "image/png";
      readonly sizeBytes: number;
      /** SHA fornecido pela Meta, se houver — vai só para metadata técnica. */
      readonly providerSha256: string | null;
    }
  | { readonly outcome: "unsupported_media"; readonly reason: string }
  | { readonly outcome: "too_large" }
  | { readonly outcome: "transient_error"; readonly reason: string };

export interface FetchWhatsAppMediaDeps {
  readonly accessToken: string;
  readonly graphVersion: string;
  readonly phoneNumberId: string;
  /** injetável para teste. Default: fetch global. */
  readonly fetchImpl?: typeof fetch;
  readonly maxBytes?: number;
}

interface GraphMediaMetadata {
  readonly url: string;
  readonly mimeType: string | null;
  readonly sha256: string | null;
  readonly fileSize: number | null;
}

export async function fetchWhatsAppMedia(
  mediaId: string,
  deps: FetchWhatsAppMediaDeps,
): Promise<WhatsAppMediaResult> {
  const doFetch = deps.fetchImpl ?? fetch;
  const maxBytes = deps.maxBytes ?? WHATSAPP_MAX_DOWNLOAD_BYTES;

  let meta: GraphMediaMetadata;
  try {
    const metaRes = await doFetch(
      `https://graph.facebook.com/${encodeURIComponent(deps.graphVersion)}/${encodeURIComponent(mediaId)}?phone_number_id=${encodeURIComponent(deps.phoneNumberId)}`,
      { method: "GET", headers: { authorization: `Bearer ${deps.accessToken}` } },
    );
    if (!metaRes.ok) {
      return { outcome: "transient_error", reason: `graph_media_metadata_${metaRes.status}` };
    }
    const body = (await metaRes.json()) as Record<string, unknown>;
    const url = typeof body.url === "string" ? body.url : null;
    if (!url) {
      return { outcome: "transient_error", reason: "graph_media_metadata_no_url" };
    }
    meta = {
      url,
      mimeType: typeof body.mime_type === "string" ? body.mime_type.split(";")[0].trim().toLowerCase() : null,
      sha256: typeof body.sha256 === "string" ? body.sha256 : null,
      fileSize: typeof body.file_size === "number" ? body.file_size : null,
    };
  } catch (error) {
    return { outcome: "transient_error", reason: toReason(error, "graph_media_metadata_fetch_failed") };
  }

  // Rejeição antecipada por Content-Length declarado (não é a única barreira).
  if (meta.fileSize !== null && meta.fileSize > maxBytes) {
    return { outcome: "too_large" };
  }

  let response: Response;
  try {
    response = await doFetch(meta.url, {
      method: "GET",
      headers: { authorization: `Bearer ${deps.accessToken}` },
    });
  } catch (error) {
    return { outcome: "transient_error", reason: toReason(error, "media_download_fetch_failed") };
  }
  if (!response.ok) {
    return { outcome: "transient_error", reason: `media_download_${response.status}` };
  }

  const declaredContentType = (response.headers.get("content-type") ?? meta.mimeType ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  const contentLength = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { outcome: "too_large" };
  }

  // Leitura com limite REAL: interrompe assim que ultrapassar maxBytes.
  const readResult = await readBodyWithLimit(response, maxBytes);
  if (readResult.outcome === "too_large") {
    return { outcome: "too_large" };
  }
  if (readResult.outcome === "error") {
    return { outcome: "transient_error", reason: readResult.reason };
  }
  const bytes = readResult.bytes;

  const effectiveMime = normalizeImageMime(declaredContentType) ?? sniffImageMime(bytes);
  if (effectiveMime === null || !WHATSAPP_ALLOWED_DOWNLOAD_MIME.includes(effectiveMime)) {
    return { outcome: "unsupported_media", reason: `content_type_${declaredContentType || "unknown"}` };
  }

  return {
    outcome: "downloaded",
    bytes,
    sha256: sha256HexOfBytes(bytes),
    mimeType: effectiveMime,
    sizeBytes: bytes.byteLength,
    providerSha256: meta.sha256,
  };
}

type ReadBodyResult =
  | { readonly outcome: "ok"; readonly bytes: Uint8Array }
  | { readonly outcome: "too_large" }
  | { readonly outcome: "error"; readonly reason: string };

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<ReadBodyResult> {
  const reader = response.body?.getReader?.();
  if (!reader) {
    try {
      const buf = new Uint8Array(await response.arrayBuffer());
      return buf.byteLength > maxBytes ? { outcome: "too_large" } : { outcome: "ok", bytes: buf };
    } catch (error) {
      return { outcome: "error", reason: toReason(error, "media_body_read_failed") };
    }
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => undefined);
          return { outcome: "too_large" };
        }
        chunks.push(value);
      }
    }
  } catch (error) {
    return { outcome: "error", reason: toReason(error, "media_stream_read_failed") };
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { outcome: "ok", bytes: out };
}

function normalizeImageMime(value: string): "image/jpeg" | "image/png" | null {
  if (value === "image/jpeg" || value === "image/jpg") return "image/jpeg";
  if (value === "image/png") return "image/png";
  return null;
}

/** Magic bytes: JPEG FF D8 FF; PNG 89 50 4E 47. */
function sniffImageMime(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  return null;
}

function toReason(error: unknown, fallback: string): string {
  // Nunca inclui token/segredo — só uma etiqueta técnica curta.
  return error instanceof Error && error.name ? `${fallback}:${error.name}` : fallback;
}
