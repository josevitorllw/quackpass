import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { brl, dateTime } from "@/lib/format";
import { promoterByToken } from "@/lib/promoter";

export default async function PromoterHome({ params }: { params: { token: string } }) {
  const adv = await promoterByToken(params.token);
  if (!adv) notFound();
  const events = await db.event.findMany({
    where: { producerId: adv.producerId, status: "PUBLISHED", listEnabled: true, startsAt: { gte: new Date(Date.now() - 24 * 3_600_000) } },
    orderBy: { startsAt: "asc" },
  });
  const ids = events.map((e) => e.id);
  const [names, door, site] = await Promise.all([
    db.guestListEntry.groupBy({ by: ["eventId"], where: { advertiserId: adv.id, eventId: { in: ids } }, _count: true }),
    db.doorSale.groupBy({ by: ["eventId"], where: { advertiserId: adv.id }, _count: true, _sum: { commissionCents: true } }),
    db.order.aggregate({ where: { advertiserId: adv.id, status: "PAID" }, _count: true, _sum: { commissionCents: true } }),
  ]);
  const doorTotal = door.reduce((s, d) => s + (d._sum.commissionCents ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Comissão na porta / lista</p>
          <p className="text-xl font-extrabold">{brl(doorTotal)}</p>
          <p className="text-xs text-slate-500">{door.reduce((s, d) => s + d._count, 0)} pessoa(s) entraram</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Comissão no site (cupom)</p>
          <p className="text-xl font-extrabold">{brl(site._sum.commissionCents ?? 0)}</p>
          <p className="text-xs text-slate-500">{site._count} pedido(s)</p>
        </div>
      </div>

      <section className="space-y-3">
        <h1 className="text-xl font-extrabold">Eventos com lista</h1>
        {events.length === 0 && <p className="card text-slate-600">Nenhum evento com lista aberta no momento.</p>}
        {events.map((e) => (
          <Link key={e.id} href={`/promoter/${params.token}/evento/${e.id}`} className="card block hover:border-brand-400">
            <p className="text-xs font-semibold uppercase text-brand-700">{dateTime(e.startsAt)}</p>
            <p className="text-lg font-bold">{e.title}</p>
            <p className="text-sm text-slate-600">
              {names.find((n) => n.eventId === e.id)?._count ?? 0} nome(s) seu(s) na lista ·{" "}
              {door.find((d) => d.eventId === e.id)?._count ?? 0} entraram
            </p>
          </Link>
        ))}
      </section>
      <p className="text-center text-xs text-slate-500">Este link é só seu. Não compartilhe: quem tiver o link consegue colocar nomes em seu nome.</p>
    </div>
  );
}
