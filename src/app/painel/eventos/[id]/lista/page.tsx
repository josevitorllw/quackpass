import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { addListNamesAction, removeListEntryAction, updateListSettings } from "@/app/painel/actions";
import { requireOwnedEvent } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { brl, dateTime, toLocalInput } from "@/lib/format";
import { listOpen, listStatsByPromoter, METHOD_LABEL } from "@/lib/guestlist";

const money = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
const time = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

export default async function ListPage({ params, searchParams }: { params: { id: string }; searchParams: { q?: string } }) {
  const { event, producer } = await requireOwnedEvent(params.id);
  const q = searchParams.q?.trim();
  const [advertisers, stats, entries, totalEntries, walkIns, doorTotals] = await Promise.all([
    db.advertiser.findMany({ where: { producerId: producer.id }, orderBy: { name: "asc" } }),
    listStatsByPromoter(event.id),
    db.guestListEntry.findMany({
      where: { eventId: event.id, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
      orderBy: { name: "asc" },
      take: 300,
      include: { advertiser: { select: { name: true } }, doorSale: true },
    }),
    db.guestListEntry.count({ where: { eventId: event.id } }),
    db.doorSale.findMany({ where: { eventId: event.id, guestListEntryId: null }, orderBy: { createdAt: "desc" }, take: 100, include: { advertiser: { select: { name: true } } } }),
    db.doorSale.aggregate({ where: { eventId: event.id }, _count: true, _sum: { amountCents: true, commissionCents: true } }),
  ]);
  const status = listOpen(event);
  const advName = (id: string | null) => (id ? advertisers.find((a) => a.id === id)?.name ?? "?" : "Lista da casa");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Nomes na lista</p>
          <p className="text-2xl font-extrabold">{totalEntries}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Entradas na porta</p>
          <p className="text-2xl font-extrabold">{doorTotals._count}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Recebido na porta</p>
          <p className="text-2xl font-extrabold">{brl(doorTotals._sum.amountCents ?? 0)}</p>
          <p className="text-xs text-slate-500">fora do site (balcão)</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Comissões a pagar</p>
          <p className="text-2xl font-extrabold">{brl(doorTotals._sum.commissionCents ?? 0)}</p>
        </div>
      </div>

      <section className="card">
        <h2 className="section-title">Configuração da lista</h2>
        <p className="mb-4 text-sm text-slate-500">
          Quem está na lista paga um valor menor <b>na portaria</b>. Cada promoter tem um link para colocar nomes, e a entrada de cada nome conta
          comissão para ele.
        </p>
        <ActionForm action={updateListSettings.bind(null, event.id)} className="grid gap-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 font-medium sm:col-span-3">
            <input type="checkbox" name="listEnabled" defaultChecked={event.listEnabled} className="h-4 w-4" /> Ativar lista neste evento
          </label>
          <div>
            <label className="label">Valor na lista (R$)</label>
            <input name="listPrice" className="input" inputMode="decimal" defaultValue={money(event.listPriceCents)} placeholder="20,00" />
          </div>
          <div>
            <label className="label">Valor na porta sem lista (R$)</label>
            <input name="doorPrice" className="input" inputMode="decimal" defaultValue={money(event.doorPriceCents)} placeholder="50,00" />
          </div>
          <div>
            <label className="label">Limite de nomes por promoter</label>
            <input name="listMaxPerPromoter" type="number" min={1} className="input" defaultValue={event.listMaxPerPromoter ?? ""} placeholder="Sem limite" />
          </div>
          <div>
            <label className="label">Nome na lista vale até</label>
            <input name="listValidUntil" type="datetime-local" className="input" defaultValue={toLocalInput(event.listValidUntil)} />
            <p className="hint">Depois disso, cobra o valor sem lista</p>
          </div>
          <div>
            <label className="label">Aceitar nomes até</label>
            <input name="listClosesAt" type="datetime-local" className="input" defaultValue={toLocalInput(event.listClosesAt)} />
            <p className="hint">Vazio = até o fim do evento</p>
          </div>
          <label className="flex items-center gap-2 self-center text-sm">
            <input type="checkbox" name="listPublicSignup" defaultChecked={event.listPublicSignup} className="h-4 w-4" /> A própria pessoa pode colocar o nome pelo site
          </label>
          <div className="sm:col-span-3">
            <SubmitButton>Salvar lista</SubmitButton>
          </div>
        </ActionForm>
      </section>

      {event.listEnabled && (
        <>
          <section className="card overflow-x-auto p-0">
            <div className="p-4 pb-2">
              <h2 className="section-title">Por promoter</h2>
              <p className="text-sm text-slate-500">
                {status.open ? "Lista aberta." : `${status.reason}.`} Envie para cada promoter o link da área dele (fica em Anunciantes).
              </p>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Promoter</th>
                  <th className="text-right">Nomes</th>
                  <th className="text-right">Entraram da lista</th>
                  <th className="text-right">Entradas (com indicações)</th>
                  <th className="text-right">Recebido na porta</th>
                  <th className="text-right">Comissão</th>
                  <th>Link público</th>
                </tr>
              </thead>
              <tbody>
                {advertisers.map((a) => {
                  const s = stats.find((x) => x.advertiserId === a.id);
                  return (
                    <tr key={a.id}>
                      <td className="font-medium">{a.name}</td>
                      <td className="text-right">{s?.names ?? 0}</td>
                      <td className="text-right">{s?.enteredFromList ?? 0}</td>
                      <td className="text-right">{s?.doorEntries ?? 0}</td>
                      <td className="text-right">{brl(s?.doorCents ?? 0)}</td>
                      <td className="text-right font-semibold">{brl(s?.commissionCents ?? 0)}</td>
                      <td>
                        <code className="select-all text-xs text-slate-500">
                          {env.appUrl}/evento/{event.slug}/lista?p={a.publicCode}
                        </code>
                      </td>
                    </tr>
                  );
                })}
                {(() => {
                  const s = stats.find((x) => x.advertiserId === null);
                  return s ? (
                    <tr>
                      <td className="text-slate-500">Lista da casa / sem promoter</td>
                      <td className="text-right">{s.names}</td>
                      <td className="text-right">{s.enteredFromList}</td>
                      <td className="text-right">{s.doorEntries}</td>
                      <td className="text-right">{brl(s.doorCents)}</td>
                      <td className="text-right">-</td>
                      <td></td>
                    </tr>
                  ) : null;
                })()}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2 className="section-title mb-3">Adicionar nomes</h2>
            <ActionForm action={addListNamesAction.bind(null, event.id)} className="grid gap-3 sm:grid-cols-[1fr_240px]">
              <textarea name="names" className="input min-h-28" placeholder={"Um nome por linha\nMaria Silva\nJoão Pereira"} required />
              <div className="space-y-3">
                <div>
                  <label className="label">Na lista de</label>
                  <select name="advertiserId" className="input" defaultValue="">
                    <option value="">Lista da casa</option>
                    {advertisers.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <SubmitButton className="btn-primary w-full">Adicionar</SubmitButton>
              </div>
            </ActionForm>
          </section>

          <section className="card overflow-x-auto p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-2">
              <h2 className="section-title">Nomes ({totalEntries})</h2>
              <form className="flex gap-2">
                <input name="q" defaultValue={q} placeholder="Buscar nome" className="input w-56 py-2" />
                <button className="btn-secondary py-2">Buscar</button>
              </form>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Lista de</th>
                  <th>Situação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="font-medium">{e.name}</td>
                    <td className="text-slate-600">{e.advertiser?.name ?? "Casa"}</td>
                    <td>
                      {e.doorSale ? (
                        <span className="text-emerald-700">
                          Entrou às {time(e.doorSale.createdAt)} · {e.doorSale.method === "FREE" ? "cortesia" : `${brl(e.doorSale.amountCents)} ${METHOD_LABEL[e.doorSale.method]}`}
                        </span>
                      ) : (
                        <span className="text-slate-500">Na lista</span>
                      )}
                    </td>
                    <td className="text-right">
                      {!e.doorSale && (
                        <form action={removeListEntryAction.bind(null, event.id, e.id)}>
                          <button className="text-xs text-slate-500 hover:text-red-700">Remover</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-slate-500">
                      Nenhum nome
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {walkIns.length > 0 && (
            <section className="card overflow-x-auto p-0">
              <h2 className="section-title p-4 pb-2">Vendas na porta sem lista</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Horário</th>
                    <th>Nome</th>
                    <th>Indicado por</th>
                    <th className="text-right">Valor</th>
                    <th>Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {walkIns.map((w) => (
                    <tr key={w.id}>
                      <td className="text-slate-500">{dateTime(w.createdAt)}</td>
                      <td>{w.name}</td>
                      <td>{advName(w.advertiserId)}</td>
                      <td className="text-right">
                        {w.method === "FREE" ? "Cortesia" : brl(w.amountCents)} <span className="text-xs text-slate-500">{w.method !== "FREE" && METHOD_LABEL[w.method]}</span>
                      </td>
                      <td className="text-slate-500">{w.staffName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
