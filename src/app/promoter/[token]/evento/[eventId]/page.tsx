import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { brl, dateTime } from "@/lib/format";
import { listOpen, METHOD_LABEL } from "@/lib/guestlist";
import { promoterByToken } from "@/lib/promoter";
import { promoterAddNames, promoterRemoveName } from "../../../actions";

const time = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

export default async function PromoterEvent({ params }: { params: { token: string; eventId: string } }) {
  const adv = await promoterByToken(params.token);
  if (!adv) notFound();
  const event = await db.event.findFirst({ where: { id: params.eventId, producerId: adv.producerId, listEnabled: true } });
  if (!event) notFound();

  const [entries, walkIns] = await Promise.all([
    db.guestListEntry.findMany({ where: { eventId: event.id, advertiserId: adv.id }, orderBy: { name: "asc" }, include: { doorSale: true } }),
    db.doorSale.findMany({ where: { eventId: event.id, advertiserId: adv.id, guestListEntryId: null }, orderBy: { createdAt: "asc" } }),
  ]);
  const entered = entries.filter((e) => e.doorSale).length + walkIns.length;
  const commission = entries.reduce((s, e) => s + (e.doorSale?.commissionCents ?? 0), 0) + walkIns.reduce((s, w) => s + w.commissionCents, 0);
  const status = listOpen(event);
  const publicLink = `${env.appUrl}/evento/${event.slug}/lista?p=${adv.publicCode}`;

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/promoter/${params.token}`} className="text-sm text-slate-500">
          ← Eventos
        </Link>
        <h1 className="text-xl font-extrabold">{event.title}</h1>
        <p className="text-sm text-slate-600">{dateTime(event.startsAt)}</p>
        <p className="mt-1 text-sm text-slate-600">
          Na lista: <b>{event.listPriceCents != null ? brl(event.listPriceCents) : "-"}</b>
          {event.listValidUntil && ` até ${dateTime(event.listValidUntil)}`}
          {event.doorPriceCents != null && ` · sem lista: ${brl(event.doorPriceCents)}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card p-3">
          <p className="text-2xl font-extrabold">{entries.length}</p>
          <p className="text-xs text-slate-500">nomes{event.listMaxPerPromoter ? ` de ${event.listMaxPerPromoter}` : ""}</p>
        </div>
        <div className="card p-3">
          <p className="text-2xl font-extrabold">{entered}</p>
          <p className="text-xs text-slate-500">entraram</p>
        </div>
        <div className="card p-3">
          <p className="text-2xl font-extrabold">{brl(commission)}</p>
          <p className="text-xs text-slate-500">sua comissão</p>
        </div>
      </div>

      {status.open ? (
        <ActionForm action={promoterAddNames.bind(null, params.token, event.id)} className="card space-y-3">
          <label className="label" htmlFor="names">
            Adicionar nomes (um por linha, nome e sobrenome)
          </label>
          <textarea id="names" name="names" className="input min-h-36" placeholder={"Maria Silva\nJoão Pereira\nAna Costa"} required />
          <SubmitButton className="btn-primary w-full">Colocar na lista</SubmitButton>
        </ActionForm>
      ) : (
        <p className="card text-sm text-slate-600">{status.reason}.</p>
      )}

      {event.listPublicSignup && status.open && (
        <div className="card space-y-2">
          <p className="font-semibold">Seu link para divulgar</p>
          <p className="text-sm text-slate-600">Mande no Instagram ou WhatsApp: a própria pessoa coloca o nome na sua lista.</p>
          <p className="break-all rounded-lg bg-slate-50 p-2 font-mono text-xs text-slate-700">{publicLink}</p>
          <CopyButton text={publicLink} />
        </div>
      )}

      <section className="card p-0">
        <h2 className="section-title p-4 pb-2">Seus nomes</h2>
        <ul className="divide-y divide-slate-100">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{e.name}</p>
                {e.doorSale ? (
                  <p className="text-xs text-emerald-700">
                    Entrou às {time(e.doorSale.createdAt)} · {e.doorSale.method === "FREE" ? "cortesia" : `${brl(e.doorSale.amountCents)} (${METHOD_LABEL[e.doorSale.method]})`} · você recebe{" "}
                    {brl(e.doorSale.commissionCents)}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">{e.source === "PUBLIC" ? "Colocou pelo seu link" : "Na lista"}</p>
                )}
              </div>
              {!e.doorSale && status.open && (
                <form action={promoterRemoveName.bind(null, params.token, event.id, e.id)}>
                  <button className="text-xs text-slate-500 hover:text-red-700">Remover</button>
                </form>
              )}
            </li>
          ))}
          {walkIns.map((w) => (
            <li key={w.id} className="px-4 py-2.5">
              <p className="font-medium">{w.name}</p>
              <p className="text-xs text-emerald-700">
                Entrou na porta indicado por você às {time(w.createdAt)} · você recebe {brl(w.commissionCents)}
              </p>
            </li>
          ))}
          {entries.length + walkIns.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Nenhum nome ainda</li>}
        </ul>
      </section>
    </div>
  );
}
