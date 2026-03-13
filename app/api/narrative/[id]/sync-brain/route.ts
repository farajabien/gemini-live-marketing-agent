import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { evolveNarrative, NarrativeInput } from "@/lib/marketing/narrative-intelligence";

/**
 * POST /api/narrative/[id]/sync-brain
 * Distills conversation insights into the core brand narrative.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { insight } = await request.json();

    if (!insight) {
      return NextResponse.json({ error: "Missing insight" }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await adminDb.auth.verifyToken(token);
    if (!decodedToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 1. Fetch current narrative
    const query = {
      narratives: {
        $: { where: { id } }
      }
    };
    const results = await adminDb.query(query);
    const narrative = results.narratives?.[0];

    if (!narrative) {
      return NextResponse.json({ error: "Narrative not found" }, { status: 404 });
    }

    // Check ownership
    const narrativeUserId = narrative.userId || (narrative as any).owner;
    if (narrativeUserId !== decodedToken.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Prepare current input for evolution
    const currentInput: NarrativeInput = {
      audience: narrative.audience || "",
      currentState: narrative.currentState || "",
      problem: narrative.problem || "",
      costOfInaction: narrative.costOfInaction || "",
      solution: narrative.solution || "",
      afterState: narrative.afterState || "",
      identityShift: narrative.identityShift || "",
      voice: narrative.voice || "calm",
    };

    // 3. Evolve narrative via AI
    const evolved = await evolveNarrative(currentInput, insight);

    // 4. Update Firestore with new strategic foundation
    await adminDb.transact({
      collection: "narratives",
      id,
      action: "update",
      data: {
        ...evolved,
        updatedAt: Date.now(),
      }
    });

    console.log(`[Sync Brain] Successfully evolved narrative ${id} with insight: "${insight.substring(0, 50)}..."`);

    return NextResponse.json({ success: true, evolved });
  } catch (error: any) {
    console.error("[Sync Brain] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
