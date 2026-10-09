import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { accentVars } from "@/lib/content";
import { db } from "@/lib/db";
import { brl, dateTime } from "@/lib/format";
import { listOpen } from "@/lib/guestlist";
import { publicListSignup } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nome na lista", robots: { index: false } };

export default async function ListSignupPage({ params, searchParams }: { params: { slug: string }; searchParams: { p?: string } }) {
  const event = await db.event.findUnique({ where: { slug: params.slug }, include: { producer: { select: { status: true } } } });
  if (!event || event.status === "DRAFT" || event.producer.status !== "APPROVED" || !event.listEnabled) notFound();
  const code = searchParams.p?.trim() || null;
  const adv = code ? await db.advertiser.findFirst({ where: { publicCode: code, producerId: event.producerId, active: true } }) : null;
  const status = listOpen(event);

  return (
    <div className="container-page max-w-md py-10" style={accentVars(event.accentColor)}>
      <div className="card space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--accent-ink)]">{dateTime(event.startsAt)}</p>
          <h1 className="text-2xl font-extrabold">{event.title}</h1>
          <p className="text-sm text-slate-600">{event.venueName}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 text-sm">
          <p className="text-lg font-bold">Nome na lista{adv ? ` do ${adv.name}` : ""}</p>
          <p className="text-slate-700">
            Na lista você paga <b>{event.listPriceCents != null ? brl(event.listPriceCents) : "-"}</b> na portaria
            {event.listValidUntil && <> até <b>{dateTime(event.listValidUntil)}</b></>}.
          </p>
          {event.doorPriceCents != null && <p className="text-slate-500">Sem lista: {brl(event.doorPriceCents)}.</p>}
        </div>
        {!event.listPublicSignup ? (
          <p className="text-sm text-slate-600">Para entrar na lista deste evento, fale com um promoter da casa.</p>
        ) : status.open ? (
          <ActionForm action={publicListSignup.bind(null, event.id, adv?.publicCode ?? null)} className="space-y-3">
            <div>
              <label className="label" htmlFor="name">
                Nome completo
              </label>
              <input id="name" name="name" className="input" required autoComplete="name" placeholder="Nome e sobrenome" />
            </div>
            <div>
              <label className="label" htmlFor="phone">
                WhatsApp (opcional)
              </label>
              <input id="phone" name="phone" className="input" inputMode="tel" autoComplete="tel" />
            </div>
            <SubmitButton className="btn-accent w-full py-3 text-base">Colocar meu nome na lista</SubmitButton>
            <p className="text-xs text-slate-500">Evento para maiores de {event.minAge} anos. Leve documento com foto: o nome é conferido na entrada.</p>
          </ActionForm>
        ) : (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{status.reason}.</p>
        )}
        <Link href={`/evento/${event.slug}`} className="block text-center text-sm text-slate-600 underline">
          Prefere garantir o ingresso agora? Compre pelo site
        </Link>
      </div>
    </div>
  );
}
