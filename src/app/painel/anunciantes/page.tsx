import { ActionForm } from "@/components/ActionForm";
import { CommissionFields } from "@/components/CommissionFields";
import { SubmitButton } from "@/components/SubmitButton";
import { requireProducer } from "@/lib/auth";
import { db } from "@/lib/db";
import { brl } from "@/lib/format";
import { formatCommission } from "@/lib/pricing";
import { limitsFor } from "@/lib/plans";
import { CopyButton } from "@/components/CopyButton";
import { env } from "@/lib/env";
import { createAdvertiser, regenerateAdvertiserLink, toggleAdvertiser, updateAdvertiserCommission } from "../actions";

export default async function AdvertisersPage() {
  const producer = await requireProducer();
  const [advertisers, stats] = await Promise.all([
    db.advertiser.findMany({
      where: { producerId: producer.id },
      orderBy: { name: "asc" },
      include: { coupons: { include: { event: { select: { title: true } } } } },
    }),
    db.order.groupBy({
      by: ["advertiserId"],
      where: { status: "PAID", advertiserId: { not: null }, event: { producerId: producer.id } },
      _sum: { producerCents: true, totalCents: true, commissionCents: true },
      _count: true,
    }),
  ]);
  const door = await db.doorSale.groupBy({
    by: ["advertiserId"],
    where: { advertiserId: { not: null }, event: { producerId: producer.id } },
    _count: true,
    _sum: { commissionCents: true, amountCents: true },
  });
  const totalCommission =
    stats.reduce((s, x) => s + (x._sum.commissionCents ?? 0), 0) + door.reduce((s, x) => s + (x._sum.commissionCents ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Anunciantes e promoters</h1>
        <p className="text-sm text-slate-600">
          Cadastre quem divulga seus eventos e defina a comissão de cada um. Ele ganha por duas vias: <b>vendas pelo site</b> com o cupom dele (aba
          &quot;Cupons&quot; do evento) e <b>entradas na porta</b> de quem estava na lista dele ou disse que veio por ele. Cada promoter tem um link
          da área dele para colocar nomes na lista e acompanhar a comissão. Você paga a comissão diretamente ao promoter.
        </p>
      </div>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="section-title">Novo anunciante</h2>
          <p className="text-sm text-slate-500">
            {advertisers.filter((a) => a.active).length} de {limitsFor(producer).promoters ?? "ilimitados"} ativos no seu plano ·{" "}
            <a href="/painel/plano" className="font-medium text-brand-700 underline">
              meu plano
            </a>
          </p>
        </div>
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-slate-700">
          A comissão aqui é o valor que <strong>a sua casa paga ao promoter</strong> pelas vendas dele. Ela não muda a taxa de serviço do
          Quackpass, que é definida pela plataforma.
        </p>
        <ActionForm action={createAdvertiser} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Nome</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">Instagram</label>
            <input name="instagram" className="input" placeholder="@usuario" />
          </div>
          <div>
            <label className="label">Celular</label>
            <input name="phone" className="input" />
          </div>
          <div>
            <label className="label">E-mail (opcional)</label>
            <input name="email" type="email" className="input" />
          </div>
          <CommissionFields placeholder="Ex.: 10 (vazio = sem comissão)" label="Comissão do promoter (vendas pelo site)" />
          <CommissionFields prefix="listCommission" placeholder="Ex.: 3 (vazio = mesma do site)" label="Comissão do promoter (lista / porta)" defaultType="FIXED" />
          <div className="flex items-end">
            <SubmitButton className="btn-primary w-full">Cadastrar</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between p-4">
          <h2 className="section-title">Resultados</h2>
          <p className="text-sm text-slate-600">
            Total de comissões: <b>{brl(totalCommission)}</b>
          </p>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Anunciante</th>
              <th>Cupons</th>
              <th className="text-right">Site</th>
              <th className="text-right">Porta / lista</th>
              <th className="text-right">Comissão a pagar</th>
              <th>Comissões</th>
              <th>Área do promoter</th>
            </tr>
          </thead>
          <tbody>
            {advertisers.map((a) => {
              const s = stats.find((x) => x.advertiserId === a.id);
              const d = door.find((x) => x.advertiserId === a.id);
              const promoterLink = `${env.appUrl}/promoter/${a.accessToken}`;
              return (
                <tr key={a.id} className={`align-top ${a.active ? "" : "opacity-50"}`}>
                  <td>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-slate-500">{[a.instagram, a.phone, a.email].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="text-xs">
                    {a.coupons.map((c) => (
                      <p key={c.id}>
                        <span className="font-mono font-semibold">{c.code}</span> <span className="text-slate-500">({c.event.title})</span>
                      </p>
                    ))}
                    {a.coupons.length === 0 && <span className="text-slate-500">nenhum</span>}
                  </td>
                  <td className="text-right">
                    {s?._count ?? 0} pedido(s)
                    <p className="text-xs text-slate-500">{brl(s?._sum.totalCents ?? 0)}</p>
                  </td>
                  <td className="text-right">
                    {d?._count ?? 0} entrada(s)
                    <p className="text-xs text-slate-500">{brl(d?._sum.amountCents ?? 0)}</p>
                  </td>
                  <td className="text-right font-semibold">{brl((s?._sum.commissionCents ?? 0) + (d?._sum.commissionCents ?? 0))}</td>
                  <td className="min-w-[260px]">
                    <p className="text-xs text-slate-500">Site: {formatCommission(a)}</p>
                    <p className="mb-1 text-xs text-slate-500">
                      Lista/porta:{" "}
                      {a.listCommissionValue != null
                        ? a.listCommissionType === "FIXED"
                          ? `${brl(a.listCommissionValue)} por pessoa`
                          : formatCommission({ commissionType: "PERCENT", commissionValue: a.listCommissionValue })
                        : "igual ao site"}
                    </p>
                    <details>
                      <summary className="cursor-pointer text-xs font-medium text-brand-700">Alterar</summary>
                      <ActionForm action={updateAdvertiserCommission.bind(null, a.id)} className="mt-2 space-y-2">
                        <CommissionFields type={a.commissionType} value={a.commissionValue} label="Site" />
                        <CommissionFields prefix="listCommission" type={a.listCommissionType} value={a.listCommissionValue} label="Lista / porta (vazio = igual ao site)" defaultType="FIXED" />
                        <SubmitButton className="btn-secondary px-3 py-1.5 text-xs">Salvar</SubmitButton>
                      </ActionForm>
                    </details>
                  </td>
                  <td className="min-w-[200px] space-y-1">
                    <CopyButton text={promoterLink} label="Copiar link do promoter" />
                    <div className="flex gap-2 text-xs">
                      <form action={regenerateAdvertiserLink.bind(null, a.id)}>
                        <button className="text-slate-500 hover:text-slate-900" title="O link antigo para de funcionar">
                          Gerar novo link
                        </button>
                      </form>
                      <form action={toggleAdvertiser.bind(null, a.id)}>
                        <button className="text-slate-500 hover:text-slate-900">{a.active ? "Desativar" : "Reativar"}</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {advertisers.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-slate-500">
                  Nenhum anunciante cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
