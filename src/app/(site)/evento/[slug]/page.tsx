import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventView } from "@/components/EventView";
import { ListCta } from "@/components/ListCta";
import { brl, dateTime } from "@/lib/format";
import { listOpen } from "@/lib/guestlist";
import { db } from "@/lib/db";
import { checkoutConfig, ticketTypesForCheckout } from "@/lib/event-page";
import { Checkout } from "./Checkout";

// ISR: a página é servida do cache e regerada a cada 15s. O estoque real é
// sempre conferido no checkout, então o cache nunca causa venda a mais.
export const revalidate = 15;

// Nenhuma página gerada no build: cada evento é gerado no 1º acesso e depois servido do cache
export async function generateStaticParams() {
  return [];
}

async function getEvent(slug: string) {
  return db.event.findUnique({
    where: { slug },
    include: {
      producer: { select: { name: true, status: true } },
      ticketTypes: { where: { active: true }, orderBy: { sortOrder: "asc" }, include: { batches: true } },
    },
  });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const event = await getEvent(params.slug);
  if (!event || event.status === "DRAFT") return {};
  return {
    title: event.title,
    description: `${event.venueName} · ${event.city}/${event.state}`,
    openGraph: { title: event.title, images: event.bannerUrl ? [event.bannerUrl] : [] },
  };
}

export default async function EventPage({ params }: { params: { slug: string } }) {
  const event = await getEvent(params.slug);
  if (!event || event.status === "DRAFT" || event.producer.status === "BLOCKED") notFound();

  const ended = (event.endsAt ?? event.startsAt) < new Date();
  const salesOpen = event.status === "PUBLISHED" && event.producer.status === "APPROVED" && !ended;

  return (
    <EventView
      event={event}
      producer={event.producer}
      sidebar={
        <>
          {salesOpen ? (
            <Suspense fallback={<div className="card h-64 animate-pulse" />}>
              <Checkout eventId={event.id} ticketTypes={ticketTypesForCheckout(event.ticketTypes)} feePayer={event.feePayer} {...checkoutConfig()} />
            </Suspense>
          ) : (
            <div className="card text-slate-600">{ended ? "As vendas deste evento foram encerradas." : "Vendas indisponíveis."}</div>
          )}
          {listOpen(event).open && event.listPublicSignup && event.listPriceCents != null && (
            <Suspense>
              <ListCta slug={event.slug} priceLabel={brl(event.listPriceCents)} untilLabel={event.listValidUntil ? dateTime(event.listValidUntil) : null} />
            </Suspense>
          )}
        </>
      }
    />
  );
}
