"use client";

import { MapPin } from "lucide-react";
import type { SpatialMapViewProps } from "./map-adapter";

/**
 * Implementação de hoje do contrato `SpatialMapViewProps`
 * (map-adapter.ts): uma grade de "pinos" clicáveis representando cada
 * objeto espacial real, sem nenhuma biblioteca de mapa por trás.
 * Reservado para troca futura por Google Maps, Mapbox, CesiumJS,
 * Leaflet ou OpenLayers — quem chama este componente (`GeospatialWorkspaceExperience`)
 * só conhece o contrato, nunca esta implementação.
 */
export function PlaceholderSpatialMapView({ objects, selectedObjectId, onSelectObject }: SpatialMapViewProps) {
  if (objects.length === 0) {
    return (
      <div className="workspace-map-placeholder">
        <div className="workspace-map-placeholder__icon" aria-hidden="true">
          <MapPin size={22} />
        </div>
        <p className="workspace-map-placeholder__text">Nenhum objeto espacial disponível.</p>
        <p className="workspace-map-placeholder__caption">
          Ative a camada Planejamento ou avance a Linha do Tempo para ver objetos espaciais.
        </p>
      </div>
    );
  }

  return (
    <div className="spatial-map">
      <div className="spatial-map-grid">
        {objects.map((object) => {
          const isSelected = object.id === selectedObjectId;

          return (
            <button
              className={isSelected ? "spatial-map-pin spatial-map-pin--selected" : "spatial-map-pin"}
              key={object.id}
              onClick={() => onSelectObject(object.id)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={
                  object.riskLevel === "attention"
                    ? "spatial-map-pin__icon spatial-map-pin__icon--attention"
                    : "spatial-map-pin__icon"
                }
              >
                <MapPin size={16} />
              </span>
              <span className="spatial-map-pin__label">{object.label}</span>
            </button>
          );
        })}
      </div>
      <p className="workspace-map-placeholder__caption">
        Espaço reservado para integração futura com Google Maps, Mapbox, CesiumJS, Leaflet ou OpenLayers — cada
        pino acima já representa um objeto espacial real, computado pela plataforma.
      </p>
    </div>
  );
}
