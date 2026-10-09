import { NextResponse } from "next/server";
import { z } from "zod";
import { checkinActor } from "@/lib/checkin";
import { dateTime } from "@/lib/format";
import { AlreadyEnteredError, ListError, registerDoorEntry } from "@/lib/guestlist";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  guestListEntryId: z.string().min(1).optional(),
  name: z.string().trim().max(80).optional(),
  advertiserId: z.string().min(1).optional(),
  amountCents: z.number().int().min(0).max(10_000_00),
  method: z.enum(["CASH", "PIX", "CARD", "FREE"]),
});

/** Registra entrada paga na porta (balcão): nome da lista ou venda direta, com o promoter que indicou. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await checkinActor(params.id);
  if (!actor) return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });
  if (!rateLimit(`porta:${actor.eventId}:${actor.name}`, 120, 60_000)) return NextResponse.json({ error: "Muitas operações seguidas" }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  try {
    const sale = await registerDoorEntry({ eventId: actor.eventId, ...parsed.data, staffName: actor.name });
    return NextResponse.json({ ok: true, name: sale.name, promoter: sale.advertiser?.name ?? null });
  } catch (err) {
    if (err instanceof AlreadyEnteredError) {
      return NextResponse.json(
        { error: `Este nome já entrou em ${dateTime(err.sale.createdAt)}${err.sale.staffName ? ` (${err.sale.staffName})` : ""}` },
        { status: 409 },
      );
    }
    if (err instanceof ListError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[porta]", err);
    return NextResponse.json({ error: "Erro ao registrar" }, { status: 500 });
  }
}
