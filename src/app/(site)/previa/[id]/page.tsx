import Link from "next/link";
import { Suspense } from "react";
import { Checkout } from "@/app/(site)/evento/[slug]/Checkout";
import { EventView } from "@/components/EventView";
import { requireOwnedEvent } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkoutConfig, ticketTypesForCheckout } from "@/lib/event-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pré-visualização", robots: { index: false } };

/** Pré-visualização para o produtor (funciona com o evento ainda em rascunho). */
export default async function PreviewPage({ params }: { params: { id: string } }) {
  const { event, producer } = await requireOwnedEvent(params.id);
  const types = await db.ticketType.findMany({ where: { eventId: event.id, active: true }, orderBy: { sortOrder: "asc" }, include: { batches: true } });
  return (
    <EventView
      event={event}
      producer={producer}
      notice={
        <div className="border-b border-amber-200 bg-amber-50 py-2 text-center text-sm text-amber-900">
          Pré-visualização: só você vê esta página enquanto o evento não for publicado.{" "}
          <Link href={`/painel/eventos/${event.id}/editar`} className="font-semibold underline">
            Voltar a editar
          </Link>
        </div>
      }
      sidebar={
        <Suspense>
          <Checkout eventId={event.id} ticketTypes={ticketTypesForCheckout(types)} feePayer={event.feePayer} {...checkoutConfig(producer)} preview />
        </Suspense>
      }
    />
  );
}
