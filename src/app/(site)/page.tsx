import type { Coupon } from "@prisma/client";
import { headers } from "next/headers";
import { CouponBox } from "@/components/CouponBox";
import { EventRow, type EventRowData } from "@/components/EventRow";
import { HeroCarousel, type Slide } from "@/components/HeroCarousel";
import { MailIcon, ShieldIcon } from "@/components/Icons";
import { db } from "@/lib/db";
import { brl, dateTime } from "@/lib/format";
import { couponDiscount, currentBatch } from "@/lib/pricing";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: { q?: string; cupom?: string } }) {
  const q = searchParams.q?.trim();
  const couponCode = searchParams.cupom?.trim().toUpperCase().slice(0, 40) || undefined;
  const now = new Date();

  const events = await db.event.findMany({
    where: {
      status: "PUBLISHED",
      producer: { status: "APPROVED" },
      startsAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { venueName: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { startsAt: "asc" },
    take: 60,
    include: { ticketTypes: { where: { active: true }, include: { batches: true } } },
  });

  // Cupom digitado (ou vindo do link do influencer): em quais eventos da lista ele vale?
  const coupons = new Map<string, Coupon>();
  if (couponCode && rateLimit(`home-coupon:${clientIp(new Request("http://x", { headers: headers() }))}`, 30, 60_000)) {
    const found = await db.coupon.findMany({
      where: { code: couponCode, active: true, eventId: { in: events.map((e) => e.id) }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
    });
    for (const c of found) if (c.maxUses == null || c.uses < c.maxUses) coupons.set(c.eventId, c);
  }
  const firstCoupon = Array.from(coupons.values())[0];
  const discountText = firstCoupon ? (firstCoupon.discountType === "PERCENT" ? `${firstCoupon.value}% de desconto` : `${brl(firstCoupon.value)} de desconto`) : undefined;

  const rows = events.map((e) => {
    const coupon = coupons.get(e.id) ?? null;
    const current = e.ticketTypes.map((t) => currentBatch(t.batches, now)).filter((b): b is NonNullable<typeof b> => b != null);
    const prices = current.map((b) => b.priceCents);
    const fromCents = prices.length ? Math.min(...prices) : null;
    const discountedCents = coupon && fromCents != null && fromCents > 0 ? fromCents - couponDiscount(coupon, fromCents) : null;

    // Contagem: o que acaba primeiro (lote, cupom) ou, se nada acaba antes, o começo do evento
    const candidates: { date: Date; label: string }[] = [];
    for (const b of current) if (b.salesEnd && b.salesEnd > now) candidates.push({ date: b.salesEnd, label: "Este lote acaba em" });
    if (coupon?.validUntil && coupon.validUntil > now) candidates.push({ date: coupon.validUntil, label: "Seu cupom expira em" });
    candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
    const next = candidates[0];
    const countdown = next
      ? { target: next.date.toISOString(), label: next.label, endedText: "Encerrado" }
      : e.startsAt > now
        ? { target: e.startsAt.toISOString(), label: "O rolê começa em", endedText: "Rolando agora 🔥" }
        : null;

    const row: EventRowData = {
      href: `/evento/${e.slug}${coupon ? `?cupom=${encodeURIComponent(coupon.code)}` : ""}`,
      title: e.title,
      venueName: e.venueName,
      address: e.address,
      city: e.city,
      state: e.state,
      startsAt: e.startsAt,
      bannerUrl: e.bannerUrl,
      accentColor: e.accentColor,
      minAge: e.minAge,
      fromCents,
      discountedCents,
      couponCode: coupon?.code ?? null,
      soldOut: current.length === 0,
      countdown,
    };
    return row;
  });

  // Destaques do carrossel: prefere eventos com foto
  const withBanner = events.filter((e) => e.bannerUrl);
  const slides: Slide[] = (withBanner.length ? withBanner : events).slice(0, 6).map((e) => {
    const r = rows[events.indexOf(e)];
    const price = r.discountedCents ?? r.fromCents;
    return {
      slug: e.slug,
      href: r.href,
      title: e.title,
      when: dateTime(e.startsAt),
      where: `${e.venueName} · ${e.city}/${e.state}`,
      image: e.bannerUrl,
      accent: e.accentColor,
      price: r.soldOut ? null : price == null ? null : price === 0 ? "Grátis" : `a partir de ${brl(price)}`,
    };
  });

  const couponBox = <CouponBox code={couponCode} q={q} matches={coupons.size} discountText={discountText} />;

  return (
    <div>
      {!q && slides.length > 0 && (
        <section className="container-page pt-5">
          <HeroCarousel slides={slides} />
        </section>
      )}

      <section className="container-page pb-4 pt-8 sm:pt-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              Ingressos para os melhores <span className="text-brand-700">rolês</span> da cidade
            </h1>
            <p className="max-w-xl text-base text-slate-600 sm:text-lg">Baladas, bares e festas. Pague com Pix ou cartão e receba o ingresso no e-mail na hora.</p>
          </div>
          <form className="flex w-full gap-2 lg:max-w-md" action="/">
            {couponCode && <input type="hidden" name="cupom" value={couponCode} />}
            <input name="q" defaultValue={q} placeholder="Buscar por evento, casa ou cidade" className="input py-3" aria-label="Buscar eventos" />
            <button className="btn-primary px-6">Buscar</button>
          </form>
        </div>
      </section>

      <section className="container-page grid gap-8 pb-12 pt-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-5">
          <div className="lg:hidden">{couponBox}</div>
          <h2 className="text-2xl font-bold">{q ? `Resultados para "${q}"` : "Próximos eventos"}</h2>
          {rows.length === 0 ? <p className="card text-slate-600">Nenhum evento encontrado.</p> : rows.map((r, i) => <EventRow key={events[i].id} e={r} />)}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="hidden lg:block">{couponBox}</div>
          <ul className="space-y-3 text-sm">
            {[
              [<ShieldIcon key="s" className="h-6 w-6 shrink-0 text-emerald-600" />, "Compra segura", "Pagamento processado por instituição autorizada pelo Banco Central."],
              [<MailIcon key="m" className="h-6 w-6 shrink-0 text-brand-700" />, "Ingresso na hora", "QR Code enviado para o seu e-mail assim que o pagamento é confirmado."],
              [<span key="p" className="grid h-6 w-6 shrink-0 place-items-center rounded bg-brand-50 text-[10px] font-bold text-brand-700">PIX</span>, "Pix, crédito e débito", "Parcele no cartão em até 6x sem juros."],
            ].map(([icon, title, text], i) => (
              <li key={i} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                {icon}
                <div>
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="text-slate-600">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </div>
  );
}
