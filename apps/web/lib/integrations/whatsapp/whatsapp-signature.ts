import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificação da assinatura do webhook Meta (X-Hub-Signature-256).
 *
 * A Meta assina o RAW body com HMAC-SHA256 usando o App Secret. Esta
 * função DEVE ser chamada sobre o corpo exatamente como recebido
 * (`request.text()`), NUNCA sobre JSON reserializado.
 *
 * Comparação timing-safe. O segredo nunca é logado.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret) {
    return false;
  }

  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) {
    return false;
  }

  const provided = signatureHeader.slice(prefix.length).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) {
    return false;
  }

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/** SHA-256 hex canônico (lowercase, 64 chars) de uma string UTF-8. */
export function sha256HexOfString(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** SHA-256 hex canônico dos BYTES efetivamente recebidos (nunca de um hash fornecido pelo cliente). */
export function sha256HexOfBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
