"use server";

import { customAlphabet } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/ActionForm";
import { requireOwnedEvent, requireProducer } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { contentSchema, ACCENT_COLORS } from "@/lib/content";
import { onlyDigits, parseLocalDateTime, parseMoney, slugify } from "@/lib/format";
import { sendTicketsEmail } from "@/lib/email";
import { cancelEvent, refundOrder, RefundError } from "@/lib/orders";
import { addNames, ListError, newAccessToken, newPublicCode } from "@/lib/guestlist";
import { listResultMessage } from "@/lib/list-messages";
import bcrypt from "bcryptjs";
import { createPagarmeRecipient } from "@/lib/payments/pagarme";

const suffix = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 5);

const eventSchema = z.object({
  title: z.string().trim().min(3, "Informe o nome do evento").max(140),
  description: z.string().trim().max(5000).default(""),
  venueName: z.string().trim().min(2, "Informe o local").max(120),
  address: z.string().trim().min(3, "Informe o endereço").max(200),
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  state: z.string().trim().length(2, "UF com 2 letras").transform((s) => s.toUpperCase()),
  startsAt: z.string().transform((s, ctx) => {
    const d = parseLocalDateTime(s);
    if (!d) ctx.addIssue({ code: "custom", message: "Data de início inválida" });
    return d!;
  }),
  endsAt: z.string().optional().transform((s) => (s ? parseLocalDateTime(s) : null)),
  bannerUrl: z
    .string()
    .trim()
    .refine((u) => u === "" || u.startsWith("/api/uploads/") || /^https:\/\//.test(u), "Imagem de capa inválida")
    .optional(),
  feePayer: z.enum(["BUYER", "PRODUCER"]),
  accentColor: z.string().refine((c) => ACCENT_COLORS.some((a) => a.value === c), "Cor inválida"),
  showMap: z.string().optional(),
  content: z.string().transform((s, ctx) => {
    try {
      const parsed = contentSchema.safeParse(JSON.parse(s || "[]"));
      if (parsed.success) return parsed.data;
      ctx.addIssue({ code: "custom", message: `Conteúdo da página: ${parsed.error.issues[0].message}` });
    } catch {
      ctx.addIssue({ code: "custom", message: "Conteúdo da página inválido" });
    }
    return z.NEVER;
  }),
  contactPhone: z.string().trim().max(30).optional(),
  contactEmail: z.string().trim().email("E-mail de contato inválido").or(z.literal("")).optional(),
  contactInstagram: z.string().trim().max(60).optional(),
  refundMode: z.enum(["SELF_SERVICE", "PRODUCER"]),
  refundDeadlineHours: z.coerce.number().int().min(0, "Prazo inválido").max(24 * 90),
});

function parseEvent(form: FormData) {
  const parsed = eventSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const d = parsed.data;
  return {
    data: {
      title: d.title,
      description: d.description,
      venueName: d.venueName,
      address: d.address,
      city: d.city,
      state: d.state,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      bannerUrl: d.bannerUrl || null,
      feePayer: d.feePayer,
      accentColor: d.accentColor,
      showMap: d.showMap === "on",
      content: d.content,
      contactPhone: d.contactPhone || null,
      contactEmail: d.contactEmail || null,
      contactInstagram: d.contactInstagram?.replace(/^@/, "") || null,
      refundMode: d.refundMode,
      refundDeadlineHours: d.refundDeadlineHours,
    },
  } as const;
}

export async function createEvent(_prev: ActionState, form: FormData): Promise<ActionState> {
  const producer = await requireProducer();
  const parsed = parseEvent(form);
  if ("error" in parsed) return { error: parsed.error };
  const event = await db.event.create({
    data: { ...parsed.data, producerId: producer.id, slug: `${slugify(parsed.data.title) || "evento"}-${suffix()}` },
  });
  redirect(`/painel/eventos/${event.id}/ingressos`);
}

export async function updateEvent(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { event } = await requireOwnedEvent(eventId);
  const parsed = parseEvent(form);
  if ("error" in parsed) return { error: parsed.error };
  await db.event.update({ where: { id: event.id }, data: parsed.data });
  revalidatePath(`/evento/${event.slug}`);
  revalidatePath(`/painel/eventos/${event.id}`, "layout");
  return { ok: "Evento salvo. As mudanças já aparecem na página pública." };
}

export async function setEventStatus(eventId: string, status: "DRAFT" | "PUBLISHED") {
  const { event, producer } = await requireOwnedEvent(eventId);
  if (event.status === "CANCELLED") return;
  if (status === "PUBLISHED") {
    const hasBatch = await db.batch.count({ where: { ticketType: { eventId: event.id }, active: true } });
    if (!hasBatch) redirect(`/painel/eventos/${event.id}/ingressos?erro=sem-lote`);
    if (env.paymentProvider === "pagarme" && !producer.recipientId) {
      const hasPaid = await db.batch.count({ where: { ticketType: { eventId: event.id }, priceCents: { gt: 0 } } });
      if (hasPaid) redirect(`/painel/conta?erro=sem-recebedor`);
    }
  }
  await db.event.update({ where: { id: event.id }, data: { status } });
  revalidatePath(`/evento/${event.slug}`);
  revalidatePath("/");
  revalidatePath(`/painel/eventos/${event.id}`);
}

// ---------- Tipos de ingresso e lotes ----------

export async function createTicketType(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  await requireOwnedEvent(eventId);
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Informe o nome (ex.: Pista, VIP, Camarote)" };
  const count = await db.ticketType.count({ where: { eventId } });
  await db.ticketType.create({
    data: { eventId, name, description: String(form.get("description") ?? "").trim(), sortOrder: count },
  });
  revalidatePath(`/painel/eventos/${eventId}/ingressos`);
  return { ok: `${name} criado. Agora adicione os lotes.` };
}

const batchSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do lote").max(60),
  price: z.string().transform((s, ctx) => {
    const v = parseMoney(s || "0");
    if (!Number.isFinite(v) || v < 0) ctx.addIssue({ code: "custom", message: "Preço inválido" });
    return v;
  }),
  quantity: z.coerce.number().int().min(1, "Quantidade mínima 1").max(1_000_000),
  maxPerOrder: z.coerce.number().int().min(1).max(50).default(10),
  salesStart: z.string().optional().transform((s) => (s ? parseLocalDateTime(s) : null)),
  salesEnd: z.string().optional().transform((s) => (s ? parseLocalDateTime(s) : null)),
});

