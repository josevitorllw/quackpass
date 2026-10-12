import { Prisma, type PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { env } from "./env";
import { safely, sendRefundEmail, sendTicketsEmail } from "./email";
import { onlyDigits } from "./format";
import { paymentProvider, type CardInput } from "./payments";
import { feePercentFor } from "./plans";
import { calculateCommission, calculatePricing, currentBatch, type CartLine } from "./pricing";
import { newTicketCode } from "./tickets";

export class CheckoutError extends Error {}

export const checkoutSchema = z.object({
  eventId: z.string().min(1),
  items: z
    .array(z.object({ batchId: z.string().min(1), quantity: z.number().int().min(1).max(50) }))
    .min(1)
    .max(20),
  couponCode: z.string().trim().max(40).optional(),
  buyer: z.object({
    name: z.string().trim().min(3).max(120),
    email: z.string().trim().toLowerCase().email().max(160),
    document: z.string().transform(onlyDigits).pipe(z.string().regex(/^(\d{11}|\d{14})$/, "CPF/CNPJ inválido")),
    phone: z.string().transform(onlyDigits).pipe(z.string().min(10).max(13)),
  }),
  ageConfirmed: z.literal(true, { errorMap: () => ({ message: "Confirme que tem 18 anos ou mais" }) }),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD", "DEBIT_CARD"]),
  installments: z.number().int().min(1).max(12).default(1),
  card: z.object({ token: z.string().min(1) }).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Busca cupom válido pelo código (case-insensitive). Retorna null se inexistente/expirado/esgotado. */
export async function findValidCoupon(eventId: string, code: string | undefined | null) {
  if (!code) return null;
  const coupon = await db.coupon.findUnique({
    where: { eventId_code: { eventId, code: code.trim().toUpperCase() } },
    include: { advertiser: true },
  });
  if (!coupon || !coupon.active) return null;
  if (coupon.validUntil && coupon.validUntil < new Date()) return null;
  if (coupon.maxUses != null && coupon.uses >= coupon.maxUses) return null;
  return coupon;
}

/**
 * Cria o pedido reservando os ingressos.
 * A reserva usa UPDATE condicional no Postgres (sold + n <= quantity), então
 * duas compras simultâneas nunca vendem além do estoque, sem lock global.
 */
export async function createOrder(input: CheckoutInput) {
  const event = await db.event.findUnique({
    where: { id: input.eventId },
    include: { producer: true, ticketTypes: { where: { active: true }, include: { batches: true } } },
  });
  if (!event || event.status !== "PUBLISHED" || event.producer.status !== "APPROVED") throw new CheckoutError("Evento indisponível");
  if ((event.endsAt ?? event.startsAt) < new Date()) throw new CheckoutError("Este evento já aconteceu");

  // Agrupa itens repetidos
  const merged = new Map<string, { batchId: string; quantity: number }>();
  for (const it of input.items) {
    merged.set(it.batchId, { batchId: it.batchId, quantity: (merged.get(it.batchId)?.quantity ?? 0) + it.quantity });
  }

  const lines: (CartLine & { description: string })[] = [];
  const perBatch = new Map<string, number>();
  for (const it of Array.from(merged.values())) {
    const type = event.ticketTypes.find((t) => t.batches.some((b) => b.id === it.batchId));
    const batch = type?.batches.find((b) => b.id === it.batchId);
    if (!type || !batch) throw new CheckoutError("Ingresso inválido");
    if (currentBatch(type.batches)?.id !== batch.id) throw new CheckoutError(`${type.name} - ${batch.name} não está mais à venda`);
    perBatch.set(batch.id, (perBatch.get(batch.id) ?? 0) + it.quantity);
    if (perBatch.get(batch.id)! > batch.maxPerOrder) throw new CheckoutError(`Máximo de ${batch.maxPerOrder} por pedido em ${type.name}`);
    lines.push({ batch, quantity: it.quantity, description: `${type.name} - ${batch.name}` });
  }

  const coupon = input.couponCode ? await findValidCoupon(event.id, input.couponCode) : null;
  if (input.couponCode && !coupon) throw new CheckoutError("Cupom inválido ou esgotado");

  const pricing = calculatePricing(lines, coupon, event.feePayer, { percent: feePercentFor(event.producer), minCents: env.platformFeeMinCents });
  // Comissão do anunciante: a do cupom, se definida; senão a padrão do anunciante
  const commission = coupon?.advertiser
    ? coupon.commissionType != null && coupon.commissionValue != null
      ? { commissionType: coupon.commissionType, commissionValue: coupon.commissionValue }
      : coupon.advertiser
    : null;
  const paidTickets = lines.reduce((n, l) => n + (l.batch.priceCents > 0 ? l.quantity : 0), 0);
  const commissionCents = calculateCommission(commission, pricing.subtotalCents - pricing.discountCents, paidTickets);
  const isFree = pricing.totalCents === 0;
  const method: PaymentMethod = isFree ? "FREE" : input.paymentMethod;
  if (!isFree && method !== "PIX" && !input.card?.token) throw new CheckoutError("Dados do cartão ausentes");
  if (!isFree && env.paymentProvider === "pagarme" && !event.producer.recipientId) {
    throw new CheckoutError("O produtor ainda não ativou o recebimento. Tente mais tarde.");
  }
  const installments = method === "CREDIT_CARD" ? input.installments : 1;

  const order = await db.$transaction(
    async (tx) => {
      for (const [batchId, qty] of Array.from(perBatch.entries())) {
        const n = await tx.$executeRaw`
          UPDATE "Batch" SET "sold" = "sold" + ${qty}
          WHERE "id" = ${batchId} AND "sold" + ${qty} <= "quantity"`;
        if (n === 0) throw new CheckoutError("Ingressos esgotados para a quantidade escolhida");
      }
      if (coupon) {
        const n = await tx.$executeRaw`
          UPDATE "Coupon" SET "uses" = "uses" + 1
          WHERE "id" = ${coupon.id} AND ("maxUses" IS NULL OR "uses" < "maxUses")`;
        if (n === 0) throw new CheckoutError("Cupom esgotado");
      }
      return tx.order.create({
        data: {
          eventId: event.id,
          paymentMethod: method,
          installments,
          buyerName: input.buyer.name,
          buyerEmail: input.buyer.email,
          buyerDocument: input.buyer.document,
          buyerPhone: input.buyer.phone,
          couponId: coupon?.id,
          advertiserId: coupon?.advertiserId,
          ...pricing,
          commissionCents,
          expiresAt: new Date(Date.now() + env.reservationMinutes * 60_000),
          items: {
            create: lines.map((l) => ({
              batchId: l.batch.id,
              quantity: l.quantity,
              unitPriceCents: l.batch.priceCents,
            })),
          },
        },
        include: { items: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 },
  );

  if (isFree) {
    await markOrderPaid(order.id);
    return order;
  }

  const card: CardInput | undefined = input.card ? { token: input.card.token, installments } : undefined;
  try {
    const result = await paymentProvider().createPayment({
      order: {
        ...order,
        items: order.items.map((i) => ({
          ...i,
          description: lines.find((l) => l.batch.id === i.batchId)!.description,
        })),
      },
      event,
      producer: event.producer,
      card,
    });
    await db.order.update({
      where: { id: order.id },
      data: {
        gatewayOrderId: result.gatewayOrderId,
        gatewayChargeId: result.gatewayChargeId,
        pixQrCode: result.pixQrCode,
        pixQrCodeUrl: result.pixQrCodeUrl,
        authUrl: result.authUrl,
      },
    });
    if (result.status === "paid") await markOrderPaid(order.id);
    else if (result.status === "failed" || result.status === "canceled")
      await releaseOrder(order.id, "FAILED", result.failureReason ?? "Pagamento recusado");
  } catch (err) {
    console.error("[checkout] erro no gateway", order.id, err);
    await releaseOrder(order.id, "FAILED", "Não foi possível processar o pagamento");
    throw new CheckoutError("Não foi possível processar o pagamento. Tente novamente.");
  }
  return order;
}

/** Devolve o estoque e o uso do cupom de um pedido pendente. Idempotente. */
export async function releaseOrder(orderId: string, status: "FAILED" | "EXPIRED" | "CANCELLED", reason?: string) {
  await db.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status, failureReason: reason },
    });
    if (changed.count === 0) return;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    for (const item of order.items) {
      await tx.$executeRaw`UPDATE "Batch" SET "sold" = GREATEST("sold" - ${item.quantity}, 0) WHERE "id" = ${item.batchId}`;
    }
    if (order.couponId) {
      await tx.$executeRaw`UPDATE "Coupon" SET "uses" = GREATEST("uses" - 1, 0) WHERE "id" = ${order.couponId}`;
    }
  });
}

/**
 * Confirma o pagamento e emite os ingressos. Idempotente: só a primeira chamada emite.
 * Se o pedido já tinha expirado (Pix pago no último segundo), re-reserva o estoque.
 */
export async function markOrderPaid(orderId: string) {
  const issued = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.status === "PAID") return false;
    // CANCELLED: Pix gerado antes do cancelamento do evento e pago depois. Marca como pago
    // para logo em seguida reembolsar (abaixo), em vez de ficar com o dinheiro sem ingresso.
    if (!["PENDING", "EXPIRED", "FAILED", "CANCELLED"].includes(order.status)) return false;

    const changed = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: "PAID", paidAt: new Date(), failureReason: null },
    });
    if (changed.count === 0) return false;

    if (order.status !== "PENDING") {
      // O estoque tinha sido devolvido: o dinheiro já entrou, então reserva de novo
      for (const item of order.items) {
        await tx.$executeRaw`UPDATE "Batch" SET "sold" = "sold" + ${item.quantity} WHERE "id" = ${item.batchId}`;
      }
      if (order.couponId) await tx.$executeRaw`UPDATE "Coupon" SET "uses" = "uses" + 1 WHERE "id" = ${order.couponId}`;
    }

    await tx.ticket.createMany({
      data: order.items.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          code: newTicketCode(),
          orderId: order.id,
          eventId: order.eventId,
          batchId: item.batchId,
          holderName: order.buyerName,
        })),
      ),
    });
    return true;
  });
  if (!issued) return false;
  // Pago depois que o evento foi cancelado (ex.: Pix no último segundo): reembolsa em vez de entregar
  const ev = await db.order.findUnique({ where: { id: orderId }, select: { event: { select: { status: true } } } });
  if (ev?.event.status === "CANCELLED") {
    await refundOrder(orderId, "CANCELLATION").catch((err) => console.error("[cancelamento] reembolso falhou; o cron tenta de novo", orderId, err));
    return true;
  }
  // Só quem de fato emitiu os ingressos manda o e-mail (evita e-mail duplicado)
  await safely(() => sendTicketsEmail(orderId), `ingressos ${orderId}`);
  return true;
}

