"use client";

import { useEffect, useRef } from "react";
import { ProgressBar } from "@bba/ui";
import type { BbaProjectActivity, BbaProjectPlanningActivity } from "./bba-project-view-types";

interface BbaProjectScheduleTableProps {
  readonly topLevelActivities: ReadonlyArray<BbaProjectPlanningActivity>;
  readonly planningActivities: ReadonlyArray<BbaProjectPlanningActivity>;
  readonly scheduleById: ReadonlyMap<string, BbaProjectActivity>;
  readonly criticalIds: ReadonlySet<string>;
  readonly selectedActivityId: string | null;
  readonly onSelectActivity: (activityId: string) => void;
  readonly asOfDate: string | null;
}

/**
 * BBA Project Studio — Sprint 2 (EPIC 02, item 5): o cronograma deixa
 * de ser o protagonista da tela — ele explica a decisão que o Advisor
 * já anunciou no Hero. A atividade selecionada rola automaticamente
 * para a área visível e recebe um realce visual consistente com o
 * Advisor/Modelo Espacial (mesma seleção, mesmo id, em todos os
 * lugares).
 */
export function BbaProjectScheduleTable({
  topLevelActivities,
  planningActivities,
  scheduleById,
  criticalIds,
  selectedActivityId,
  onSelectActivity,
  asOfDate
}: BbaProjectScheduleTableProps) {
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (selectedActivityId === null) {
      return;
    }
    rowRefs.current.get(selectedActivityId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedActivityId]);

  return (
    <div className="bba-project-wbs-table">
      {topLevelActivities.map((parent) => (
        <BbaProjectWbsGroup
          asOfDate={asOfDate}
          childActivities={planningActivities.filter((activity) => activity.parentId === parent.id)}
          criticalIds={criticalIds}
          key={parent.id}
          onSelectActivity={onSelectActivity}
          parent={parent}
          rowRefs={rowRefs.current}
          scheduleById={scheduleById}
          selectedActivityId={selectedActivityId}
        />
      ))}
    </div>
  );
}

interface BbaProjectWbsGroupProps {
  readonly parent: BbaProjectPlanningActivity;
  readonly childActivities: ReadonlyArray<BbaProjectPlanningActivity>;
  readonly criticalIds: ReadonlySet<string>;
  readonly scheduleById: ReadonlyMap<string, BbaProjectActivity>;
  readonly selectedActivityId: string | null;
  readonly onSelectActivity: (activityId: string) => void;
  readonly asOfDate: string | null;
  readonly rowRefs: Map<string, HTMLButtonElement>;
}

function BbaProjectWbsGroup({
  parent,
  childActivities,
  criticalIds,
  scheduleById,
  selectedActivityId,
  onSelectActivity,
  asOfDate,
  rowRefs
}: BbaProjectWbsGroupProps) {
  return (
    <div className="bba-project-wbs-group">
      <BbaProjectWbsRow
        activity={parent}
        asOfDate={asOfDate}
        isChild={false}
        isCritical={criticalIds.has(parent.id)}
        isSelected={parent.id === selectedActivityId}
        onSelectActivity={onSelectActivity}
        rowRefs={rowRefs}
        schedule={scheduleById.get(parent.id) ?? null}
      />
      {childActivities.map((child) => (
        <BbaProjectWbsRow
          activity={child}
          asOfDate={asOfDate}
          isChild
          isCritical={criticalIds.has(child.id)}
          isSelected={child.id === selectedActivityId}
          key={child.id}
          onSelectActivity={onSelectActivity}
          rowRefs={rowRefs}
          schedule={scheduleById.get(child.id) ?? null}
        />
      ))}
    </div>
  );
}

interface BbaProjectWbsRowProps {
  readonly activity: BbaProjectPlanningActivity;
  readonly schedule: BbaProjectActivity | null;
  readonly isChild: boolean;
  readonly isCritical: boolean;
  readonly isSelected: boolean;
  readonly onSelectActivity: (activityId: string) => void;
  readonly asOfDate: string | null;
  readonly rowRefs: Map<string, HTMLButtonElement>;
}

function BbaProjectWbsRow({ activity, schedule, isChild, isCritical, isSelected, onSelectActivity, asOfDate, rowRefs }: BbaProjectWbsRowProps) {
  const isLate = schedule !== null && schedule.percentComplete < 100 && asOfDate !== null && schedule.plannedEnd < asOfDate;
  const percent = schedule?.percentComplete ?? activity.percentActual ?? 0;

  return (
    <button
      className={`bba-project-wbs-row${isChild ? " bba-project-wbs-row--child" : ""}${isSelected ? " bba-project-wbs-row--selected" : ""}`}
      onClick={() => onSelectActivity(activity.id)}
      ref={(element) => {
        if (element) {
          rowRefs.set(activity.id, element);
        } else {
          rowRefs.delete(activity.id);
        }
      }}
      type="button"
    >
      <span className="bba-project-wbs-code">{activity.code}</span>
      <span className="bba-project-wbs-name">
        {activity.isMilestone ? "◆ " : ""}
        {activity.name}
      </span>
      <span className="bba-project-wbs-dates">{schedule ? `${schedule.plannedStart} → ${schedule.plannedEnd}` : "Sem datas na origem"}</span>
      <span className="bba-project-wbs-progress">
        <ProgressBar animated={false} color={isLate ? "red" : "gold"} value={percent} />
      </span>
      {isCritical ? <span className="bba-project-wbs-badge bba-project-wbs-badge--critical">Caminho Crítico</span> : null}
      {isLate ? <span className="bba-project-wbs-badge bba-project-wbs-badge--late">Atrasada</span> : null}
    </button>
  );
}
