import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export type AdminCustomerRow = {
  user_id: string;
  email: string | null;
  name: string | null;
  clinic_name: string | null;
  phone: string | null;
  instagram_url: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  plan: string | null;
  funnels_count: number;
  leads_count: number;
  subscription: {
    id: string;
    status: string;
    price_id: string | null;
    product_id: string | null;
    environment: string;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    customer_email: string | null;
    created_at: string | null;
  } | null;
};

const ADMIN_CUSTOMERS_LIMIT = 200;

export const listAdminCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ customers: AdminCustomerRow[] }> => {
    await ensureAdmin(context.userId);

    // 1. Most recent N profiles (bounded to avoid loading the whole table).
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, name, clinic_name, instagram_url, plan, created_at")
      .order("created_at", { ascending: false })
      .limit(ADMIN_CUSTOMERS_LIMIT);
    if (profErr) throw new Error(profErr.message);

    const profileIds = (profiles ?? []).map((p) => p.id);

    // 2. Auth metadata for ONLY the profiles we need (parallel, bounded concurrency).
    const authUsers = new Map<
      string,
      { email: string | null; last_sign_in_at: string | null; phone: string | null }
    >();
    const CHUNK = 20;
    for (let i = 0; i < profileIds.length; i += CHUNK) {
      const slice = profileIds.slice(i, i + CHUNK);
      await Promise.all(
        slice.map(async (id) => {
          try {
            const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
            if (error || !data?.user) return;
            authUsers.set(id, {
              email: data.user.email ?? null,
              last_sign_in_at: data.user.last_sign_in_at ?? null,
              phone: (data.user.phone as string | undefined) ?? null,
            });
          } catch {
            // ignore per-user lookup failures, profile still renders
          }
        }),
      );
    }

    // 3. Subscriptions for the visible profiles only.
    const { data: subs, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .select("id, user_id, status, price_id, product_id, environment, current_period_start, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, customer_email, created_at")
      .in("user_id", profileIds.length ? profileIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });
    if (subErr) throw new Error(subErr.message);
    const subByUser = new Map<string, NonNullable<AdminCustomerRow["subscription"]>>();
    for (const s of subs ?? []) {
      if (!s.user_id) continue;
      if (!subByUser.has(s.user_id)) {
        subByUser.set(s.user_id, {
          id: s.id,
          status: s.status,
          price_id: s.price_id ?? null,
          product_id: s.product_id ?? null,
          environment: s.environment,
          current_period_start: s.current_period_start ?? null,
          current_period_end: s.current_period_end ?? null,
          cancel_at_period_end: s.cancel_at_period_end ?? null,
          stripe_customer_id: s.stripe_customer_id ?? null,
          stripe_subscription_id: s.stripe_subscription_id ?? null,
          customer_email: s.customer_email ?? null,
          created_at: s.created_at ?? null,
        });
      }
    }

    // 4. Funnels (only for visible owners)
    const { data: funnels, error: funErr } = await supabaseAdmin
      .from("funnels")
      .select("id, owner_id")
      .in("owner_id", profileIds.length ? profileIds : ["00000000-0000-0000-0000-000000000000"]);
    if (funErr) throw new Error(funErr.message);
    const funnelsCount = new Map<string, number>();
    const funnelIdsByOwner = new Map<string, string[]>();
    for (const f of funnels ?? []) {
      funnelsCount.set(f.owner_id, (funnelsCount.get(f.owner_id) ?? 0) + 1);
      const arr = funnelIdsByOwner.get(f.owner_id) ?? [];
      arr.push(f.id);
      funnelIdsByOwner.set(f.owner_id, arr);
    }

    // 5. Leads (only for funnels of visible owners)
    const allFunnelIds = Array.from(new Set(Array.from(funnelIdsByOwner.values()).flat()));
    const leadsByFunnel = new Map<string, number>();
    if (allFunnelIds.length) {
      const { data: leads, error: leadErr } = await supabaseAdmin
        .from("leads")
        .select("funnel_id")
        .in("funnel_id", allFunnelIds);
      if (leadErr) throw new Error(leadErr.message);
      for (const l of leads ?? []) {
        leadsByFunnel.set(l.funnel_id, (leadsByFunnel.get(l.funnel_id) ?? 0) + 1);
      }
    }
    const leadsByOwner = new Map<string, number>();
    for (const [ownerId, ids] of funnelIdsByOwner.entries()) {
      let total = 0;
      for (const fid of ids) total += leadsByFunnel.get(fid) ?? 0;
      leadsByOwner.set(ownerId, total);
    }

    // 6. Lookup phone from leads when not in auth (best-effort)
    const customers: AdminCustomerRow[] = (profiles ?? []).map((p) => {
      const au = authUsers.get(p.id);
      return {
        user_id: p.id,
        email: au?.email ?? null,
        name: p.name,
        clinic_name: p.clinic_name,
        phone: au?.phone ?? null,
        instagram_url: p.instagram_url,
        created_at: p.created_at,
        last_sign_in_at: au?.last_sign_in_at ?? null,
        plan: p.plan,
        funnels_count: funnelsCount.get(p.id) ?? 0,
        leads_count: leadsByOwner.get(p.id) ?? 0,
        subscription: subByUser.get(p.id) ?? null,
      };
    });

    return { customers };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean }> => {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });