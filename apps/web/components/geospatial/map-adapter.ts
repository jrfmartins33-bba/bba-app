/**
 * EPIC 05 — Spatial Experience (Release 4.0), Objetivo 8: a camada de
 * mapa é desacoplada de qualquer biblioteca específica (Google Maps,
 * Mapbox, CesiumJS, Leaflet, OpenLayers). Este contrato — não a
 * implementação concreta — é o que o resto da experiência conhece.
 * `PlaceholderSpatialMapView` (geospatial-map-view.tsx) é a única
 * implementação hoje; trocar por uma biblioteca real significa criar
 * uma nova implementação deste mesmo contrato (ex.:
 * `GoogleMapsSpatialMapView`, `MapboxSpatialMapView`), sem tocar em
 * `GeospatialWorkspaceExperience` nem em nenhum dado do BDOS.
 */
export type SpatialMapObjectRiskLevel = "attention" | "none";

export interface SpatialMapObjectViewModel {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly riskLevel: SpatialMapObjectRiskLevel;
}

export interface SpatialMapViewProps {
  readonly objects: ReadonlyArray<SpatialMapObjectViewModel>;
  readonly selectedObjectId: string | null;
  readonly onSelectObject: (objectId: string) => void;
}
