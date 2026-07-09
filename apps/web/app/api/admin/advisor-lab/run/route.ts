import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient, requireBbaAdmin } from "@/lib/supabase/server";
import { getSnapshotDetailForLab } from "@/lib/bdos/advisor-lab-repository";
import { getEngineeringAdvisorHistoricalFacts } from "@/lib/bdos/advisor-historical-facts-repository";
import { buildEngineeringAdvisorContext } from "@bba/bdos-core/advisor/advisor-context-builder";
import {
  narrateEngineeringBriefingWithDiagnostics,
  renderEngineeringAdvisorSummaryToText
} from "@bba/bdos-core/advisor/claude-narrator";
import { validateEngineeringAdvisorSummary } from "@bba/bdos-core/advisor/advisor-response-validator";
import { buildEngineeringAdvisorExplanations } from "@bba/bdos-core/advisor/advisor-explanation-builder";
import { buildEngineeringAdvisorConfidence } from "@bba/bdos-core/advisor/advisor-confidence-builder";
import type { Decision, EngineeringAdvisorContext, Recommendation } from "@bba/bdos-core/advisor/advisor-context.types";

// Advisor Lab (Sprint 14.2A) — único ponto de execução manual do Advisor
// fora do fluxo de produção. Read-only de ponta a ponta: nunca chama
// insertAdvisorNarrative, nunca grava snapshot/recommendation nenhum.
//
// "mode: from-snapshot" (primeira execução) monta o EngineeringAdvisorContext
// a partir do snapshot escolhido, reusando buildEngineeringAdvisorContext
// sem alteração nenhuma. "mode: from-context" (botão "Executar novamente")
// reusa exatamente o contexto devolvido pela execução anterior, sem
// reconstruir nada — garante replay fiel para testar estabilidade.
export const dynamic = "force-dynamic";

type RunRequestBody =
  | { readonly mode: "from-snapshot"; readonly decisionSnapshotId: string }
  | { readonly mode: "from-context"; readonly context: EngineeringAdvisorContext };

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseRouteHandlerClient();
  const admin = await requireBbaAdmin(supabase);

  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: RunRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let context: EngineeringAdvisorContext;

  if (body.mode === "from-context") {
    context = body.context;
  } else if (body.mode === "from-snapshot") {
    let detail: Awaited<ReturnType<typeof getSnapshotDetailForLab>>;

    try {
      detail = await getSnapshotDetailForLab(supabase, body.decisionSnapshotId);
    } catch (error) {
      console.error("[advisor-lab] Falha ao ler o snapshot.", error);
      return NextResponse.json({ error: "snapshot_read_failed" }, { status: 500 });
    }

    if (!detail) {
      return NextResponse.json({ error: "snapshot_not_found" }, { status: 404 });
    }

    context = buildEngineeringAdvisorContext({
      engineeringProjectId: detail.engineeringProjectId,
      engineeringProjectName: detail.engineeringProjectName,
      computedAt: detail.computedAt,
      healthScore: detail.healthScore ?? 0,
      previousHealthScore: detail.previousHealthScore,
      decisions: detail.decisions as unknown as ReadonlyArray<Decision>,
      recommendations: detail.recommendations as unknown as ReadonlyArray<Recommendation>,
      eligibleRecommendationIds: detail.eligibleRecommendationIds
    });
  } else {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  try {
    const historicalFacts = await getEngineeringAdvisorHistoricalFacts(supabase, context);
    const diagnostics = await narrateEngineeringBriefingWithDiagnostics(context, historicalFacts);
    const metrics = {
      model: diagnostics.model,
      latencyMs: diagnostics.latencyMs,
      inputTokens: diagnostics.inputTokens,
      outputTokens: diagnostics.outputTokens,
      totalTokens: diagnostics.inputTokens + diagnostics.outputTokens,
      stopReason: diagnostics.stopReason,
      responseId: diagnostics.responseId
    };

    // Claude respondeu (temos usage/stop_reason/response id), mas o texto
    // não é JSON válido — diferente de uma falha de rede/auth (capturada
    // no catch abaixo), isto é um resultado normal a ser exibido no Lab,
    // não um erro de rota: devolve 200 com ok:false e o rawText/parseError
    // para a UI renderizar "Claude Response bruto" mesmo sem parse.
    if (!diagnostics.ok) {
      return NextResponse.json({
        ok: false,
        context,
        historicalFacts,
        systemPrompt: diagnostics.systemPrompt,
        userPrompt: diagnostics.userPrompt,
        rawText: diagnostics.rawText,
        parseError: diagnostics.parseError,
        metrics
      });
    }

    const validation = validateEngineeringAdvisorSummary(diagnostics.raw, context);

    // Explainability (Sprint 14.4) só existe para um insight já aprovado
    // pelo Validator — sem summary válido não há citação segura para
    // explicar. Nenhuma chamada nova ao Claude, nenhuma busca nova: usa
    // só o que já está em memória (context, historicalFacts, summary).
    const explanations = validation.valid
      ? buildEngineeringAdvisorExplanations(validation.summary, context, historicalFacts)
      : null;

    // Confidence Assessment (Sprint 14.5) — sempre calculado (mesmo se o
    // Validator reprovou: "low" também é um resultado informativo), nunca
    // pelo Claude. Reusa só o que Explainability já contou
    // (missingReferences), nenhuma consulta nova ao contexto.
    const confidence = buildEngineeringAdvisorConfidence(validation, explanations, historicalFacts);

    return NextResponse.json({
      ok: true,
      context,
      historicalFacts,
      systemPrompt: diagnostics.systemPrompt,
      userPrompt: diagnostics.userPrompt,
      raw: diagnostics.raw,
      validator: validation,
      narrative: validation.valid ? renderEngineeringAdvisorSummaryToText(validation.summary) : null,
      explanations,
      confidence,
      metrics
    });
  } catch (error) {
    console.error("[advisor-lab] Falha ao executar o Advisor.", error);
    return NextResponse.json(
      { error: "run_failed", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
