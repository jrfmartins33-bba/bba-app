"use client";

import { MapPin } from "lucide-react";
import type { SpatialMapObjectViewModel, SpatialMapViewProps } from "./map-adapter";
import { getSpatialObjectStatusMeta } from "./spatial-object-status";

/**
 * EPIC 06 — Operational Visual Intelligence (Release 5.0), Objetivo 3.
 * Implementação de hoje do contrato `SpatialMapViewProps`
 * (map-adapter.ts): uma representação esquemática da obra, sem
 * imagens e sem nenhuma biblioteca de mapa — cada objeto espacial de
 * topo (`parentId === null`) vira um contêiner; cada objeto que ele
 * contém vira uma linha dentro dele. Um contêiner sem filhos mostra a
 * si mesmo como sua própria linha, para que nenhum SpatialObject deixe
 * de virar um elemento visual (inclusive objetos de topo sem
 * hierarquia, como uma segunda frente isolada).
 *
 * O indicador de status de cada linha é um `<svg>` real (um círculo),
 * nunca uma imagem — reservado para troca futura por Google Maps,
 * Mapbox, CesiumJS, Leaflet ou OpenLayers (ver Objetivo 9): a
 * implementação futura recebe exatamente as mesmas props.
 */
export function SchematicSpatialMapView({
  objects,
  selectedObjectId,
  hoveredObjectId,
  onSelectObject,
  onHoverObject
}: SpatialMapViewProps) {
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

  const containers = objects.filter((object) => object.parentId === null);

  return (
    <div className="spatial-map">
      <div className="spatial-map-diagram">
        {containers.map((container) => {
          const children = objects.filter((object) => object.parentId === container.id);

          return (
            <div className="spatial-map-container" key={container.id}>
              <SpatialMapNode
                bold
                hoveredObjectId={hoveredObjectId}
                object={container}
                onHoverObject={onHoverObject}
                onSelectObject={onSelectObject}
                selectedObjectId={selectedObjectId}
              />
              {children.length > 0 ? (
                <div className="spatial-map-container__children">
                  {children.map((child) => (
                    <SpatialMapNode
                      hoveredObjectId={hoveredObjectId}
                      key={child.id}
                      object={child}
                      onHoverObject={onHoverObject}
                      onSelectObject={onSelectObject}
                      selectedObjectId={selectedObjectId}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="workspace-map-placeholder__caption">
        Representação esquemática — cada nó já é um objeto espacial real, computado pelo BDOS. Espaço reservado
        para integração futura com Google Maps, Mapbox, CesiumJS, Leaflet ou OpenLayers, através deste mesmo
        contrato.
      </p>
    </div>
  );
}

interface SpatialMapNodeProps {
  readonly object: SpatialMapObjectViewModel;
  readonly selectedObjectId: string | null;
  readonly hoveredObjectId: string | null;
  readonly onSelectObject: (objectId: string) => void;
  readonly onHoverObject: (objectId: string | null) => void;
  readonly bold?: boolean;
}

function SpatialMapNode({
  object,
  selectedObjectId,
  hoveredObjectId,
  onSelectObject,
  onHoverObject,
  bold = false
}: SpatialMapNodeProps) {
  const statusMeta = getSpatialObjectStatusMeta(object.statusLevel);
  const isSelected = object.id === selectedObjectId;
  const isHovered = object.id === hoveredObjectId;

  return (
    <div className="spatial-map-node-wrap">
      <button
        aria-pressed={isSelected}
        className={
          bold
            ? `spatial-map-node spatial-map-node--container${isSelected ? " spatial-map-node--selected" : ""}`
            : `spatial-map-node${isSelected ? " spatial-map-node--selected" : ""}`
        }
        onBlur={() => onHoverObject(null)}
        onClick={() => onSelectObject(object.id)}
        onFocus={() => onHoverObject(object.id)}
        onMouseEnter={() => onHoverObject(object.id)}
        onMouseLeave={() => onHoverObject(null)}
        type="button"
      >
        <svg aria-hidden="true" className="spatial-map-node__dot" height={14} viewBox="0 0 14 14" width={14}>
          <circle cx={7} cy={7} fill={`var(${statusMeta.cssVariable})`} r={5} />
        </svg>
        <span className="spatial-map-node__label">{object.label}</span>
      </button>
      {isHovered ? (
        <div className="spatial-map-tooltip" role="tooltip">
          <p className="spatial-map-tooltip__title">{object.label}</p>
          <dl className="spatial-map-tooltip__facts">
            <div>
              <dt>Status</dt>
              <dd>
                {statusMeta.emoji} {statusMeta.label}
              </dd>
            </div>
            <div>
              <dt>Confiança</dt>
              <dd>{object.confidenceLabel}</dd>
            </div>
            <div>
              <dt>Última atualização</dt>
              <dd>{object.lastUpdated}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
