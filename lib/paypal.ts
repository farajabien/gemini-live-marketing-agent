import paypal from "@paypal/checkout-server-sdk";

/**
 * PayPal Environment Setup
 */
function getPayPalEnvironment() {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
  const mode = process.env.PAYPAL_MODE || "sandbox";

  if (!clientId || !clientSecret) {
    // We don't throw here to prevent build crashes, but we log
    console.warn("PayPal credentials not configured. Integration will be disabled.");
    return null;
  }

  return mode === "live"
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);
}

const environment = getPayPalEnvironment();
export const paypalClient = environment ? new paypal.core.PayPalHttpClient(environment) : null;

/**
 * Helper to create an order
 */
export async function createPayPalOrder(amount: number, currency: string = "USD", referenceId?: string, description?: string) {
  if (!paypalClient) throw new Error("PayPal client not initialized");

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");

  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: referenceId,
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
        },
        description: description || "IdeaToVideo Pro Upgrade - 20 Videos / Month",
      },
    ],
    application_context: {
      user_action: "PAY_NOW",
      brand_name: "IdeaToVideo",
      shipping_preference: "NO_SHIPPING"
    },
  });

  const response = await paypalClient.execute(request);
  return {
    orderId: response.result.id,
    links: response.result.links,
  };
}

/**
 * Helper to capture payment
 */
export async function capturePayPalPayment(orderId: string) {
  if (!paypalClient) throw new Error("PayPal client not initialized");

  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  // @ts-ignore - SDK type fix
  request.requestBody({});

  const response = await paypalClient.execute(request);
  const captureData = response.result.purchase_units[0].payments.captures[0];
  
  return {
    captureId: captureData.id,
    status: response.result.status, // "COMPLETED"
    payer: response.result.payer,
  };
}
