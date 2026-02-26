import { NarrativeDraftsScreen } from "@/components/narrative/NarrativeDraftsScreen";
import { Suspense } from "react";

export const maxDuration = 60; // Allow AI generation to run longer than 15s

interface NarrativePageProps {
  params: Promise<{ id: string }>;
}

export default async function NarrativeDraftsPage({ params }: NarrativePageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <NarrativeDraftsScreen narrativeId={id} />
    </Suspense>
  );
}
