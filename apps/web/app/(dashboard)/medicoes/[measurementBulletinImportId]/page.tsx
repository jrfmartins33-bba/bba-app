import { MeasurementDecisionBriefPage } from "@/components/measurement/measurement-decision-brief-page";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.2 — substitui o
 * placeholder do 20.1E.1B. Server Component fino: só extrai o
 * parâmetro real da URL e delega ao Client Component que faz o fetch.
 * `params` síncrono -- mesmo contrato já confirmado por
 * `[measurementBulletinImportId]/decision-brief/route.ts` (Next.js
 * 14.2.23, `next build` real).
 */
export default function MedicaoDetailPage({
  params
}: {
  params: { measurementBulletinImportId: string };
}) {
  return <MeasurementDecisionBriefPage measurementBulletinImportId={params.measurementBulletinImportId} />;
}
