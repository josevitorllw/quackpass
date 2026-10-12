"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Plan, ProducerStatus } from "@prisma/client";
import type { ActionState } from "@/components/ActionForm";
import { createSession, destroySession, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { safely, sendProducerApprovedEmail } from "@/lib/email";
import { cancelEvent, refundOrder, RefundError } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { markSplash } from "@/lib/splash";

export async function adminLogin(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ip = clientIp(new Request("http://x", { headers: headers() }));
  if (!rateLimit(`admin-login:${ip}`, 5, 5 * 60_000)) return { error: "Muitas tentativas. Aguarde alguns minutos." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const admin = await db.adminUser.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(String(form.get("password") ?? ""), admin.passwordHash))) return { error: "E-mail ou senha incorretos" };
  await createSession("admin", admin.id);
  markSplash();
  redirect("/admin");
}

export async function adminLogout() {
  destroySession("admin");
  redirect("/admin/entrar");
}

export async function setProducerStatus(producerId: string, status: ProducerStatus) {
  await requireAdmin();
  const before = await db.producer.findUnique({ where: { id: producerId } });
  if (!before) return;
  const producer = await db.producer.update({ where: { id: producerId }, data: { status, reviewedAt: new Date() } });
  if (status === "BLOCKED") {
    // Bloqueado: tira os eventos do ar (as vendas param; quem já comprou continua com o ingresso)
    await db.event.updateMany({ where: { producerId, status: "PUBLISHED" }, data: { status: "DRAFT" } });
    await db.staffMember.updateMany({ where: { producerId }, data: { active: false } });
  }
  if (status === "APPROVED" && before.status !== "APPROVED") {
    await safely(() => sendProducerApprovedEmail(producer), `aprovado ${producerId}`);
  }
  revalidatePath("/admin", "layout");
}

export async function saveProducerNotes(producerId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  await db.producer.update({ where: { id: producerId }, data: { adminNotes: String(form.get("notes") ?? "").slice(0, 5000) } });
  return { ok: "Anotações salvas" };
}

export async function adminCancelEvent(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "CANCELAR") return { error: "Digite CANCELAR para confirmar" };
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || event.status === "CANCELLED") return { error: "Evento não encontrado ou já cancelado" };
  const r = await cancelEvent(eventId, String(form.get("reason") ?? "").trim().slice(0, 300));
  revalidatePath(`/evento/${event.slug}`);
  revalidatePath("/admin", "layout");
  return { ok: `Evento cancelado. ${r.refunded} reembolsado(s)${r.remaining ? `, ${r.remaining} em andamento` : ""}.` };
}

export async function adminUnpublishEvent(eventId: string) {
  await requireAdmin();
  const event = await db.event.update({ where: { id: eventId }, data: { status: "DRAFT" } });
  revalidatePath(`/evento/${event.slug}`);
  revalidatePath("/admin", "layout");
}

export async function adminRefundOrder(orderId: string, _prev: ActionState): Promise<ActionState> {
  await requireAdmin();
  try {
    await refundOrder(orderId, "ADMIN");
  } catch (err) {
    return { error: err instanceof RefundError ? err.message : "Erro ao reembolsar" };
  }
  revalidatePath("/admin/pedidos");
  return { ok: "Reembolsado" };
}

/** Plano da casa: plano contratado, demonstração Pro, ajustes de limites e taxa especial. */
export async function setProducerPlan(producerId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const plan = String(form.get("plan") ?? "FREE") as Plan;
  if (!["FREE", "PLUS", "PRO"].includes(plan)) return { error: "Plano inválido" };

  // Limites: vazio = padrão do plano; 0 = ilimitado
  const limit = (k: string): number | null | "erro" => {
    const v = String(form.get(k) ?? "").trim();
    if (v === "") return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : "erro";
  };
  const limitStaff = limit("limitStaff");
  const limitPromoters = limit("limitPromoters");
  const limitListNames = limit("limitListNames");
  if ([limitStaff, limitPromoters, limitListNames].includes("erro")) return { error: "Limites devem ser números inteiros (0 = ilimitado)" };

  // Taxa especial em %: vazio = taxa padrão da plataforma
  const feeRaw = String(form.get("feePercent") ?? "").trim().replace(",", ".");
  const feeBps = feeRaw === "" ? null : Math.round(Number(feeRaw) * 100);
  if (feeBps != null && (!Number.isFinite(feeBps) || feeBps < 0 || feeBps > 3000)) return { error: "Taxa inválida (entre 0 e 30%)" };

  // Demonstração Pro: N dias a partir de agora, ou encerrar
  const trialDays = Number(String(form.get("trialDays") ?? "").trim() || 0);
  const endTrial = form.get("endTrial") === "on";
  const current = await db.producer.findUniqueOrThrow({ where: { id: producerId }, select: { proTrialUntil: true } });
  const proTrialUntil = endTrial ? null : trialDays > 0 ? new Date(Date.now() + Math.min(trialDays, 365) * 86_400_000) : current.proTrialUntil;

  await db.producer.update({
    where: { id: producerId },
    data: {
      plan,
      proTrialUntil,
      limitStaff: limitStaff as number | null,
      limitPromoters: limitPromoters as number | null,
      limitListNames: limitListNames as number | null,
      feeBps,
    },
  });
  revalidatePath("/admin", "layout");
  return { ok: "Plano salvo. Vale na hora para a casa." };
}
