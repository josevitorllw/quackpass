"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProducerStatus } from "@prisma/client";
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
