import { NarrativeOverviewScreen } from "@/components/narrative/NarrativeOverviewScreen";

interface NarrativePageProps {
  params: Promise<{ id: string }>;
}

export default async function NarrativeOverviewPage({ params }: NarrativePageProps) {
  const { id } = await params;
  return <NarrativeOverviewScreen narrativeId={id} />;
}
