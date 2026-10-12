import type { Plan, Producer } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";

/**
 * Limites de cada plano. null = ilimitado.
 * O dono da plataforma pode ajustar qualquer limite por casa (Producer.limit*) no painel de admin.
 */
export const PLAN_LIMITS: Record<Plan, { staff: number | null; promoters: number | null; listNames: number | null }> = {
  FREE: { staff: 2, promoters: 3, listNames: 200 },
  PLUS: { staff: 5, promoters: 10, listNames: 1000 },
  PRO: { staff: null, promoters: null, listNames: null },
};

export const PLAN_LABEL: Record<Plan, string> = { FREE: "Grátis", PLUS: "Plus", PRO: "Pro" };

export type LimitKey = keyof (typeof PLAN_LIMITS)["FREE"];

export const LIMIT_LABEL: Record<LimitKey, string> = {
  staff: "logins de portaria",
  promoters: "promoters / anunciantes ativos",
  listNames: "nomes na lista por evento",
};

type PlanFields = Pick<Producer, "plan" | "proTrialUntil" | "limitStaff" | "limitPromoters" | "limitListNames" | "feeBps">;

/** Plano em vigor: Pro durante a demonstração liberada, senão o plano contratado. */
export function effectivePlan(p: PlanFields, now = new Date()): Plan {
  return p.proTrialUntil && p.proTrialUntil > now ? "PRO" : p.plan;
}

export function isTrialActive(p: PlanFields, now = new Date()) {
  return !!p.proTrialUntil && p.proTrialUntil > now;
}

/** Limites em vigor: ajuste da casa (0 = ilimitado) ou o padrão do plano. Na demonstração Pro, tudo ilimitado. */
export function limitsFor(p: PlanFields, now = new Date()): Record<LimitKey, number | null> {
  if (isTrialActive(p, now)) return { ...PLAN_LIMITS.PRO };
  const base = PLAN_LIMITS[p.plan];
  const pick = (override: number | null, def: number | null) => (override == null ? def : override === 0 ? null : override);
  return {
    staff: pick(p.limitStaff, base.staff),
    promoters: pick(p.limitPromoters, base.promoters),
    listNames: pick(p.limitListNames, base.listNames),
  };
}

/** Taxa da plataforma desta casa, em %. */
export function feePercentFor(p: Pick<Producer, "feeBps"> | null | undefined): number {
  return p?.feeBps != null ? p.feeBps / 100 : env.platformFeePercent;
}

export class PlanLimitError extends Error {
  constructor(
    public key: LimitKey,
    public limit: number,
  ) {
    super(`Seu plano permite até ${limit} ${LIMIT_LABEL[key]}. Para liberar mais, conheça o plano Pro em "Meu plano".`);
  }
}

/** Lança PlanLimitError se adicionar `adding` itens passaria do limite. */
export function assertWithinLimit(limits: Record<LimitKey, number | null>, key: LimitKey, current: number, adding = 1) {
  const limit = limits[key];
  if (limit != null && current + adding > limit) throw new PlanLimitError(key, limit);
}

/** Uso atual da casa (para o painel do produtor e do admin). */
export async function planUsage(producerId: string) {
  const [staff, promoters, biggestList] = await Promise.all([
    db.staffMember.count({ where: { producerId, active: true } }),
    db.advertiser.count({ where: { producerId, active: true } }),
    db.guestListEntry.groupBy({
      by: ["eventId"],
      where: { event: { producerId, startsAt: { gte: new Date(Date.now() - 24 * 3_600_000) } } },
      _count: true,
      orderBy: { _count: { eventId: "desc" } },
      take: 1,
    }),
  ]);
  return { staff, promoters, listNames: biggestList[0]?._count ?? 0 };
}
