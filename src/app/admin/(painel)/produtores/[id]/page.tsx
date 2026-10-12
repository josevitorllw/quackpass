import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Stat } from "@/components/Stat";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { brl, dateTime } from "@/lib/format";
import { saveProducerNotes, setProducerStatus } from "../../../actions";
import { ProducerBadge, whatsappLink } from "../../ProducerBadge";
import { PlanCard } from "./PlanCard";

export default async function ProducerDetail({ params }: { params: { id: string } }) {
  const p = await db.producer.findUnique({
    where: { id: params.id },
    include: { events: { orderBy: { startsAt: "desc" }, take: 50 } },
  });
  if (!p) notFound();
  const [sales, byEvent] = await Promise.all([
    db.order.aggregate({ where: { event: { producerId: p.id }, status: "PAID" }, _sum: { totalCents: true, platformCents: true }, _count: true }),
    db.order.groupBy({ by: ["eventId"], where: { event: { producerId: p.id }, status: "PAID" }, _sum: { totalCents: true }, _count: true }),
  ]);
  const act = (s: "APPROVED" | "REJECTED" | "BLOCKED") => setProducerStatus.bind(null, p.id, s);
  const first = p.contactName.split(" ")[0] || p.name;

  const info: [string, React.ReactNode][] = [
    ["Responsável", p.contactName],
    ["WhatsApp", p.phone],
    ["E-mail", <a key="e" href={`mailto:${p.email}`} className="text-brand-700 underline">{p.email}</a>],
    ["CPF/CNPJ", p.document],
    ["Cidade", [p.city, p.state].filter(Boolean).join("/")],
    ["Instagram", p.instagram ? <a key="i" href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">@{p.instagram}</a> : "-"],
    ["Tipo", p.venueType ?? "-"],
    ["Eventos por mês", p.eventsPerMonth ?? "-"],
    ["Conta de recebimento", p.recipientId ? "Cadastrada" : "Não cadastrada"],
    ["Cadastro", dateTime(p.createdAt)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/produtores" className="text-sm text-slate-500">
            ← Produtores
          </Link>
          <h1 className="text-2xl font-extrabold">{p.name}</h1>
          <ProducerBadge status={p.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={whatsappLink(p.phone, `Olá, ${first}! Aqui é da ${env.companyName}, recebemos o cadastro da ${p.name}. Podemos conversar?`)} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            Chamar no WhatsApp
          </a>
          {p.status !== "APPROVED" && (
            <form action={act("APPROVED")}>
              <button className="btn bg-emerald-600 text-white hover:bg-emerald-700">{p.status === "BLOCKED" ? "Desbloquear e aprovar" : "Aprovar cadastro"}</button>
            </form>
          )}
          {p.status === "PENDING" && (
            <form action={act("REJECTED")}>
              <button className="btn-secondary">Recusar</button>
            </form>
          )}
          {p.status !== "BLOCKED" && (
            <form action={act("BLOCKED")}>
              <button className="btn-danger">Bloquear</button>
            </form>
          )}
        </div>
      </div>
      {p.status === "PENDING" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Ao aprovar, o produtor recebe um e-mail e já pode criar e publicar eventos. Bloquear tira todos os eventos dele do ar na hora.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="card">
          <h2 className="section-title mb-3">Dados do cadastro</h2>
          <dl className="grid grid-cols-[150px_1fr] gap-y-2 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {p.message && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">“{p.message}”</p>}
        </section>
        <section className="card">
          <h2 className="section-title mb-1">Anotações internas</h2>
          <p className="mb-3 text-xs text-slate-500">Só você vê. Ex.: resumo da conversa, condições combinadas, documentos recebidos.</p>
          <ActionForm action={saveProducerNotes.bind(null, p.id)} className="space-y-2">
            <textarea name="notes" defaultValue={p.adminNotes} className="input min-h-40" />
            <SubmitButton className="btn-secondary">Salvar anotações</SubmitButton>
          </ActionForm>
        </section>
      </div>

      <PlanCard producer={p} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Vendido" value={brl(sales._sum.totalCents ?? 0)} hint={`${sales._count} pedidos`} />
        <Stat label="Sua receita com ele" value={brl(sales._sum.platformCents ?? 0)} />
        <Stat label="Eventos" value={String(p.events.length)} />
      </div>

      <section className="card overflow-x-auto p-0">
        <h2 className="section-title p-4 pb-2">Eventos</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Evento</th>
              <th>Data</th>
              <th>Status</th>
              <th className="text-right">Pedidos</th>
              <th className="text-right">Vendido</th>
            </tr>
          </thead>
          <tbody>
            {p.events.map((e) => {
              const s = byEvent.find((x) => x.eventId === e.id);
              return (
                <tr key={e.id}>
                  <td>
                    <a href={`${env.appUrl}/evento/${e.slug}`} target="_blank" className="font-medium hover:text-brand-700">
                      {e.title}
                    </a>
                  </td>
                  <td className="text-slate-500">{dateTime(e.startsAt)}</td>
                  <td className="text-xs">{e.status}</td>
                  <td className="text-right">{s?._count ?? 0}</td>
                  <td className="text-right">{brl(s?._sum.totalCents ?? 0)}</td>
                </tr>
              );
            })}
            {p.events.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-500">
                  Nenhum evento
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
