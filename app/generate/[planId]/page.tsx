import { GenerateScreen } from "@/components/screens/GenerateScreen";

export default async function GenerateWithPlanPage({ 
  params 
}: { 
  params: Promise<{ planId: string }> 
}) {
  const { planId } = await params;

  return <GenerateScreen initialPlanId={planId} />;
}
