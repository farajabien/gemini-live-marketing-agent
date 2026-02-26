import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder } from "@/lib/paypal";
import { PRICING_TIERS } from "@/lib/pricing";
import { getErrorMessage } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { userId, tier } = await request.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    if (!tier || (tier !== "pro" && tier !== "pro_max")) {
      return NextResponse.json({ error: "Invalid tier. Must be 'pro' or 'pro_max'" }, { status: 400 });
    }

    // Get the price based on the tier
    const tierKey = tier === "pro_max" ? "PRO_MAX" : "PRO";
    const amount = PRICING_TIERS[tierKey].price;
    
    console.log(`Creating PayPal order for user ${userId} for ${tierKey} tier ($${amount})`);
    
    const { orderId } = await createPayPalOrder(amount, "USD", userId);

    return NextResponse.json({ orderId });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("PayPal Create Order Error:", error);
    return NextResponse.json({ error: message || "Failed to create order" }, { status: 500 });
  }
}
