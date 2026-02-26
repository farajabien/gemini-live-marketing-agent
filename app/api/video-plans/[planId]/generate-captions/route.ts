import { adminDb } from "@/lib/instant-admin";
import { generateSocialMetadata } from "@/lib/marketing/social-gen";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;

  try {
    // 1. Fetch the plan
    const { videoPlans } = await adminDb.query({
      videoPlans: { $: { where: { id: planId } } }
    });

    const plan = videoPlans?.[0];
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // 2. Generate social metadata
    const socialMetadata = await generateSocialMetadata(plan as any);

    // 3. Update DB
    await adminDb.transact([
      adminDb.tx.videoPlans[planId].update({
        socialMetadata
      })
    ]);

    return NextResponse.json({ success: true, socialMetadata });
  } catch (error: any) {
    console.error("Caption generation failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
