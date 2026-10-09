import { db } from "./db";

/** Promoter pelo link secreto. Só vale se o promoter estiver ativo e a casa aprovada. */
export async function promoterByToken(token: string) {
  if (!token || token.length < 16) return null;
  const adv = await db.advertiser.findUnique({ where: { accessToken: token }, include: { producer: true } });
  if (!adv || !adv.active || adv.producer.status !== "APPROVED") return null;
  return adv;
}
