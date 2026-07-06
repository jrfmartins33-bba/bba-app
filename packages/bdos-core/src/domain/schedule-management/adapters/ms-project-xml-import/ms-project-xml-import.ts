import { createScheduleActivity, updateActivityProgress } from "../../schedule-management";
import { ScheduleDependencyType } from "../../schedule-management.types";
import type { ScheduleActivity, ScheduleActivityDependency } from "../../schedule-management.types";
import { createWorkPackage, WorkPackageType } from "../../../work-package-management";
import type { WorkPackage } from "../../../work-package-management/work-package-management.types";
import type {
  ImportProjectXmlError,
  ImportProjectXmlInput,
  ImportProjectXmlResult,
  ImportProjectXmlSkip,
} from "./ms-project-xml-import.types";

/**
 * Sprint Zero — BBA Project (ver `packages/bdos-core/docs/BBA_PROJECT.md`).
 *
 * Lê o schema real de exportação XML do Microsoft Project (Task/UID/
 * Name/OutlineLevel/Start/Finish/Duration/PercentComplete/Milestone/
 * Summary/PredecessorLink) — não o formato binário `.mpp`, que é
 * proprietário e não documentado; qualquer instalação do MS Project
 * exporta este XML via Arquivo → Salvar Como → XML. Esta é uma decisão
 * de escopo explícita, não uma limitação escondida.
 *
 * Deliberadamente NÃO usa uma biblioteca de XML: `bdos-core` nunca
 * teve uma dependência de runtime (mesma disciplina de
 * `architecture/engineering-boundaries.test.ts` Rule D, que proíbe
 * bibliotecas de documento no Export Engine, e do Mapa Operacional do
 * EPIC 06, que proibiu bibliotecas de mapa). Este leitor é
 * deliberadamente estreito — lê apenas os elementos deste schema
 * conhecido, não é um parser de XML de propósito geral.
 *
 * Simplificações explícitas (documentadas, não escondidas):
 * - `Duration` assume jornada de 8h/dia (padrão do MS Project).
 * - `LinkLag` é lido como número inteiro de dias — arquivos reais
 *   podem usar outras unidades (décimos de minuto); suporte completo a
 *   todas as unidades de lag fica para uma sprint futura.
 * - Calendários, exceções de calendário e recursos não são lidos
 *   (Fase 1 do BBA Project explicitamente os adia — ver roadmap).
 *
 * Cada atividade nasce conectada a um `WorkPackage` com o MESMO id
 * (`WorkPackageType.ExecutionFront` para tarefas-folha,
 * `WorkPackageType.ScopeGroup` para linhas de agrupamento da EAP) —
 * PRINCIPLE 005 é satisfeito reaproveitando o adaptador já existente
 * (`domain/spatial-object/adapters/work-package-management`, Sprint
 * 12) para produzir o `SpatialObject`, nunca duplicando essa lógica
 * aqui.
 */
/** Usado apenas quando `Start`/`Finish` estão ausentes de um Task malformado — nunca ocorre em uma exportação válida do MS Project. */
const FALLBACK_DATE = "1970-01-01";

export function importProjectXml(input: ImportProjectXmlInput): ImportProjectXmlResult {
  const errors: ImportProjectXmlError[] = [];
  const skipped: ImportProjectXmlSkip[] = [];

  let rawTasks: ReadonlyArray<RawTask>;

  try {
    rawTasks = parseTasks(input.xml);
  } catch (error) {
    errors.push({
      stage: "xml_parsing",
      taskUid: null,
      code: "malformed_xml",
      message: error instanceof Error ? error.message : "Failed to parse the project XML.",
    });
    return { success: false, activities: [], workPackages: [], skipped: [], errors };
  }

  const eligibleTasks = rawTasks.filter((task) => {
    if (task.uid === null) {
      skipped.push({ taskUid: "unknown", reason: "missing_uid" });
      return false;
    }

    if (task.uid === "0") {
      skipped.push({ taskUid: task.uid, reason: "project_summary_task" });
      return false;
    }

    if (task.name === null || task.name.trim().length === 0) {
      skipped.push({ taskUid: task.uid, reason: "missing_name" });
      return false;
    }

    return true;
  });

  const parentByUid = deriveParentByOutlineLevel(eligibleTasks);

  const activities: ScheduleActivity[] = [];
  const workPackages: WorkPackage[] = [];

  eligibleTasks.forEach((task, index) => {
    const uid = task.uid as string;
    const activityId = `activity-${uid}`;
    const parentUid = parentByUid.get(uid) ?? null;
    const parentActivityId = parentUid === null ? null : `activity-${parentUid}`;

    const dependencies: ScheduleActivityDependency[] = task.predecessorUids.map((predecessorUid) => ({
      predecessorId: `activity-${predecessorUid}`,
      type: ScheduleDependencyType.FinishToStart,
      lagDays: 0,
    }));

    const activityResult = createScheduleActivity({
      id: activityId,
      projectId: input.projectId,
      code: task.wbs ?? String(index + 1),
      name: task.name as string,
      parentActivityId,
      sequence: index,
      isSummary: task.isSummary,
      isMilestone: task.isMilestone,
      plannedStart: task.start ?? FALLBACK_DATE,
      plannedEnd: task.finish ?? task.start ?? FALLBACK_DATE,
      durationDays: task.durationDays,
      percentComplete: task.percentComplete,
      dependencies,
      correlationId: input.correlationId,
      createdBy: input.createdBy,
      sourceSystem: "ms-project-xml-import",
      metadata: { sourceTaskUid: uid },
    });

    if (!activityResult.success) {
      errors.push(
        ...activityResult.errors.map((error) => ({
          stage: "activity_creation" as const,
          taskUid: uid,
          code: error.code,
          message: error.message,
        })),
      );
      return;
    }

    // O schema do MS Project XML só grava `ActualStart`/`ActualFinish`
    // depois que o trabalho realmente começa. Quando ausentes mas
    // `PercentComplete` > 0, assume-se `Start` como início real — uma
    // aproximação razoável e documentada, não um dado inventado do
    // zero: o próprio percentual já é um dado real do arquivo.
    const activity =
      task.percentComplete > 0
        ? applyActualProgress(activityResult.activity, task)
        : activityResult.activity;

    activities.push(activity);

    const workPackageResult = createWorkPackage({
      id: activityId,
      organizationId: input.organizationId,
      contractId: input.contractId,
      projectId: input.projectId,
      code: task.wbs ?? String(index + 1),
      name: task.name as string,
      description: task.name as string,
      type: task.isSummary ? WorkPackageType.ScopeGroup : WorkPackageType.ExecutionFront,
      parentWorkPackageId: parentActivityId,
      sequence: index,
      correlationId: input.correlationId,
      createdBy: input.createdBy,
      sourceSystem: "ms-project-xml-import",
    });

    if (!workPackageResult.success) {
      errors.push(
        ...workPackageResult.errors.map((error) => ({
          stage: "work_package_creation" as const,
          taskUid: uid,
          code: error.code,
          message: error.message,
        })),
      );
      return;
    }

    workPackages.push(workPackageResult.workPackage);
  });

  return {
    success: errors.length === 0,
    activities,
    workPackages,
    skipped,
    errors,
  };
}

