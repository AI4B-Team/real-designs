import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isProductSearchConfigured } from "@/lib/product-catalog";

export type IntegrationKey = "ai" | "listing" | "products" | "billing" | "email";

export interface IntegrationStatus {
  key: IntegrationKey;
  name: string;
  connected: boolean;
  note: string;
}

/**
 * Readiness of every external dependency, read from the live server
 * environment. Only presence is ever returned, never a value.
 */
export const readIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ owner: boolean; items: IntegrationStatus[] }> => {
    const has = (name: string) => {
      const v = process.env[name];
      return typeof v === "string" && v.trim().length > 0;
    };

    // A workspace owner is a signed-in account that has not joined someone
    // else's workspace through an accepted invite.
    const email = String((context.claims as Record<string, unknown>)["email"] ?? "").toLowerCase();
    let owner = true;
    if (email) {
      const { data } = await context.supabase
        .from("team_invites")
        .select("id")
        .eq("email", email)
        .eq("status", "accepted")
        .limit(1);
      owner = !(data && data.length > 0);
    }

    const items: IntegrationStatus[] = [
      {
        key: "ai",
        name: "AI Generation",
        connected: has("LOVABLE_API_KEY"),
        note: "Not Configured. Generation Will Fail.",
      },
      {
        key: "listing",
        name: "Listing Data",
        connected: has("LISTING_DATA_API_URL") && has("LISTING_DATA_API_KEY"),
        note: "Not Configured. Address Import Falls Back To Manual Upload.",
      },
      {
        key: "products",
        name: "Product Search",
        connected: isProductSearchConfigured(),
        note: "Sample Data Only. Prices And Availability Are Placeholders.",
      },
      {
        key: "billing",
        name: "Billing",
        connected: has("STRIPE_SECRET_KEY"),
        note: "Not Configured. No Checkout, No Plan Changes, No Top Ups.",
      },
      {
        key: "email",
        name: "Email",
        connected: has("RESEND_API_KEY"),
        note: "Not Configured. Share Links Must Be Copied And Sent Manually.",
      },
    ];

    return { owner, items };
  });
