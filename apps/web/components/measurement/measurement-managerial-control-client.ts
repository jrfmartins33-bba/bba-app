import type {
  ManagerialControlAnalyses,
  ManagerialControlItem,
  ManagerialControlSummary,
  ManagerialControlView,
  ManagerialItemStatus
} from "@/lib/bdos/measurement-managerial-control-service";

/**
 * "Controle Gerencial da Execução" — orquestra
 * `GET /api/measurement/imports/[id]/managerial-control`. Validação
 * estrutural leve (o payload tem centenas de itens): confirma o
 * envelope e a forma do resumo/análises; aceita a lista de itens como
 * veio do servidor (que já é a única fonte de decisão).
 */

export type {
  ManagerialControlView,
  ManagerialControlItem,
  ManagerialControlSummary,
  ManagerialControlAnalyses,
  ManagerialItemStatus
};

export type ManagerialControlFetchOutcome =
  | { readonly kind: "ok"; readonly view: ManagerialControlView }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "not_found" }
  | { readonly kind: "technical_error" };

const STATUS_VALUES: ReadonlyArray<ManagerialItemStatus> = [
  "no_bdos_measurement",
  "in_execution_bdos",
  "contract_quantity_reached",
  "above_contract_quantity",
  "insufficient_basis"
];

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function extractValidView(payload: unknown): ManagerialControlView | null {
  if (typeof payload !== "object" || payload === null) return null;
  const data = (payload as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  const c = data as Record<string, unknown>;

  if (typeof c.available !== "boolean") return null;
  if (c.unavailableReason !== null && !isString(c.unavailableReason)) return null;
  if (!Array.isArray(c.items)) return null;

  const s = c.summary as Record<string, unknown> | undefined;
  if (!s || typeof s.totalItems !== "number") return null;
  for (const key of [
    "contractedValueTotalDecimal",
    "bdosRegisteredValueTotalDecimal",
    "contractBalanceTotalDecimal"
  ]) {
    if (!isString(s[key])) return null;
  }
  if (typeof s.certificationRegistered !== "boolean") return null;
  if (typeof s.documentaryHistoryImported !== "boolean") return null;

  const a = c.analyses as Record<string, unknown> | undefined;
  if (!a || !Array.isArray(a.topByRegisteredValue) || !Array.isArray(a.itemsMeasuredThisPeriod)) return null;

  for (const raw of c.items.slice(0, 400)) {
    if (typeof raw !== "object" || raw === null) return null;
    const item = raw as Record<string, unknown>;
    if (!isString(item.id) || !isString(item.code) || !isString(item.description)) return null;
    if (!isString(item.contractedValueDecimal) || !isString(item.bdosRegisteredValueDecimal)) return null;
    if (!STATUS_VALUES.includes(item.status as ManagerialItemStatus)) return null;
    if (typeof item.flags !== "object" || item.flags === null) return null;
  }

  return data as ManagerialControlView;
}

export async function fetchManagerialControl(
  measurementBulletinImportId: string,
  fetchImpl: typeof fetch = fetch
): Promise<ManagerialControlFetchOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/measurement/imports/${measurementBulletinImportId}/managerial-control`);
  } catch {
    return { kind: "technical_error" };
  }
  if (response.status === 401) return { kind: "unauthenticated" };
  if (response.status === 404) return { kind: "not_found" };
  if (!response.ok) return { kind: "technical_error" };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "technical_error" };
  }
  const view = extractValidView(body);
  if (view === null) return { kind: "technical_error" };
  return { kind: "ok", view };
}
