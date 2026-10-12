import type { Batch, TicketType } from "@prisma/client";
import type { CheckoutTicketType } from "@/app/(site)/evento/[slug]/Checkout";
import type { Producer } from "@prisma/client";
import { env } from "./env";
import { feePercentFor } from "./plans";
import { currentBatch } from "./pricing";

export function ticketTypesForCheckout(types: (TicketType & { batches: Batch[] })[]): CheckoutTicketType[] {
  return types.map((t) => {
    const b = currentBatch(t.batches);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      soldOut: t.batches.length > 0 && t.batches.every((x) => x.sold >= x.quantity),
      batch: b && { id: b.id, name: b.name, priceCents: b.priceCents, maxPerOrder: Math.min(b.maxPerOrder, b.quantity - b.sold) },
    };
  });
}

/** Configuração do checkout. A taxa pode ser especial para a casa (definida pelo admin). */
export function checkoutConfig(producer?: Pick<Producer, "feeBps"> | null) {
  return {
    fee: { percent: feePercentFor(producer), minCents: env.platformFeeMinCents },
    provider: env.paymentProvider,
    pagarmePublicKey: process.env.PAGARME_PUBLIC_KEY ?? "",
  };
}
