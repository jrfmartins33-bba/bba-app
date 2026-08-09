import type { ReconstructedRecordKind, SemanticResolutionStatus } from "@bba/bdos-core/domain/budget-table-reconstruction.types";
import { RECORD_KIND_LABELS, RECORD_STATUS_LABELS } from "@/lib/budget/budget-reconstruction-lab-view-model";

export type ReconstructionStatusFilter = "all" | SemanticResolutionStatus;
export type ReconstructionKindFilter = "all" | ReconstructedRecordKind;
export type ReconstructionPageFilter = "all" | number;

export interface ReconstructionFiltersState {
  readonly search: string;
  readonly status: ReconstructionStatusFilter;
  readonly kind: ReconstructionKindFilter;
  readonly page: ReconstructionPageFilter;
  readonly includeUnclassified: boolean;
}

export const INITIAL_RECONSTRUCTION_FILTERS: ReconstructionFiltersState = {
  search: "",
  status: "all",
  kind: "all",
  page: "all",
  includeUnclassified: false,
};

const STATUS_OPTIONS: ReadonlyArray<{ readonly value: ReconstructionStatusFilter; readonly label: string }> = [
  { value: "all", label: "Todos" },
  { value: "resolved", label: RECORD_STATUS_LABELS.resolved },
  { value: "ambiguous", label: RECORD_STATUS_LABELS.ambiguous },
  { value: "insufficient_evidence", label: RECORD_STATUS_LABELS.insufficient_evidence },
];

const KIND_OPTIONS: ReadonlyArray<{ readonly value: ReconstructionKindFilter; readonly label: string }> = [
  { value: "all", label: "Todos" },
  { value: "group", label: RECORD_KIND_LABELS.group },
  { value: "subgroup", label: RECORD_KIND_LABELS.subgroup },
  { value: "service_item", label: RECORD_KIND_LABELS.service_item },
  { value: "subtotal", label: RECORD_KIND_LABELS.subtotal },
  { value: "total", label: RECORD_KIND_LABELS.total },
];

interface ReconstructionFiltersProps {
  readonly filters: ReconstructionFiltersState;
  readonly onChange: (filters: ReconstructionFiltersState) => void;
  readonly availablePages: ReadonlyArray<number>;
  readonly unclassifiedCount: number;
}

export function ReconstructionFilters({
  filters,
  onChange,
  availablePages,
  unclassifiedCount,
}: ReconstructionFiltersProps) {
  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "16px" }}>
      <div>
        <label htmlFor="reconstruction-search" style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
          Buscar por código ou descrição
        </label>
        <input
          id="reconstruction-search"
          type="text"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="ex.: 1.1.2 ou cerca"
        />
      </div>

      <div>
        <label htmlFor="reconstruction-status" style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
          Status
        </label>
        <select
          id="reconstruction-status"
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value as ReconstructionStatusFilter })}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="reconstruction-kind" style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
          Tipo
        </label>
        <select
          id="reconstruction-kind"
          value={filters.kind}
          onChange={(event) => onChange({ ...filters, kind: event.target.value as ReconstructionKindFilter })}
        >
          {KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="reconstruction-page" style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
          Página
        </label>
        <select
          id="reconstruction-page"
          value={String(filters.page)}
          onChange={(event) =>
            onChange({
              ...filters,
              page: event.target.value === "all" ? "all" : Number(event.target.value),
            })
          }
        >
          <option value="all">Todas</option>
          {availablePages.map((pageNumber) => (
            <option key={pageNumber} value={pageNumber}>
              {pageNumber}
            </option>
          ))}
        </select>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
        <input
          type="checkbox"
          checked={filters.includeUnclassified}
          onChange={(event) => onChange({ ...filters, includeUnclassified: event.target.checked })}
        />
        Incluir linhas não classificadas ({unclassifiedCount})
      </label>
    </div>
  );
}
