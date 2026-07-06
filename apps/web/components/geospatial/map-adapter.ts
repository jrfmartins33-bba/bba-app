import type { SpatialObjectStatusLevel } from "./spatial-object-status";

/**
 * EPIC 05/06 — Spatial Experience / Operational Visual Intelligence: a
 * camada de mapa é desacoplada de qualquer biblioteca específica
 * (Google Maps, Mapbox, CesiumJS, Leaflet, OpenLayers). Este contrato
 * — não a implementação concreta — é o que o resto da experiência
 * conhece. `SchematicSpatialMapView` (geospatial-schematic-map-view.tsx)
 * é a única implementação hoje, um esquema em SVG puro; trocar por uma
 * biblioteca real significa criar uma nova implementação deste mesmo
 * contrato, sem tocar em `GeospatialWorkspaceExperience` nem em nenhum
 * dado do BDOS.
 */
export type { SpatialObjectStatusLevel };

export interface SpatialMapObjectViewModel {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  /** `null` para objetos de topo (sem contêiner pai). */
  readonly parentId: string | null;
  readonly statusLevel: SpatialObjectStatusLevel;
  /** Texto pronto para tooltip, ex.: "Low (score 0/100)". */
  readonly confidenceLabel: string;
  /** Texto pronto para tooltip, ex.: "06/07/2026 · 09:40". */
  readonly lastUpdated: string;
}

export interface SpatialMapViewProps {
  readonly objects: ReadonlyArray<SpatialMapObjectViewModel>;
  readonly selectedObjectId: string | null;
  readonly hoveredObjectId: string | null;
  readonly onSelectObject: (objectId: string) => void;
  readonly onHoverObject: (objectId: string | null) => void;
}