/** Expira pedidos pendentes vencidos (chamado pelo cron e também sob demanda). */
export async function expireStaleOrders(limit = 500) {
  // 2 min de folga para o webhook do Pix chegar
  const cutoff = new Date(Date.now() - 2 * 60_000);
  const stale = await db.order.findMany({
    where: { status: "PENDING", expiresAt: { lt: cutoff } },
    select: { id: true },
    take: limit,
  });
  for (const o of stale) await releaseOrder(o.id, "EXPIRED", "Tempo para pagamento esgotado");
  return stale.length;
}

/** Sincroniza com o gateway (usado pelo webhook e pelo polling da tela de pagamento). */
export async function syncOrderWithGateway(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order?.gatewayOrderId || order.status === "REFUNDED" || order.status === "REFUNDING") return order?.status;
  const status = await paymentProvider().getStatus(order.gatewayOrderId);
  if (status === "paid") await markOrderPaid(order.id);
  else if (status === "refunded") await markOrderRefunded(order.id);
  else if (status === "failed" || status === "canceled") await releaseOrder(order.id, "FAILED", "Pagamento não aprovado");
  return (await db.order.findUnique({ where: { id: orderId }, select: { status: true } }))?.status;
}

/**
 * Marca o pedido como reembolsado: cancela os ingressos e devolve o estoque e o uso do cupom.
 * Idempotente (só age se o pedido estiver PAID).
 */
