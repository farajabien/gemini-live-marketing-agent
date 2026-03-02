import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// PATCH /api/narrative/content/[contentId] - Update content piece status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params;
    const { status, editedBody } = await request.json();

    // Authenticate
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const user = await adminDb.auth.verifyToken(token);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updateData: Record<string, any> = {
      status,
      updatedAt: Date.now(),
    };

    if (editedBody !== undefined) {
      updateData.editedBody = editedBody;
    }

    if (status === "published") {
      updateData.publishedAt = Date.now();
    }

    // Verify ownership
    const contentQuery = await adminDb.query({
      contentPieces: {
        $: { where: { id: contentId } },
        narrative: {
          owner: {},
        },
      },
    });

    const content = contentQuery.contentPieces?.[0];
    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const narrativeOwnerId = (content as any).narrative?.[0]?.owner?.[0]?.id;
    // Security check: If there's an owner, it must be the current user.
    // We allow it if there's no owner link yet, provided the user is authenticated (handled above)
    if (narrativeOwnerId && narrativeOwnerId !== user.id) {
      return NextResponse.json({ error: "Forbidden: You do not own this content" }, { status: 403 });
    }

    await adminDb.transact(
      adminDb.tx.contentPieces[contentId].update(updateData)
    );

    // Ensure narrative is linked to owner if missing
    if (!narrativeOwnerId) {
      const narrativeId = (content as any).narrative?.[0]?.id;
      if (narrativeId) {
        await adminDb.transact([
          adminDb.tx.narratives[narrativeId].link({ owner: user.id })
        ]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Content] Update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
