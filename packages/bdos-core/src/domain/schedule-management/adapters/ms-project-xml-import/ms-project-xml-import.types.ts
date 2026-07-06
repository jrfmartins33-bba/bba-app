import type { ScheduleActivity, ScheduleManagementError } from "../../schedule-management.types";
import type { WorkPackage, WorkPackageManagementError } from "../../../work-package-management/work-package-management.types";

export interface ImportProjectXmlInput {
  readonly xml: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly contractId: string;
  readonly correlationId: string;
  readonly createdBy: string;
}

export type ImportProjectXmlErrorStage = "xml_parsing" | "activity_creation" | "work_package_creation";

export interface ImportProjectXmlError {
  readonly stage: ImportProjectXmlErrorStage;
  readonly taskUid: string | null;
  readonly code: string;
  readonly message: string;
}

export interface ImportProjectXmlSkip {
  readonly taskUid: string;
  readonly reason: "missing_uid" | "missing_name" | "project_summary_task";
}

export interface ImportProjectXmlResult {
  readonly success: boolean;
  readonly activities: ReadonlyArray<ScheduleActivity>;
  readonly workPackages: ReadonlyArray<WorkPackage>;
  readonly skipped: ReadonlyArray<ImportProjectXmlSkip>;
  readonly errors: ReadonlyArray<ImportProjectXmlError>;
}

export type { ScheduleManagementError, WorkPackageManagementError };
