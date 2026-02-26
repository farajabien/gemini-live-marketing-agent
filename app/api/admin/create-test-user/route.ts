import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";
import { getErrorMessage } from "@/lib/types";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;
const ADMIN_TOKEN = process.env.INSTANT_APP_ADMIN_TOKEN!;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "change-this-in-production";

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_TOKEN,
});

/**
 * Admin endpoint to create test users with specific plan tiers
 * 
 * Usage:
 * POST /api/admin/create-test-user
 * Headers: { "x-admin-secret": "your-secret" }
 * Body: { 
 *   email: "test@example.com", 
 *   planId: "pro_max",
 *   displayName: "Test User" 
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin secret
    const secret = request.headers.get("x-admin-secret");
    if (secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, planId, displayName } = await request.json();
    
    // Validate inputs
    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }
    
    const validPlanIds = ["free", "pro", "pro_max"];
    if (planId && !validPlanIds.includes(planId)) {
      return NextResponse.json({ 
        error: `Invalid planId. Must be one of: ${validPlanIds.join(", ")}` 
      }, { status: 400 });
    }

    // Check if user already exists
    const existingUsers = await db.query({
      $users: {
        $: {
          where: { email }
        }
      }
    });

    if (existingUsers.$users && existingUsers.$users.length > 0) {
      const existingUser = existingUsers.$users[0];
      
      // Update existing user's plan if specified
      if (planId) {
        await db.transact([
          db.tx.$users[existingUser.id].update({ planId })
        ]);
        
        return NextResponse.json({ 
          message: "Updated existing user",
          userId: existingUser.id,
          email: existingUser.email,
          planId: planId
        });
      }
      
      return NextResponse.json({ 
        message: "User already exists",
        userId: existingUser.id,
        email: existingUser.email,
        planId: existingUser.planId || "free"
      });
    }

    // Create new user
    // Note: InstantDB creates users via client SDK normally
    // For test purposes, we'll create a user record directly
    const userId = crypto.randomUUID();
    
    await db.transact([
      db.tx.$users[userId].update({
        email,
        displayName: displayName || email.split("@")[0],
        planId: planId || "free",
        createdAt: Date.now()
      })
    ]);

    console.log(`Created test user: ${email} with planId: ${planId || "free"}`);

    return NextResponse.json({ 
      message: "Test user created successfully",
      userId,
      email,
      planId: planId || "free"
    });
    
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Create Test User Error:", error);
    return NextResponse.json({ 
      error: message || "Failed to create test user" 
    }, { status: 500 });
  }
}

/**
 * List all users (admin only)
 * 
 * Usage:
 * GET /api/admin/create-test-user
 * Headers: { "x-admin-secret": "your-secret" }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin secret
    const secret = request.headers.get("x-admin-secret");
    if (secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await db.query({
      $users: {}
    });

    return NextResponse.json({ 
      users: users.$users || [],
      count: users.$users?.length || 0
    });
    
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("List Users Error:", error);
    return NextResponse.json({ 
      error: message || "Failed to list users" 
    }, { status: 500 });
  }
}
