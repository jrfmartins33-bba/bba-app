import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import {
  DecisionCategory,
  DecisionImpact,
  DecisionPriority,
  DecisionStatus,
  type Decision,
} from "../domain/decision";
import type { Recommendation } from "../engines/decision/recommendation";
import type { EngineeringAdvisorContext } from "./advisor-context.types";
import { narrateEngineeringBriefing } from "./claude-narrator";
import { validateEngineeringAdvisorSummary } from "./advisor-response-validator";

// Epic 14 (BBA Advisor Evolution), Sprint 14.2 — live-check MANUAL, não é
// Golden Test. Chama a API real do Claude (exige ANTHROPIC_API_KEY no
// ambiente) para observar como o modelo responde ao schema/prompt atual e
// permitir calibrar. De propósito não termina em ".test.ts", então
// scripts/run-tests.mjs não o descobre nem roda sozinho — nunca é
// executado em CI, só manualmente:
//
//   cd packages/bdos-core
//   npx tsx src/advisor/advisor-live-check.ts
//
// ANTHROPIC_API_KEY não precisa mais ser exportada manualmente: carregamos
// aqui o .env.local de apps/web com @next/env — a mesma loadEnvConfig que
// o próprio Next.js usa internamente (dev: true, mesma precedência de
// .env/.env.local/.env.development[.local] do `next dev`). Isso só afeta
// process.env deste processo; nenhum outro arquivo do Advisor/BDOS foi
// alterado para isso.
//
// Saída é informativa, não pass/fail determinístico: resposta de LLM
// varia entre chamadas por natureza. Os Golden Tests determinísticos
// ficam em advisor-response-validator.test.ts, com fixtures fixas.

const APPS_WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../apps/web");
loadEnvConfig(APPS_WEB_DIR, true);

const decisionA: Decision = {
  id: "decision-1",
  tenantId: "tenant-1",
  organizationId: "organization-1",
  evidence: [
    {
      source: "kpi",
      sourceReference: "schedule-variance",
      description: "Atividade de fundação com atraso de 18 dias frente ao planejado.",
      metadata: {},
    },
  ],
  title: "Atraso crítico na fundação",
  summary: "A atividade de fundação está 18 dias atrasada frente ao planejado.",
  status: DecisionStatus.Proposed,
  priority: DecisionPriority.Critical,
  category: DecisionCategory.Operational,
  impact: DecisionImpact.High,
  confidence: 92,
  owner: "",
  dueDate: null,
  expectedBenefit: { description: "", metadata: {} },
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: "2026-07-01T09:00:00.000Z",
  resolvedAt: null,
  metadata: {},
};

const recommendationA: Recommendation = {
  id: "recommendation-1",
  decisionId: "decision-1",
  title: "Replanejar a atividade de fundação",
  summary: "Recomenda-se replanejar a atividade de fundação com a equipe de campo.",
  options: [],
  traceability: {
    decisionId: "decision-1",
    diagnosisId: null,
    capabilities: [],
    evidenceReferences: ["ref-1"],
    businessFactIds: ["fact-1"],
  },
  metadata: { decisionPriority: "critical" },
  createdAt: "2026-07-01T09:05:00.000Z",
};

const scenarios: ReadonlyArray<{ readonly name: string; readonly context: EngineeringAdvisorContext }> = [
  {
    name: "Decision crítica + Recommendation elegível",
    context: {
      snapshot: {
        engineeringProjectId: "project-1",
        engineeringProjectName: "Projeto Alpha",
        computedAt: new Date().toISOString(),
        healthScore: 62,
        previousHealthScore: 78,
      },
      decisions: [decisionA],
      recommendations: [recommendationA],
      evidenceIndex: { "decision-1": decisionA.evidence },
      historySummary: "Health Score 78 → 62.",
    },
  },
  {
    name: "Candidate Set vazio (sem decisions/recommendations elegíveis)",
    context: {
      snapshot: {
        engineeringProjectId: "project-1",
        engineeringProjectName: "Projeto Alpha",
        computedAt: new Date().toISOString(),
        healthScore: 81,
        previousHealthScore: 81,
      },
      decisions: [],
      recommendations: [],
      evidenceIndex: {},
      historySummary: "Health Score 81 (sem variação desde o snapshot anterior).",
    },
  },
];

async function main(): Promise<void> {
  for (const scenario of scenarios) {
    console.log(`\n=== ${scenario.name} ===`);

    try {
      const narration = await narrateEngineeringBriefing(scenario.context);
      console.log("Resposta bruta do Claude:");
      console.log(JSON.stringify(narration.raw, null, 2));

      const validation = validateEngineeringAdvisorSummary(narration.raw, scenario.context);
      if (validation.valid) {
        console.log(`VÁLIDO — ${validation.summary.insights.length} insight(s).`);
      } else {
        console.log(`INVÁLIDO — motivo: ${validation.reason}`);
      }
    } catch (error) {
      console.log(`ERRO na chamada/parse: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

main();
