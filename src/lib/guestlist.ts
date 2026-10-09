import { randomBytes } from "crypto";
import { Prisma, type Advertiser, type DoorPaymentMethod, type Event } from "@prisma/client";
import { db } from "./db";
import { slugify } from "./format";

/** Nome para busca/duplicados: sem acento, minúsculo, espaços simples. */
export function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Link secreto da área do promoter (192 bits, impossível de adivinhar). */
export function newAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Código curto e legível do link público do promoter. */
export function newPublicCode(name: string): string {
  return `${slugify(name).slice(0, 14) || "promoter"}-${randomBytes(3).toString("hex")}`;
}

/** A lista do evento está aceitando nomes agora? */
export function listOpen(e: Pick<Event, "listEnabled" | "status" | "listClosesAt" | "startsAt" | "endsAt">, now = new Date()) {
  if (!e.listEnabled) return { open: false, reason: "Este evento não tem lista" };
  if (e.status !== "PUBLISHED") return { open: false, reason: "Evento indisponível" };
  const closes = e.listClosesAt ?? e.endsAt ?? new Date(e.startsAt.getTime() + 6 * 3_600_000);
  if (now > closes) return { open: false, reason: "A lista deste evento já fechou" };
  return { open: true as const, closes };
}

export class ListError extends Error {}

/**
 * Adiciona nomes à lista. Duplicados do mesmo promoter são ignorados (o banco garante).
 * Respeita o limite de nomes por promoter do evento.
 */
export async function addNames(opts: {
  eventId: string;
  advertiserId: string | null;
  names: string[];
  source: "PROMOTER" | "PUBLIC" | "PRODUCER";
  phone?: string | null;
}) {
  const event = await db.event.findUnique({ where: { id: opts.eventId }, include: { producer: { select: { status: true } } } });
  if (!event || event.producer.status !== "APPROVED") throw new ListError("Evento não encontrado");
  const status = listOpen(event);
  if (!status.open) throw new ListError(status.reason);

  const unique = new Map<string, string>();
  for (const raw of opts.names) {
    const name = cleanName(raw);
    const key = nameKey(name);
    // Mantém a primeira grafia quando o mesmo nome aparece repetido
    if (key.length >= 3 && name.includes(" ") && !unique.has(key)) unique.set(key, name);
  }
  const invalid = opts.names.filter((n) => n.trim()).length - unique.size;
  if (unique.size === 0) throw new ListError("Informe nome e sobrenome");

  return db.$transaction(
    async (tx) => {
      let entries = Array.from(unique.entries());
      if (opts.advertiserId && event.listMaxPerPromoter) {
        const current = await tx.guestListEntry.count({ where: { eventId: event.id, advertiserId: opts.advertiserId } });
        const room = Math.max(0, event.listMaxPerPromoter - current);
        if (room === 0) throw new ListError(`Limite de ${event.listMaxPerPromoter} nomes por promoter atingido`);
        entries = entries.slice(0, room);
      }
      const created = await tx.guestListEntry.createMany({
        data: entries.map(([key, name]) => ({
          eventId: event.id,
          advertiserId: opts.advertiserId,
          name,
          nameKey: key,
          phone: opts.phone ?? null,
          source: opts.source,
        })),
        skipDuplicates: true,
      });
      return {
        added: created.count,
        duplicates: entries.length - created.count,
        overLimit: unique.size - entries.length,
        invalid: Math.max(0, invalid),
      };
    },
  );
}

/** Valor sugerido na porta: preço da lista (se ainda no horário) ou preço de porta. */
export function suggestedDoorPrice(
  e: Pick<Event, "listPriceCents" | "doorPriceCents" | "listValidUntil">,
  onList: boolean,
  now = new Date(),
): { cents: number | null; listExpired: boolean } {
  const listExpired = !!e.listValidUntil && now > e.listValidUntil;
  if (onList && !listExpired && e.listPriceCents != null) return { cents: e.listPriceCents, listExpired };
  return { cents: e.doorPriceCents ?? e.listPriceCents ?? null, listExpired };
}

/**
 * Comissão de uma entrada na porta. Usa a comissão de lista do promoter (ou a padrão, se não houver).
 * FIXED = valor por pessoa que entrou (mesmo cortesia); PERCENT = % do valor pago.
 */
