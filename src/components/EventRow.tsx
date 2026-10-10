import Link from "next/link";
import { brl, dateTime, dayMonth } from "@/lib/format";
import { Countdown } from "./Countdown";
import { PinIcon, TagIcon, TicketIcon } from "./Icons";

export type EventRowData = {
  href: string;
  title: string;
  venueName: string;
  address: string;
  city: string;
  state: string;
  startsAt: Date;
  bannerUrl: string | null;
  accentColor: string;
  minAge: number;
  fromCents: number | null;
  /** Preço "a partir de" já com o cupom aplicado (só quando há cupom) */
  discountedCents: number | null;
  couponCode: string | null;
  soldOut: boolean;
  countdown: { target: string; label: string; endedText: string } | null;
};

/** Linha de evento estilo "vitrine": foto à esquerda, informações no meio, preço + contagem + botão à direita. */
export function EventRow({ e }: { e: EventRowData }) {
  const { day, month } = dayMonth(e.startsAt);
  const price = e.discountedCents ?? e.fromCents;
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl sm:flex-row">
      <Link href={e.href} className="relative block aspect-[16/9] shrink-0 overflow-hidden sm:aspect-auto sm:min-h-[210px] sm:w-[280px] lg:w-[320px]" tabIndex={-1} aria-hidden>
        {e.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${e.accentColor}, #0f172a 90%)` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />
        <div className="absolute left-3 top-3 rounded-xl bg-white px-2.5 py-1.5 text-center leading-none shadow-md">
          <p className="text-xl font-black text-slate-900">{day}</p>
          <p className="mt-0.5 text-[10px] font-extrabold tracking-wider text-brand-700">{month}</p>
        </div>
        {e.soldOut && <span className="absolute bottom-3 left-3 rounded-full bg-red-600 px-3 py-1 text-xs font-extrabold uppercase text-white">Esgotado</span>}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-700">{dateTime(e.startsAt)}</p>
        <h3 className="line-clamp-2 text-xl font-extrabold leading-snug text-slate-900 sm:text-2xl">
          <Link href={e.href} className="hover:text-brand-700">
            {e.title}
          </Link>
        </h3>
        <p className="flex items-start gap-1.5 text-sm text-slate-600">
          <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>
            <b className="text-slate-800">{e.venueName}</b>
            <br />
            {e.address} · {e.city}/{e.state}
          </span>
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="badge bg-slate-100 text-slate-700">+{e.minAge}</span>
          {e.couponCode && (
            <span className="badge gap-1 bg-emerald-100 text-emerald-800">
              <TagIcon className="h-3 w-3" /> Cupom {e.couponCode} aplicado
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col justify-between gap-4 border-t border-slate-100 bg-slate-50/80 p-5 sm:w-[230px] sm:border-l sm:border-t-0">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{e.discountedCents != null ? "Com seu cupom" : "A partir de"}</p>
          {price == null ? (
            <p className="text-lg font-bold text-slate-500">Ver valores</p>
          ) : (
            <p className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight text-slate-900">{price === 0 ? "Grátis" : brl(price)}</span>
              {e.discountedCents != null && e.fromCents != null && <span className="text-sm text-slate-400 line-through">{brl(e.fromCents)}</span>}
            </p>
          )}
        </div>
        {e.countdown && !e.soldOut && <Countdown target={e.countdown.target} label={e.countdown.label} endedText={e.countdown.endedText} />}
        {e.soldOut ? (
          <Link href={e.href} className="btn-secondary w-full">
            Ver evento
          </Link>
        ) : (
          <Link href={e.href} className="btn-cta w-full">
            <TicketIcon /> Garantir ingresso
          </Link>
        )}
      </div>
    </article>
  );
}
