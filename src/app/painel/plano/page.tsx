import { requireProducer } from "@/lib/auth";
import { env } from "@/lib/env";
import { dateTime } from "@/lib/format";
import { effectivePlan, feePercentFor, isTrialActive, LIMIT_LABEL, limitsFor, PLAN_LABEL, PLAN_LIMITS, planUsage, type LimitKey } from "@/lib/plans";

const fmt = (n: number | null) => (n == null ? "Ilimitado" : n.toLocaleString("pt-BR"));

const PRO_EXTRAS = [
  "Portaria, promoters e nomes na lista ilimitados",
  "Taxa por ingresso negociável para o volume da sua casa",
  "Atendimento prioritário na noite do evento",
  "Relatórios avançados e exportação em planilha (em breve)",
  "Fechamento de comissões dos promoters (em breve)",
  "Pixel do Meta e Google Analytics por evento (em breve)",
  "Equipe com permissões: gerente, financeiro, marketing (em breve)",
];

export default async function PlanPage({ searchParams }: { searchParams: { limite?: string } }) {
  const producer = await requireProducer();
  const usage = await planUsage(producer.id);
  const limits = limitsFor(producer);
  const eff = effectivePlan(producer);
  const trial = isTrialActive(producer);
  const hit = searchParams.limite as LimitKey | undefined;
  const contact = `mailto:${env.supportEmail}?subject=${encodeURIComponent(`Plano Pro - ${producer.name}`)}`;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Meu plano</h1>
        <p className="text-slate-600">
          Você está no plano <b>{PLAN_LABEL[eff]}</b>
          {trial && producer.proTrialUntil && (
            <>
              {" "}
              (demonstração liberada até <b>{dateTime(producer.proTrialUntil)}</b>; depois volta para o {PLAN_LABEL[producer.plan]})
            </>
          )}
          . Taxa por ingresso: <b>{feePercentFor(producer).toLocaleString("pt-BR")}%</b>.
        </p>
      </div>

      {hit && LIMIT_LABEL[hit] && (
        <div className="card border-amber-200 bg-amber-50 text-amber-900">
          Você chegou ao limite de <b>{LIMIT_LABEL[hit]}</b> do seu plano. Fale com a gente para liberar mais.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {(["staff", "promoters", "listNames"] as LimitKey[]).map((k) => {
          const lim = limits[k];
          const used = usage[k];
          const pct = lim ? Math.min(100, Math.round((used / lim) * 100)) : 0;
          return (
            <div key={k} className="card">
              <p className="text-xs uppercase text-slate-500">{LIMIT_LABEL[k]}</p>
              <p className="mt-1 text-2xl font-extrabold">
                {used} <span className="text-base font-normal text-slate-500">/ {fmt(lim)}</span>
              </p>
              {lim != null && (
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-400"}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              {(["FREE", "PLUS", "PRO"] as const).map((pl) => (
                <th key={pl} className={`text-center ${pl === eff ? "bg-brand-100 text-slate-900" : ""}`}>
                  {PLAN_LABEL[pl]}
                  {pl === eff && " (atual)"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["staff", "promoters", "listNames"] as LimitKey[]).map((k) => (
              <tr key={k}>
                <td className="font-medium first-letter:uppercase">{LIMIT_LABEL[k]}</td>
                {(["FREE", "PLUS", "PRO"] as const).map((pl) => (
                  <td key={pl} className="text-center">
                    {fmt(PLAN_LIMITS[pl][k])}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="font-medium">Venda online, Pix, cartão, QR Code e e-mail</td>
              <td className="text-center">✓</td>
              <td className="text-center">✓</td>
              <td className="text-center">✓</td>
            </tr>
            <tr>
              <td className="font-medium">Recursos exclusivos (abaixo)</td>
              <td className="text-center">-</td>
              <td className="text-center">-</td>
              <td className="text-center">✓</td>
            </tr>
          </tbody>
        </table>
      </section>

      {eff !== "PRO" || trial ? (
        <section className="card space-y-3 border-brand-200 bg-brand-50">
          <h2 className="section-title">O que o Pro libera para a sua casa</h2>
          <ul className="list-disc space-y-1 pl-5 text-slate-700">
            {PRO_EXTRAS.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <a href={contact} className="btn-primary">
            Quero o plano Pro
          </a>
        </section>
      ) : (
        <section className="card text-slate-700">Sua casa está no Pro. Obrigado pela parceria! Dúvidas: {env.supportEmail}</section>
      )}
    </div>
  );
}