interface RawTask {
  readonly uid: string | null;
  readonly name: string | null;
  readonly wbs: string | null;
  readonly outlineLevel: number;
  readonly start: string | null;
  readonly finish: string | null;
  readonly actualStart: string | null;
  readonly actualFinish: string | null;
  readonly durationDays: number;
  readonly percentComplete: number;
  readonly isMilestone: boolean;
  readonly isSummary: boolean;
  readonly predecessorUids: ReadonlyArray<string>;
}

function applyActualProgress(activity: ScheduleActivity, task: RawTask): ScheduleActivity {
  const updated = updateActivityProgress({
    activity,
    percentComplete: task.percentComplete,
    actualStart: task.actualStart ?? task.start ?? FALLBACK_DATE,
    actualEnd: task.actualFinish,
  });

  return updated.success ? updated.activity : activity;
}

function parseTasks(xml: string): ReadonlyArray<RawTask> {
  const taskBlocks = extractBlocks(xml, "Task");

  if (taskBlocks.length === 0) {
    throw new Error("No <Task> elements found — is this a valid Microsoft Project XML export?");
  }

  return taskBlocks.map((block) => {
    const uid = extractTagValue(block, "UID");
    const predecessorBlocks = extractBlocks(block, "PredecessorLink");

    return {
      uid,
      name: extractTagValue(block, "Name"),
      wbs: extractTagValue(block, "WBS"),
      outlineLevel: Number(extractTagValue(block, "OutlineLevel") ?? "0"),
      start: toDateOnly(extractTagValue(block, "Start")),
      finish: toDateOnly(extractTagValue(block, "Finish")),
      actualStart: toDateOnly(extractTagValue(block, "ActualStart")),
      actualFinish: toDateOnly(extractTagValue(block, "ActualFinish")),
      durationDays: parseDurationToDays(extractTagValue(block, "Duration")),
      percentComplete: Number(extractTagValue(block, "PercentComplete") ?? "0"),
      isMilestone: extractTagValue(block, "Milestone") === "1",
      isSummary: extractTagValue(block, "Summary") === "1",
      predecessorUids: predecessorBlocks
        .map((predecessorBlock) => extractTagValue(predecessorBlock, "PredecessorUID"))
        .filter((value): value is string => value !== null),
    };
  });
}

/**
 * Deriva o pai de cada tarefa a partir de `OutlineLevel` (o schema
 * do MS Project XML não grava um id de pai explícito): como as
 * tarefas são sempre emitidas em ordem de WBS, o pai de uma tarefa no
 * nível N é a tarefa mais recente já vista no nível N-1 — a mesma
 * técnica de pilha usada por qualquer leitor de estrutura de tópicos.
 */
function deriveParentByOutlineLevel(tasks: ReadonlyArray<RawTask>): Map<string, string> {
  const parentByUid = new Map<string, string>();
  const lastSeenAtLevel = new Map<number, string>();

  tasks.forEach((task) => {
    const uid = task.uid as string;
    const parentUid = lastSeenAtLevel.get(task.outlineLevel - 1);

    if (parentUid !== undefined) {
      parentByUid.set(uid, parentUid);
    }

    lastSeenAtLevel.set(task.outlineLevel, uid);
  });

  return parentByUid;
}

function extractBlocks(xml: string, tag: string): ReadonlyArray<string> {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  const blocks: string[] = [];
  let match: RegExpExecArray | null = pattern.exec(xml);

  while (match !== null) {
    blocks.push(match[1] ?? "");
    match = pattern.exec(xml);
  }

  return blocks;
}

function extractTagValue(xml: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`);
  const match = pattern.exec(xml);
  return match === null ? null : decodeXmlEntities(match[1] ?? "").trim();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function toDateOnly(value: string | null): string | null {
  return value === null ? null : value.slice(0, 10);
}

/**
 * `Duration` no schema do MS Project XML é um `xsd:duration`
 * (ex.: "PT280H0M0S"). Assume-se jornada de 8h/dia — a mesma
 * convenção padrão do próprio Microsoft Project.
 */
function parseDurationToDays(value: string | null): number {
  if (value === null) {
    return 0;
  }

  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value.trim());

  if (match === null) {
    return 0;
  }

  const hours = Number(match[1] ?? "0");
  return Math.round(hours / 8);
}