export async function createBatch(eventId: string, ticketTypeId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  await requireOwnedEvent(eventId);
  const type = await db.ticketType.findFirst({ where: { id: ticketTypeId, eventId } });
  if (!type) return { error: "Tipo de ingresso não encontrado" };
  const parsed = batchSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.price > 0 && d.price < 100) return { error: "Preço mínimo de R$ 1,00 (ou 0 para gratuito)" };
  const count = await db.batch.count({ where: { ticketTypeId } });
  await db.batch.create({
    data: {
      ticketTypeId,
      name: d.name,
      priceCents: d.price,
      quantity: d.quantity,
      maxPerOrder: d.maxPerOrder,
      salesStart: d.salesStart,
      salesEnd: d.salesEnd,
      sortOrder: count,
    },
  });
  revalidatePath(`/painel/eventos/${eventId}/ingressos`);
  return { ok: "Lote criado" };
}

export async function updateBatchQuantity(eventId: string, batchId: string, form: FormData) {
  await requireOwnedEvent(eventId);
  const quantity = Number(form.get("quantity"));
  const batch = await db.batch.findFirst({ where: { id: batchId, ticketType: { eventId } } });
  // Nunca abaixo do que já foi vendido/reservado
  if (batch && Number.isInteger(quantity) && quantity >= batch.sold) {
    await db.batch.update({ where: { id: batchId }, data: { quantity } });
  }
  revalidatePath(`/painel/eventos/${eventId}/ingressos`);
}

export async function toggleBatch(eventId: string, batchId: string) {
  await requireOwnedEvent(eventId);
  const batch = await db.batch.findFirst({ where: { id: batchId, ticketType: { eventId } } });
  if (batch) await db.batch.update({ where: { id: batchId }, data: { active: !batch.active } });
  revalidatePath(`/painel/eventos/${eventId}/ingressos`);
}

export async function toggleTicketType(eventId: string, ticketTypeId: string) {
  await requireOwnedEvent(eventId);
  const t = await db.ticketType.findFirst({ where: { id: ticketTypeId, eventId } });
  if (t) await db.ticketType.update({ where: { id: t.id }, data: { active: !t.active } });
  revalidatePath(`/painel/eventos/${eventId}/ingressos`);
}

// ---------- Anunciantes e cupons ----------

