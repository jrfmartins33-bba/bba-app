import { MeasurementManagerialControlPage } from "@/components/measurement/measurement-managerial-control-page";

export default function MedicaoControleGerencialPage({ params }: { params: { measurementBulletinImportId: string } }) {
  return <MeasurementManagerialControlPage measurementBulletinImportId={params.measurementBulletinImportId} />;
}
