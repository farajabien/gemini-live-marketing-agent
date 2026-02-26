import { SeriesDetailScreen } from "@/components/screens/SeriesDetailScreen";

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SeriesDetailScreen seriesId={id} />;
}
