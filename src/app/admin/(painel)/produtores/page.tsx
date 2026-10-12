import Link from "next/link";
import type { Prisma, ProducerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { effectivePlan, isTrialActive, PLAN_LABEL } from "@/lib/plans";
import { ProducerBadge, whatsappLink } from "../ProducerBadge";

const FILTERS: [string, string][] = [
  ["PENDING", "Aguardando"],
  ["APPROVED", "Aprovados"],
  ["REJECTED", "Recusados"],
  ["BLOCKED", "Bloqueados"],
  ["", "Todos"],
];

export default async function ProducersPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const status = (["PENDING", "APPROVED", "REJECTED", "BLOCKED"].includes(searchParams.status ?? "") ? searchParams.status : undefined) as ProducerStatus | undefined;
  const q = searchParams.q?.trim();
  const where: Prisma.ProducerWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { contactName: { contains: q, mode: "insensitive" } },
            { email: { contains: q.toLowerCase() } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const producers = await db.producer.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { events: true } } } });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Produtores</h1>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([v, label]) => (
          <Link
            key={v}
            href={`/admin/produtores${v ? `?status=${v}` : ""}`}
            className={`rounded-full px-3 py-1.5 text-sm ${(status ?? "") === v ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {label}
          </Link>
        ))}
        <form className="ml-auto flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Nome, e-mail ou cidade" className="input w-56 py-2" />
          <button className="btn-secondary py-2">Buscar</button>
        </form>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Casa / produtora</th>
              <th>Contato</th>
              <th>Cidade</th>
              <th>Cadastro</th>
              <th>Status</th>
              <th>Plano</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {producers.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/produtores/${p.id}`} className="font-semibold hover:text-brand-700">
                    {p.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {p.venueType ?? ""} {p._count.events > 0 && `· ${p._count.events} evento(s)`}
                  </p>
                </td>
                <td>
                  <p>{p.contactName}</p>
                  <p className="text-xs text-slate-500">{p.email}</p>
                </td>
                <td className="text-slate-600">{[p.city, p.state].filter(Boolean).join("/")}</td>
                <td className="whitespace-nowrap text-slate-500">{dateTime(p.createdAt)}</td>
                <td>
                  <ProducerBadge status={p.status} />
                </td>
                <td className="whitespace-nowrap text-sm">
                  {PLAN_LABEL[effectivePlan(p)]}
                  {isTrialActive(p) && <span className="ml-1 badge bg-brand-100 text-brand-800">demonstração</span>}
                </td>
                <td className="whitespace-nowrap text-right">
                  <a
                    href={whatsappLink(p.phone, `Olá, ${p.contactName.split(" ")[0]}! Aqui é da Quackpass, recebemos o cadastro da ${p.name}.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    WhatsApp
                  </a>
                </td>
              </tr>
            ))}
            {producers.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-500">
                  Nenhum produtor
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
