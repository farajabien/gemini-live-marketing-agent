import { NarrativeEngineScreen } from "@/components/narrative/NarrativeEngineScreen";

interface NarrativePageProps {
  params: Promise<{ id: string }>;
}

export default async function NarrativeEnginePage({ params }: NarrativePageProps) {
  const { id } = await params;
  return <NarrativeEngineScreen narrativeId={id} />;
}