/** Lê comissão do formulário. PERCENT vira centésimos de % (7,5 → 750); FIXED vira centavos por ingresso. */
function parseCommission(form: FormData, prefix = "commission"): { commissionType: "PERCENT" | "FIXED"; commissionValue: number } | { error: string } | null {
  const raw = String(form.get(`${prefix}Value`) ?? "").trim();
  if (raw === "") return null;
  const type = form.get(`${prefix}Type`) === "FIXED" ? "FIXED" : "PERCENT";
  const value = type === "PERCENT" ? Math.round(Number(raw.replace(",", ".")) * 100) : parseMoney(raw);
  if (!Number.isFinite(value) || value < 0) return { error: "Comissão inválida" };
  if (type === "PERCENT" && value > 10_000) return { error: "Comissão acima de 100%" };
  return { commissionType: type, commissionValue: value };
}

export async function createAdvertiser(_prev: ActionState, form: FormData): Promise<ActionState> {
  const producer = await requireProducer();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Informe o nome do anunciante" };
  const commission = parseCommission(form);
  if (commission && "error" in commission) return { error: commission.error };
  const list = parseCommission(form, "listCommission");
  if (list && "error" in list) return { error: list.error };
  const clean = (k: string) => String(form.get(k) ?? "").trim() || null;
  await db.advertiser.create({
    data: {
      producerId: producer.id,
      name,
      email: clean("email"),
      phone: clean("phone"),
      instagram: clean("instagram"),
      ...(commission ?? {}),
      ...(list ? { listCommissionType: list.commissionType, listCommissionValue: list.commissionValue } : {}),
      accessToken: newAccessToken(),
      publicCode: newPublicCode(name),
    },
  });
  revalidatePath("/painel/anunciantes");
  return { ok: `${name} cadastrado` };
}

export async function updateAdvertiserCommission(advertiserId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const producer = await requireProducer();
  const adv = await db.advertiser.findFirst({ where: { id: advertiserId, producerId: producer.id } });
  if (!adv) return { error: "Anunciante não encontrado" };
  const commission = parseCommission(form) ?? { commissionType: "PERCENT" as const, commissionValue: 0 };
  if ("error" in commission) return { error: commission.error };
  const list = parseCommission(form, "listCommission");
  if (list && "error" in list) return { error: list.error };
  await db.advertiser.update({
    where: { id: adv.id },
    data: {
      ...commission,
      listCommissionType: list ? list.commissionType : null,
      listCommissionValue: list ? list.commissionValue : null,
    },
  });
  revalidatePath("/painel/anunciantes");
  return { ok: "Comissão atualizada. Vale para as próximas vendas." };
}

const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,30}$/, "Código com 3 a 30 letras/números, sem espaço"),
  advertiserId: z.string().optional(),
  discountType: z.enum(["PERCENT", "FIXED"]),
  value: z.string().min(1, "Informe o desconto"),
  maxUses: z.coerce.number().int().min(1).optional().or(z.literal("")),
  validUntil: z.string().optional(),
  commissionType: z.string().optional(),
  commissionValue: z.string().optional(),
});

export async function createCoupon(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { producer } = await requireOwnedEvent(eventId);
  const parsed = couponSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const value = d.discountType === "PERCENT" ? Math.round(Number(d.value.replace(",", "."))) : parseMoney(d.value);
  if (!Number.isFinite(value) || value < 0 || (d.discountType === "PERCENT" && value > 100)) return { error: "Desconto inválido" };

  const commission = parseCommission(form);
  if (commission && "error" in commission) return { error: commission.error };

  let advertiserId: string | null = null;
  if (d.advertiserId) {
    const adv = await db.advertiser.findFirst({ where: { id: d.advertiserId, producerId: producer.id } });
    if (!adv) return { error: "Anunciante inválido" };
    advertiserId = adv.id;
  }
  try {
    await db.coupon.create({
      data: {
        eventId,
        advertiserId,
        code: d.code,
        discountType: d.discountType,
        value,
        maxUses: typeof d.maxUses === "number" ? d.maxUses : null,
        validUntil: d.validUntil ? parseLocalDateTime(d.validUntil) : null,
        ...(commission && advertiserId ? commission : {}),
      },
    });
  } catch {
    return { error: "Já existe um cupom com este código neste evento" };
  }
  revalidatePath(`/painel/eventos/${eventId}/cupons`);
  return { ok: `Cupom ${d.code} criado` };
}

