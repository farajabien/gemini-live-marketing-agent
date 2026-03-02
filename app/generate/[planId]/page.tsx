import { PlanReviewScreen } from "@/components/screens/PlanReviewScreen";
import { GenerateScreenSkeleton } from "@/components/screens/GenerateScreenSkeleton";
import { adminDb } from "@/lib/firebase-admin";

export default async function GenerateWithPlanPage({ 
  params 
}: { 
  params: Promise<{ planId: string }> 
}) {
  const { planId } = await params;

  // Fetch the plan server-side
  try {
    const { videoPlans } = await adminDb.query({
      videoPlans: {
        $: {
          where: { id: planId }
        }
      }
    });

    const plan = videoPlans?.[0];

    if (!plan) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
              Plan Not Found
            </h1>
            <p className="text-slate-500">
              The video plan you're looking for doesn't exist or has been deleted.
            </p>
          </div>
        </div>
      );
    }

    return <PlanReviewScreen plan={plan as any} planId={planId} />;
  } catch (error) {
    console.error("Failed to load plan:", error);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Error Loading Plan
          </h1>
          <p className="text-slate-500">
            Failed to load the video plan. Please try again.
          </p>
        </div>
      </div>
    );
  }
}
