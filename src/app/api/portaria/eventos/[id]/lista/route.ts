import { NextResponse } from "next/server";
import { checkinActor } from "@/lib/checkin";
import { db } from "@/lib/db";
import { nameKey, suggestedDoorPrice } from "@/lib/guestlist";

export const dynamic = "force-dynamic";

/** Lista de nomes do evento para a portaria (busca por nome). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const actor = await checkinActor(params.id);
  if (!actor) return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });
  const event = await db.event.findUniqueOrThrow({ where: { id: actor.eventId } });
  const q = nameKey(new URL(req.url).searchParams.get("q") ?? "");

  const [entries, promoters, names, entered, door] = await Promise.all([
    db.guestListEntry.findMany({
      where: { eventId: event.id, ...(q ? { nameKey: { contains: q } } : {}) },
      orderBy: { nameKey: "asc" },
      take: 50,
      include: { advertiser: { select: { name: true } }, doorSale: { select: { createdAt: true, staffName: true } } },
    }),
    db.advertiser.findMany({ where: { producerId: event.producerId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.guestListEntry.count({ where: { eventId: event.id } }),
    db.doorSale.count({ where: { eventId: event.id, guestListEntryId: { not: null } } }),
    db.doorSale.count({ where: { eventId: event.id } }),
  ]);
  const onList = suggestedDoorPrice(event, true);
  const offList = suggestedDoorPrice(event, false);

  return NextResponse.json({
    listEnabled: event.listEnabled,
    prices: { list: onList.cents, door: offList.cents, listExpired: onList.listExpired, listValidUntil: event.listValidUntil },
    counts: { names, entered, door },
    promoters,
    entries: entries.map((e) => ({
      id: e.id,
      name: e.name,
      promoter: e.advertiser?.name ?? null,
      entered: e.doorSale ? { at: e.doorSale.createdAt, by: e.doorSale.staffName } : null,
    })),
  });
}
