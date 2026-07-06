"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

export type SpatialModelStatusLevel = "healthy" | "attention" | "risk" | "unknown";

export interface SpatialModelObject {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly statusLevel: SpatialModelStatusLevel;
  readonly confidenceLabel: string;
}

const STATUS_META: Record<SpatialModelStatusLevel, { readonly emoji: string; readonly cssVariable: string; readonly label: string }> = {
  healthy: { emoji: "🟢", cssVariable: "--status-green", label: "Confiança validada" },
  attention: { emoji: "🟡", cssVariable: "--status-amber", label: "Confiança parcial" },
  risk: { emoji: "🔴", cssVariable: "--status-red", label: "Baixa confiança" },
  unknown: { emoji: "⚪", cssVariable: "--text-muted", label: "Sem avaliação" }
};

/**
 * `spatialConfidenceLevel` (Low/Medium/High/Verified — já calculado
 * pelo BDOS, `domain/spatial-object/spatial-confidence.ts`) mapeado
 * para um status visual simples e restrito (3 cores + neutro) —
 * deliberadamente sem uma quarta cor nova, seguindo a mesma disciplina
 * de paleta contida de Palantir/Linear/Stripe.
 */
export function deriveSpatialModelStatus(confidenceLevel: string | null): SpatialModelStatusLevel {
  switch (confidenceLevel) {
    case "Verified":
    case "High":
      return "healthy";
    case "Medium":
      return "attention";
    case "Low":
      return "risk";
    default:
      return "unknown";
  }
}

interface BbaProjectSpatialModelProps {
  readonly objects: ReadonlyArray<SpatialModelObject>;
  readonly selectedObjectId: string | null;
  readonly onSelectObject: (objectId: string) => void;
}

/**
 * BBA Project Studio — Sprint 2, "Modelo Espacial" (EPIC 02, item 6).
 * Mesma implementação de referência do Geospatial Workspace
 * (`PlaceholderSpatialMapView`/`map-adapter.ts`) — NÃO alterada, nem
 * seu contrato — mas um componente próprio, dedicado a este produto,
 * para poder evoluir (hover, status, confiança) sem qualquer risco
 * para a tela de Geoespacial. Preparado para GIS: cada nó já é um
 * objeto espacial real; trocar por um mapa de verdade no futuro
 * significa uma nova implementação, não uma reescrita desta tela.
 */
export function BbaProjectSpatialModel({ objects, selectedObjectId, onSelectObject }: BbaProjectSpatialModelProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (objects.length === 0) {
    return (
      <div className="workspace-map-placeholder">
        <div className="workspace-map-placeholder__icon" aria-hidden="true">
          <MapPin size={22} />
        </div>
        <p className="workspace-map-placeholder__text">Nenhum objeto espacial disponível.</p>
      </div>
    );
  }

  return (
    <div className="bba-project-spatial-model">
      {objects.map((object) => {
        const meta = STATUS_META[object.statusLevel];
        const isSelected = object.id === selectedObjectId;
        const isHovered = object.id === hoveredId;

        return (
          <div className="bba-project-spatial-node-wrap" key={object.id}>
            <button
              aria-pressed={isSelected}
              className={`bba-project-spatial-node${isSelected ? " bba-project-spatial-node--selected" : ""}`}
              onBlur={() => setHoveredId(null)}
              onClick={() => onSelectObject(object.id)}
              onFocus={() => setHoveredId(object.id)}
              onMouseEnter={() => setHoveredId(object.id)}
              onMouseLeave={() => setHoveredId(null)}
              type="button"
            >
              <svg aria-hidden="true" height={12} viewBox="0 0 12 12" width={12}>
                <circle cx={6} cy={6} fill={`var(${meta.cssVariable})`} r={5} />
              </svg>
              <span className="bba-project-spatial-node__label">{object.label}</span>
            </button>
            {isHovered ? (
              <div className="bba-project-spatial-tooltip" role="tooltip">
                <strong>{object.label}</strong>
                <span>
                  {meta.emoji} {meta.label}
                </span>
                <span>{object.confidenceLabel}</span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