export async function toggleCoupon(eventId: string, couponId: string) {
  await requireOwnedEvent(eventId);
  const c = await db.coupon.findFirst({ where: { id: couponId, eventId } });
  if (c) await db.coupon.update({ where: { id: c.id }, data: { active: !c.active } });
  revalidatePath(`/painel/eventos/${eventId}/cupons`);
}

// ---------- Conta de recebimento ----------

const bankSchema = z.object({
  bankHolder: z.string().trim().min(3, "Informe o titular"),
  bankCode: z.string().transform(onlyDigits).pipe(z.string().length(3, "Código do banco com 3 dígitos")),
  bankBranch: z.string().transform(onlyDigits).pipe(z.string().min(1, "Agência inválida").max(5)),
  bankAccount: z.string().transform(onlyDigits).pipe(z.string().min(1, "Conta inválida").max(13)),
  bankAccountDigit: z.string().trim().min(1, "Informe o dígito").max(2),
  bankAccountType: z.enum(["checking", "savings"]),
});

export async function saveBankAccount(_prev: ActionState, form: FormData): Promise<ActionState> {
  const producer = await requireProducer();
  const parsed = bankSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  let recipientId = producer.recipientId;
  if (env.paymentProvider === "pagarme" && !recipientId) {
    try {
      recipientId = await createPagarmeRecipient({
        name: producer.name,
        email: producer.email,
        document: producer.document,
        phone: producer.phone,
        bank: {
          holder: d.bankHolder,
          code: d.bankCode,
          branch: d.bankBranch,
          account: d.bankAccount,
          digit: d.bankAccountDigit,
          type: d.bankAccountType,
        },
      });
    } catch (err) {
      return { error: `A Pagar.me recusou os dados: ${err instanceof Error ? err.message : "erro desconhecido"}` };
    }
  } else if (env.paymentProvider === "mock" && !recipientId) {
    recipientId = `mock_rp_${producer.id}`;
  }
  await db.producer.update({ where: { id: producer.id }, data: { ...d, recipientId } });
  revalidatePath("/painel/conta");
  return { ok: "Conta de recebimento ativa" };
}

// ---------- Pedidos ----------

export async function refundOrderAction(eventId: string, orderId: string, _prev: ActionState): Promise<ActionState> {
  await requireOwnedEvent(eventId);
  const order = await db.order.findFirst({ where: { id: orderId, eventId } });
  if (!order) return { error: "Pedido não encontrado" };
  try {
    await refundOrder(order.id, "PRODUCER");
  } catch (err) {
    return { error: err instanceof RefundError ? err.message : "Erro ao reembolsar" };
  }
  revalidatePath(`/painel/eventos/${eventId}`, "layout");
  return { ok: "Reembolso feito. O comprador foi avisado por e-mail." };
}

export async function resendTicketsAction(eventId: string, orderId: string, _prev: ActionState): Promise<ActionState> {
  await requireOwnedEvent(eventId);
  const order = await db.order.findFirst({ where: { id: orderId, eventId, status: "PAID" } });
  if (!order) return { error: "Pedido não encontrado ou não pago" };
  try {
    await sendTicketsEmail(order.id);
  } catch {
    return { error: "Falha ao enviar o e-mail" };
  }
  return { ok: `Ingressos reenviados para ${order.buyerEmail}` };
}

// ---------- Cancelamento ----------

export async function cancelEventAction(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { event } = await requireOwnedEvent(eventId);
  if (event.status === "CANCELLED") return { error: "Este evento já foi cancelado" };
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "CANCELAR") return { error: 'Digite CANCELAR para confirmar' };
  const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
  const r = await cancelEvent(event.id, reason);
  revalidatePath(`/evento/${event.slug}`);
  revalidatePath("/");
  revalidatePath(`/painel/eventos/${event.id}`, "layout");
  return {
    ok:
      r.remaining === 0
        ? `Evento cancelado. ${r.refunded} pedido(s) reembolsado(s) e compradores avisados por e-mail.`
        : `Evento cancelado. ${r.refunded} reembolsado(s) até agora; os ${r.remaining} restantes são processados automaticamente nos próximos minutos.`,
  };
}

// ---------- Equipe da portaria ----------

const staffSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(80),
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{4,40}$/, "Login com 4 a 40 letras, números, ponto, hífen ou _ (sem espaço)"),
  password: z.string().min(6, "Senha com pelo menos 6 caracteres").max(100),
});