export function doorCommission(adv: Pick<Advertiser, "commissionType" | "commissionValue" | "listCommissionType" | "listCommissionValue"> | null, amountCents: number): number {
  if (!adv) return 0;
  const type = adv.listCommissionType ?? adv.commissionType;
  const value = adv.listCommissionValue ?? adv.commissionValue;
  if (value <= 0) return 0;
  return type === "FIXED" ? value : Math.round((amountCents * value) / 10_000);
}

export class AlreadyEnteredError extends Error {
  constructor(public sale: { createdAt: Date; staffName: string }) {
    super("Este nome já entrou");
  }
}

/** Registra uma entrada paga na porta (pela lista ou venda direta). O mesmo nome nunca entra duas vezes. */
export async function registerDoorEntry(opts: {
  eventId: string;
  guestListEntryId?: string | null;
  name?: string | null;
  advertiserId?: string | null;
  amountCents: number;
  method: DoorPaymentMethod;
  staffName: string;
}) {
  const event = await db.event.findUniqueOrThrow({ where: { id: opts.eventId }, select: { id: true, producerId: true } });
  let name = cleanName(opts.name ?? "") || "Venda na porta";
  let advertiserId = opts.advertiserId ?? null;
  let guestListEntryId: string | null = null;

  if (opts.guestListEntryId) {
    const entry = await db.guestListEntry.findFirst({ where: { id: opts.guestListEntryId, eventId: event.id } });
    if (!entry) throw new ListError("Nome não encontrado na lista deste evento");
    name = entry.name;
    advertiserId = entry.advertiserId; // a comissão é sempre de quem colocou o nome
    guestListEntryId = entry.id;
  }
  const advertiser = advertiserId
    ? await db.advertiser.findFirst({ where: { id: advertiserId, producerId: event.producerId } })
    : null;
  if (advertiserId && !advertiser) throw new ListError("Promoter inválido");

  const amountCents = opts.method === "FREE" ? 0 : Math.max(0, Math.round(opts.amountCents));
  try {
    return await db.doorSale.create({
      data: {
        eventId: event.id,
        guestListEntryId,
        advertiserId: advertiser?.id ?? null,
        name,
        amountCents,
        method: opts.method,
        commissionCents: doorCommission(advertiser, amountCents),
        staffName: opts.staffName,
      },
      include: { advertiser: { select: { name: true } } },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && guestListEntryId) {
      const prev = await db.doorSale.findUnique({ where: { guestListEntryId }, select: { createdAt: true, staffName: true } });
      throw new AlreadyEnteredError(prev ?? { createdAt: new Date(), staffName: "" });
    }
    throw err;
  }
}

/** Resumo por promoter de um evento: nomes, quem entrou, valor na porta e comissão. */
export async function listStatsByPromoter(eventId: string) {
  const [names, sales] = await Promise.all([
    db.guestListEntry.groupBy({ by: ["advertiserId"], where: { eventId }, _count: true }),
    db.doorSale.groupBy({
      by: ["advertiserId"],
      where: { eventId },
      _count: true,
      _sum: { amountCents: true, commissionCents: true },
    }),
  ]);
  const listEntered = await db.doorSale.groupBy({
    by: ["advertiserId"],
    where: { eventId, guestListEntryId: { not: null } },
    _count: true,
  });
  const ids = new Set<string | null>([...names.map((n) => n.advertiserId), ...sales.map((s) => s.advertiserId)]);
  return Array.from(ids).map((advertiserId) => ({
    advertiserId,
    names: names.find((n) => n.advertiserId === advertiserId)?._count ?? 0,
    enteredFromList: listEntered.find((n) => n.advertiserId === advertiserId)?._count ?? 0,
    doorEntries: sales.find((s) => s.advertiserId === advertiserId)?._count ?? 0,
    doorCents: sales.find((s) => s.advertiserId === advertiserId)?._sum.amountCents ?? 0,
    commissionCents: sales.find((s) => s.advertiserId === advertiserId)?._sum.commissionCents ?? 0,
  }));
}

export const METHOD_LABEL: Record<DoorPaymentMethod, string> = { CASH: "Dinheiro", PIX: "Pix", CARD: "Cartão", FREE: "Cortesia" };
