import { NextRequest, NextResponse } from "next/server";
import { capturePayPalPayment } from "@/lib/paypal";
import { init } from "@instantdb/admin";
import { getErrorMessage } from "@/lib/types";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;
const ADMIN_TOKEN = process.env.INSTANT_APP_ADMIN_TOKEN!;

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_TOKEN,
});

export async function POST(request: NextRequest) {
  try {
    const { orderId, userId, tier } = await request.json();
    if (!orderId || !userId) {
        return NextResponse.json({ error: "Missing orderId or userId" }, { status: 400 });
    }
    if (!tier || (tier !== "pro" && tier !== "pro_max")) {
      return NextResponse.json({ error: "Invalid tier. Must be 'pro' or 'pro_max'" }, { status: 400 });
    }

    console.log(`Capturing PayPal order ${orderId} for user ${userId}`);
    
    const result = await capturePayPalPayment(orderId);

    if (result.status === "COMPLETED") {
      const tierName = tier === "pro_max" ? "PRO MAX" : "PRO";
      console.log(`Payment successful, upgrading user to ${tierName}...`);
      
      // Update User Plan in DB with the specified tier
      await db.transact([
        db.tx.$users[userId].update({ planId: tier })
      ]);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Payment not completed" });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("PayPal Capture Error:", error);
    return NextResponse.json({ error: message || "Failed to capture payment" }, { status: 500 });
  }
}
