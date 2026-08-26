"use client";

import { useEffect, useState } from "react";
import type { DecisionBriefReadiness } from "@bba/bdos-core/decision-brief";
import { fetchMeasurementBulletinFormalStatus } from "./measurement-bulletin-formal-status-client";

/**
 * Ajuste de coerência visual pós-refinamento de materialidade --
 * Hero e Fluxo de Decisão (Como chegamos aqui) precisam concordar
 * entre si sobre quando promover a linguagem para "pronta para
 * certificação". Extraído para um hook único em vez de duas
 * implementações paralelas, para que os dois nunca possam divergir.
 *
 * O builder puro (sem I/O) nunca sabe se existe boletim formal --
 * esta é sempre uma segunda leitura, somente-leitura, feita na
 * fronteira do cliente, e só roda quando o Brief puro já diz
 * readiness="ready".
 */
export function useMeasurementCertificationReady(readiness: DecisionBriefReadiness, measurementBulletinImportId: string): boolean {
  const [certificationReady, setCertificationReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (readiness !== "ready") {
      setCertificationReady(false);
      return;
    }
    void fetchMeasurementBulletinFormalStatus(measurementBulletinImportId).then((outcome) => {
      if (!cancelled && outcome.kind === "ok") {
        setCertificationReady(outcome.formalStatus.status === "Finalized" && !outcome.formalStatus.certified);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [readiness, measurementBulletinImportId]);

  return certificationReady;
}

export const MEASUREMENT_CERTIFICATION_READY_LABEL = "Pronta para certificação";