export type RefundBy = "BUYER" | "PRODUCER" | "ADMIN" | "CANCELLATION" | "GATEWAY";

/**
 * Marca o pedido como reembolsado: cancela os ingressos e devolve o estoque e o uso do cupom.
 * Idempotente (só age se o pedido estiver PAID ou REFUNDING).
 */
export async function markOrderRefunded(orderId: string, by: RefundBy = "GATEWAY") {
  const done = await db.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id: orderId, status: { in: ["PAID", "REFUNDING"] } },
      data: { status: "REFUNDED", refundedAt: new Date(), refundedBy: by, refundError: null },
    });
    if (changed.count === 0) return false;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    await tx.ticket.updateMany({ where: { orderId }, data: { status: "CANCELLED" } });
    for (const item of order.items) {
      await tx.$executeRaw`UPDATE "Batch" SET "sold" = GREATEST("sold" - ${item.quantity}, 0) WHERE "id" = ${item.batchId}`;
    }
    if (order.couponId) await tx.$executeRaw`UPDATE "Coupon" SET "uses" = GREATEST("uses" - 1, 0) WHERE "id" = ${order.couponId}`;
    return true;
  });
  if (done) await safely(() => sendRefundEmail(orderId), `reembolso ${orderId}`);
  return done;
}

export class RefundError extends Error {}

