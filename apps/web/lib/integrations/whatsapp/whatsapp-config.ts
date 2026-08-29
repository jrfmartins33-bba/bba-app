/**
 * Configuração da integração WhatsApp — SOMENTE variáveis de ambiente
 * server-only. Nada de NEXT_PUBLIC_*. Nenhum valor real em código,
 * migration, testes, fixtures, logs ou README.
 */

export class WhatsAppConfigurationError extends Error {
  constructor(message: string) {
    super(`WhatsAppConfigurationError: ${message}`);
    this.name = "WhatsAppConfigurationError";
  }
}

export interface WhatsAppIntegrationConfig {
  readonly verifyToken: string;
  readonly appSecret: string;
  readonly accessToken: string;
  readonly graphVersion: string;
  readonly phoneNumberId: string;
  /** company_id da obra de teste (config de ambiente, nunca hardcode). */
  readonly companyId: string;
  /** engineering_project_id da obra de teste. */
  readonly projectId: string;
  /** único wa_id autorizado no primeiro teste. */
  readonly allowedSenderWaId: string;
  /** profile técnico de ingresso (registered_by / uploaded_by). */
  readonly ingestActorId: string;
}

const REQUIRED = [
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_GRAPH_VERSION",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_TEST_COMPANY_ID",
  "WHATSAPP_TEST_PROJECT_ID",
  "WHATSAPP_ALLOWED_SENDER_WA_ID",
  "WHATSAPP_INGEST_ACTOR_ID",
] as const;

function readRequired(name: (typeof REQUIRED)[number]): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WhatsAppConfigurationError(`variável de ambiente ausente: ${name}`);
  }
  return value.trim();
}

/**
 * Lê e valida a configuração. Falha explicitamente (erro de configuração)
 * se qualquer variável estiver ausente. NUNCA usa defaults com valores reais.
 */
export function readWhatsAppIntegrationConfig(): WhatsAppIntegrationConfig {
  const missing = REQUIRED.filter((name) => {
    const v = process.env[name];
    return typeof v !== "string" || v.trim().length === 0;
  });
  if (missing.length > 0) {
    throw new WhatsAppConfigurationError(`variáveis de ambiente ausentes: ${missing.join(", ")}`);
  }

  return {
    verifyToken: readRequired("WHATSAPP_VERIFY_TOKEN"),
    appSecret: readRequired("WHATSAPP_APP_SECRET"),
    accessToken: readRequired("WHATSAPP_ACCESS_TOKEN"),
    graphVersion: readRequired("WHATSAPP_GRAPH_VERSION"),
    phoneNumberId: readRequired("WHATSAPP_PHONE_NUMBER_ID"),
    companyId: readRequired("WHATSAPP_TEST_COMPANY_ID"),
    projectId: readRequired("WHATSAPP_TEST_PROJECT_ID"),
    allowedSenderWaId: readRequired("WHATSAPP_ALLOWED_SENDER_WA_ID"),
    ingestActorId: readRequired("WHATSAPP_INGEST_ACTOR_ID"),
  };
}
