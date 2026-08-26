import { MeasurementReviewPage } from "@/components/measurement/measurement-review-page";

export default function MedicaoRevisarPage({ params }: { params: { measurementBulletinImportId: string } }) {
  return <MeasurementReviewPage measurementBulletinImportId={params.measurementBulletinImportId} />;
}