/** Diz se o comprador pode pedir reembolso pelo site agora (e por quê, se não puder). */
export function selfRefundStatus(
  order: { status: string; event: { refundMode: string; refundDeadlineHours: number; startsAt: Date } },
  usedTickets: number,
  now = new Date(),
): { allowed: boolean; reason?: string; deadline: Date } {
  const deadline = new Date(order.event.startsAt.getTime() - order.event.refundDeadlineHours * 3_600_000);
  if (order.status !== "PAID") return { allowed: false, reason: "Pedido não está pago", deadline };
  if (order.event.refundMode !== "SELF_SERVICE") return { allowed: false, reason: "Reembolso feito pelo estabelecimento", deadline };
  if (now > deadline) return { allowed: false, reason: "O prazo para reembolso terminou", deadline };
  if (usedTickets > 0) return { allowed: false, reason: "Algum ingresso deste pedido já foi utilizado", deadline };
  return { allowed: true, deadline };
}

/**
 * Faz o reembolso total no gateway e cancela os ingressos.
 * - Comprador: só dentro da política do evento.
 * - Produtor, administrador e cancelamento do evento: a qualquer momento.
 * O pedido é "travado" em REFUNDING antes de chamar o gateway, então dois cliques
 * (ou o cron e o painel ao mesmo tempo) nunca estornam o mesmo pedido duas vezes.
 */
