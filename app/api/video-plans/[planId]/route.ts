import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";



/**
 * GET /api/video-plans/[planId]
 * Fetch a specific video plan by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing or invalid token" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    // Verify the token with InstantDB
    const authUser = await adminDb.auth.verifyToken(token);
    if (!authUser || !authUser.id) {
      return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
    }

    const userId = authUser.id;

    // Fetch the plan and check ownership
    const result = await adminDb.query({
      videoPlans: {
        $: {
          where: {
            id: planId,
          },
        },
        owner: {},
      },
    });

    if (!result.videoPlans || result.videoPlans.length === 0) {
      return NextResponse.json(
        { error: "Video plan not found" },
        { status: 404 }
      );
    }

    const plan = result.videoPlans[0];

    // Security check: ensure the authenticated user owns this plan
    const planOwnerId = plan.owner?.[0]?.id;
    if (planOwnerId !== userId) {
      return NextResponse.json({ error: "Forbidden: You do not own this plan" }, { status: 403 });
    }

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Error fetching video plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch video plan" },
      { status: 500 }
    );
  }
}
