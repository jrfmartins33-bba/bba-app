import { createHash } from "node:crypto";
import { PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_CANONICALIZATION_DECIMAL_PLACES } from "./physical-document-text-item-geometry-canonicalization";
import { PHYSICAL_DOCUMENT_GEOMETRY_CONTEXT_FINGERPRINT_VERSION } from "./physical-document-read.types";

/**
 * Entrada do fingerprint de contexto geométrico (Sprint 21.4A.2.f.0,
 * seção 19). Cada campo é um dos identificadores técnicos já presentes em
 * `PhysicalDocumentReadResult` — o fingerprint resume, nunca substitui,
 * esses campos individuais.
 */
export interface GeometryContextFingerprintInput {
  readonly sourceByteHash: string;
  readonly physicalReadSchemaVersion: number;
  readonly readerName: string;
  readonly readerVersion: string;
  readonly adapterVersion: string;
  readonly underlyingLibraryVersion: string | null;
  readonly coordinateSpaceVersion: string;
  readonly geometryProfileVersion: string;
}

/**
 * SHA-256, em hexadecimal, de uma representação canônica e inequívoca
 * (array JSON com ordem fixa — nunca concatenação ambígua sem
 * delimitação, nunca UUID, nunca timestamp) do contexto técnico completo
 * de repetibilidade geométrica. Determinístico: os mesmos valores de
 * entrada sempre produzem o mesmo fingerprint.
 *
 * A partir do schema v2, a versão concreta da biblioteca subjacente
 * (`underlyingLibraryVersion`) participa obrigatoriamente desta chave —
 * ver a nota histórica em `PhysicalDocumentReadResult.underlyingLibraryVersion`.
 */
export function computeGeometryContextFingerprint(input: GeometryContextFingerprintInput): string {
  const canonicalRepresentation: ReadonlyArray<string | number | null> = [
    PHYSICAL_DOCUMENT_GEOMETRY_CONTEXT_FINGERPRINT_VERSION,
    input.sourceByteHash,
    input.physicalReadSchemaVersion,
    input.readerName,
    input.readerVersion,
    input.adapterVersion,
    input.underlyingLibraryVersion,
    input.coordinateSpaceVersion,
    input.geometryProfileVersion,
    PHYSICAL_DOCUMENT_TEXT_ITEM_GEOMETRY_CANONICALIZATION_DECIMAL_PLACES,
  ];

  return createHash("sha256").update(JSON.stringify(canonicalRepresentation)).digest("hex");
}
