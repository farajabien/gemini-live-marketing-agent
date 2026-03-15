import { NarrativeDraftsScreen } from "@/components/narrative/NarrativeDraftsScreen";

interface DraftsPageProps {
  params: Promise<{ id: string }>;
}

export default async function DraftsPage({ params }: DraftsPageProps) {
  const { id } = await params;
  return <NarrativeDraftsScreen narrativeId={id} />;
}