export async function refundOrder(orderId: string, by: Exclude<RefundBy, "GATEWAY">) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { event: true } });
  if (!order) throw new RefundError("Pedido não encontrado");
  if (order.status === "REFUNDED") return;
  if (order.status === "REFUNDING") throw new RefundError("Este reembolso já está em andamento");
  if (order.status !== "PAID") throw new RefundError("Só pedidos pagos podem ser reembolsados");

  if (by === "BUYER") {
    const used = await db.ticket.count({ where: { orderId, status: "USED" } });
    const check = selfRefundStatus(order, used);
    if (!check.allowed) throw new RefundError(check.reason ?? "Reembolso indisponível");
  }

  const claimed = await db.order.updateMany({ where: { id: orderId, status: "PAID" }, data: { status: "REFUNDING" } });
  if (claimed.count === 0) throw new RefundError("Este reembolso já está em andamento");

  if (order.totalCents > 0 && order.gatewayChargeId) {
    try {
      const provider = paymentProvider();
      if (!provider.refund) throw new Error("Gateway não suporta reembolso automático");
      await provider.refund(order.gatewayChargeId);
    } catch (err) {
      console.error("[refund] gateway recusou", orderId, err);
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      await db.order.updateMany({ where: { id: orderId, status: "REFUNDING" }, data: { status: "PAID", refundError: msg.slice(0, 500) } });
      throw new RefundError("O gateway de pagamento recusou o reembolso. Tente novamente ou fale com o suporte.");
    }
  }
  await markOrderRefunded(orderId, by);
}

// ---------- Cancelamento de evento ----------

/**
 * Cancela o evento: para as vendas, libera os pedidos pendentes e reembolsa todos os pagos.
 * Os reembolsos rodam aqui (até o tempo-limite) e o cron termina o que faltar, inclusive
 * novas tentativas de reembolsos que falharam e Pix pagos depois do cancelamento.
 */
export async function cancelEvent(eventId: string, reason: string) {
  await db.event.updateMany({
    where: { id: eventId, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason || null },
  });
  return processCancelledEventRefunds(eventId, 20_000);
}

export async function processCancelledEventRefunds(eventId: string, timeBudgetMs = 20_000) {
  const until = Date.now() + timeBudgetMs;
  const pending = await db.order.findMany({ where: { eventId, status: "PENDING" }, select: { id: true } });
  for (const o of pending) await releaseOrder(o.id, "CANCELLED", "Evento cancelado");

  let refunded = 0;
  let failed = 0;
  const tried = new Set<string>();
  while (Date.now() < until) {
    const batch = await db.order.findMany({
      where: { eventId, status: "PAID", id: { notIn: Array.from(tried) } },
      select: { id: true },
      take: 25,
    });
    if (batch.length === 0) break;
    // 5 estornos em paralelo: rápido sem estourar o limite de requisições do gateway
    for (let i = 0; i < batch.length; i += 5) {
      await Promise.all(
        batch.slice(i, i + 5).map(async ({ id }) => {
          tried.add(id);
          try {
            await refundOrder(id, "CANCELLATION");
            refunded++;
          } catch {
            failed++;
          }
        }),
      );
      if (Date.now() >= until) break;
    }
  }
  const remaining = await db.order.count({ where: { eventId, status: { in: ["PAID", "REFUNDING"] } } });
  return { refunded, failed, remaining };
}

/** Chamado pelo cron: continua os reembolsos de eventos cancelados e destrava reembolsos parados. */
export async function processAllCancellations(timeBudgetMs = 40_000) {
  const until = Date.now() + timeBudgetMs;

  // Pedidos que ficaram "REFUNDING" por mais de 10 min (ex.: servidor caiu no meio): confere no gateway
  const stuck = await db.order.findMany({
    where: { status: "REFUNDING", updatedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    select: { id: true, gatewayOrderId: true },
    take: 50,
  });
  for (const o of stuck) {
    const status = o.gatewayOrderId ? await paymentProvider().getStatus(o.gatewayOrderId).catch(() => null) : null;
    if (status === "refunded") await markOrderRefunded(o.id, "CANCELLATION");
    else await db.order.updateMany({ where: { id: o.id, status: "REFUNDING" }, data: { status: "PAID" } });
  }

  const events = await db.event.findMany({
    where: { status: "CANCELLED", orders: { some: { status: { in: ["PAID", "PENDING"] } } } },
    select: { id: true },
    take: 20,
  });
  for (const e of events) {
    const left = until - Date.now();
    if (left <= 0) break;
    await processCancelledEventRefunds(e.id, left);
  }
}
