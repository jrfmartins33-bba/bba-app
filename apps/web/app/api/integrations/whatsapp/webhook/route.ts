import {
  evaluateWhatsAppIngest,
  parseWhatsAppWebhook,
  verifyWhatsAppSubscription,
  WHATSAPP_ALLOWED_MIME_TYPES,
  WHATSAPP_MAX_MEDIA_BYTES,
} from "@bba/bdos-core/domain/inbound-channel";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  readWhatsAppIntegrationConfig,
  WhatsAppConfigurationError,
} from "@/lib/integrations/whatsapp/whatsapp-config";
import { verifyMetaWebhookSignature } from "@/lib/integrations/whatsapp/whatsapp-signature";
import {
  assertIngestActorConfigured,
  buildWhatsAppIngestDeps,
} from "@/lib/integrations/whatsapp/whatsapp-ingest-runtime";
import { ingestWhatsAppImage } from "@/lib/integrations/whatsapp/whatsapp-ingest-service";

/**
 * Webhook WhatsApp Cloud API — integração servidor-servidor.
 * NÃO usa sessão do BDOS. GET = verificação Meta. POST = ingresso de mídia.
 * Fatia A termina em "Documento recebido e preservado". Sem OCR/LLM/reply.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  let config;
  try {
    config = readWhatsAppIntegrationConfig();
  } catch (error) {
    return configErrorResponse(error);
  }

  const url = new URL(request.url);
  const result = verifyWhatsAppSubscription(
    {
      mode: url.searchParams.get("hub.mode"),
      token: url.searchParams.get("hub.verify_token"),
      challenge: url.searchParams.get("hub.challenge"),
    },
    config.verifyToken,
  );

  if (result.outcome === "verified") {
    return new Response(result.challenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(request: Request): Promise<Response> {
  // 1. RAW body ANTES de qualquer parse.
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");

  // 2. Configuração server-only.
  let config;
  try {
    config = readWhatsAppIntegrationConfig();
  } catch (error) {
    return configErrorResponse(error);
  }

  // 3. Assinatura HMAC sobre o RAW body — antes de tocar no payload.
  if (!verifyMetaWebhookSignature(rawBody, signatureHeader, config.appSecret)) {
    return new Response("invalid signature", { status: 401 });
  }

  // 4. Só agora desserializa.
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const parsed = parseWhatsAppWebhook(body);
  const decision = evaluateWhatsAppIngest(parsed, {
    phoneNumberId: config.phoneNumberId,
    allowedSenderWaId: config.allowedSenderWaId,
    allowedMimeTypes: WHATSAPP_ALLOWED_MIME_TYPES,
    maxMediaBytes: WHATSAPP_MAX_MEDIA_BYTES,
  });

  // 5. Mensagens fora de escopo: 200, ZERO efeito colateral.
  if (decision.action !== "preserve_image") {
    return acknowledged(decision.action);
  }

  // 6. Preservar a imagem.
  try {
    const supabase = getSupabaseServiceRoleClient();
    await assertIngestActorConfigured(supabase, {
      actorId: config.ingestActorId,
      companyId: config.companyId,
    });

    const deps = buildWhatsAppIngestDeps(supabase, config);
    const outcome = await ingestWhatsAppImage(decision.message, deps);
    return new Response(JSON.stringify({ outcome: outcome.outcome }), {
      status: outcome.http,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (error instanceof WhatsAppConfigurationError) {
      return configErrorResponse(error);
    }
    // Erro transitório: 500 permite retry do provider. Sem stack/token no corpo.
    console.error("[whatsapp/webhook] erro transitório ao preservar mídia:", safeErrorLabel(error));
    return new Response(JSON.stringify({ outcome: "transient_error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

function acknowledged(action: string): Response {
  return new Response(JSON.stringify({ outcome: "acknowledged", action }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function configErrorResponse(error: unknown): Response {
  console.error("[whatsapp/webhook] configuração ausente/inválida:", safeErrorLabel(error));
  return new Response(JSON.stringify({ outcome: "configuration_error" }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });
}

/** Etiqueta curta e segura para log — nunca token/segredo/stack. */
function safeErrorLabel(error: unknown): string {
  if (error instanceof WhatsAppConfigurationError) return error.message;
  if (error instanceof Error) return error.name;
  return "unknown_error";
}
