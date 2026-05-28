export type PlanLimits = {
  tier: string;
  maxFunnels: number; // Infinity = ilimitado
  maxLeadsPerMonth: number;
};

const TIERS: Record<string, PlanLimits> = {
  starter: { tier: "starter", maxFunnels: 1, maxLeadsPerMonth: 400 },
  pro: { tier: "pro", maxFunnels: 10, maxLeadsPerMonth: 2000 },
  agency: { tier: "agency", maxFunnels: Number.POSITIVE_INFINITY, maxLeadsPerMonth: 20000 },
};

export const FREE_LIMITS: PlanLimits = { tier: "free", maxFunnels: 0, maxLeadsPerMonth: 0 };

export function getPlanLimits(priceId: string | null | undefined): PlanLimits {
  if (!priceId) return FREE_LIMITS;
  const tier = String(priceId).split("_")[0].toLowerCase();
  return TIERS[tier] ?? FREE_LIMITS;
}

export function formatLimit(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString("pt-BR") : "ilimitado";
}