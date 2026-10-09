import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { TopBar } from "../../TopBar";
import { Door } from "./Door";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check-in" };

export default async function StaffEventPage({ params }: { params: { id: string } }) {
  const staff = await requireStaff();
  const event = await db.event.findFirst({ where: { id: params.id, producerId: staff.producerId } });
  if (!event) notFound();
  const [used, total] = await Promise.all([
    db.ticket.count({ where: { eventId: event.id, status: "USED" } }),
    db.ticket.count({ where: { eventId: event.id, status: { not: "CANCELLED" } } }),
  ]);
  return (
    <div>
      <TopBar title={event.title} subtitle={dateTime(event.startsAt)} back="/portaria/eventos" />
      <main className="mx-auto max-w-2xl px-4 py-4">
        <Door eventId={event.id} initialUsed={used} total={total} hasList={event.listEnabled} />
      </main>
    </div>
  );
}
