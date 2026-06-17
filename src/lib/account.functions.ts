import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

type DeleteAccountResult = { ok: true } | { error: string };

const ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeleteAccountResult> => {
    const userId = context.userId;

    try {
      const { data: subscriptions, error: subError } = await supabaseAdmin
        .from("subscriptions")
        .select("stripe_subscription_id, environment, status")
        .eq("user_id", userId);

      if (subError) return { error: subError.message };

      for (const subscription of subscriptions ?? []) {
        if (!subscription.stripe_subscription_id || !ACTIVE_STRIPE_STATUSES.has(subscription.status)) continue;
        const stripe = createStripeClient(subscription.environment as StripeEnv);
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) return { error: error.message };

      return { ok: true };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
