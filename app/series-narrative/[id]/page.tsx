import { SeriesNarrativeOverviewScreen } from "@/components/screens/SeriesNarrativeOverviewScreen";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SeriesNarrativeOverviewPage({ params }: Props) {
  const { id } = await params;
  return <SeriesNarrativeOverviewScreen narrativeId={id} />;
}