export async function createStaff(_prev: ActionState, form: FormData): Promise<ActionState> {
  const producer = await requireProducer();
  const parsed = staffSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (await db.staffMember.findUnique({ where: { login: parsed.data.login } })) return { error: "Este login já está em uso. Escolha outro." };
  await db.staffMember.create({
    data: { producerId: producer.id, name: parsed.data.name, login: parsed.data.login, passwordHash: await bcrypt.hash(parsed.data.password, 10) },
  });
  revalidatePath("/painel/equipe");
  return { ok: `Acesso criado para ${parsed.data.name}. Login: ${parsed.data.login}` };
}

export async function toggleStaff(staffId: string) {
  const producer = await requireProducer();
  const st = await db.staffMember.findFirst({ where: { id: staffId, producerId: producer.id } });
  if (st) await db.staffMember.update({ where: { id: st.id }, data: { active: !st.active } });
  revalidatePath("/painel/equipe");
}

export async function resetStaffPassword(staffId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const producer = await requireProducer();
  const st = await db.staffMember.findFirst({ where: { id: staffId, producerId: producer.id } });
  if (!st) return { error: "Membro não encontrado" };
  const password = String(form.get("password") ?? "");
  if (password.length < 6) return { error: "Senha com pelo menos 6 caracteres" };
  await db.staffMember.update({ where: { id: st.id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  return { ok: "Senha alterada" };
}

// ---------- Lista de nomes ----------

export async function updateListSettings(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { event } = await requireOwnedEvent(eventId);
  const money = (k: string) => {
    const v = String(form.get(k) ?? "").trim();
    return v ? parseMoney(v) : null;
  };
  const listPriceCents = money("listPrice");
  const doorPriceCents = money("doorPrice");
  const enabled = form.get("listEnabled") === "on";
  if (enabled && (listPriceCents == null || !Number.isFinite(listPriceCents))) return { error: "Informe o valor para quem está na lista" };
  if (doorPriceCents != null && !Number.isFinite(doorPriceCents)) return { error: "Valor na porta inválido" };
  const max = String(form.get("listMaxPerPromoter") ?? "").trim();
  await db.event.update({
    where: { id: event.id },
    data: {
      listEnabled: enabled,
      listPriceCents,
      doorPriceCents,
      listValidUntil: parseLocalDateTime(String(form.get("listValidUntil") ?? "")),
      listClosesAt: parseLocalDateTime(String(form.get("listClosesAt") ?? "")),
      listMaxPerPromoter: max ? Math.max(1, Math.round(Number(max))) || null : null,
      listPublicSignup: form.get("listPublicSignup") === "on",
    },
  });
  revalidatePath(`/evento/${event.slug}`);
  revalidatePath(`/painel/eventos/${event.id}/lista`);
  return { ok: enabled ? "Lista ativada e salva" : "Configurações salvas (lista desativada)" };
}

export async function addListNamesAction(eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { producer, event } = await requireOwnedEvent(eventId);
  const advertiserId = String(form.get("advertiserId") ?? "") || null;
  if (advertiserId && !(await db.advertiser.findFirst({ where: { id: advertiserId, producerId: producer.id } }))) {
    return { error: "Promoter inválido" };
  }
  try {
    const r = await addNames({ eventId: event.id, advertiserId, names: String(form.get("names") ?? "").split("\n"), source: "PRODUCER" });
    revalidatePath(`/painel/eventos/${event.id}/lista`);
    return { ok: listResultMessage(r) };
  } catch (err) {
    return { error: err instanceof ListError ? err.message : "Erro ao adicionar nomes" };
  }
}

export async function removeListEntryAction(eventId: string, entryId: string) {
  await requireOwnedEvent(eventId);
  // Quem já entrou não sai da lista (o registro de entrada e a comissão dependem dele)
  await db.guestListEntry.deleteMany({ where: { id: entryId, eventId, doorSale: null } });
  revalidatePath(`/painel/eventos/${eventId}/lista`);
}

export async function regenerateAdvertiserLink(advertiserId: string) {
  const producer = await requireProducer();
  await db.advertiser.updateMany({ where: { id: advertiserId, producerId: producer.id }, data: { accessToken: newAccessToken() } });
  revalidatePath("/painel/anunciantes");
}

export async function toggleAdvertiser(advertiserId: string) {
  const producer = await requireProducer();
  const adv = await db.advertiser.findFirst({ where: { id: advertiserId, producerId: producer.id } });
  if (adv) await db.advertiser.update({ where: { id: adv.id }, data: { active: !adv.active } });
  revalidatePath("/painel/anunciantes");
}
