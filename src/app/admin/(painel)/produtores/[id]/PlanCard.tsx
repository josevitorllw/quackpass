import type { Producer } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { env } from "@/lib/env";
import { dateTime } from "@/lib/format";
import { effectivePlan, isTrialActive, LIMIT_LABEL, limitsFor, PLAN_LABEL, PLAN_LIMITS, planUsage, type LimitKey } from "@/lib/plans";
import { setProducerPlan } from "../../../actions";

const fmt = (n: number | null) => (n == null ? "ilimitado" : String(n));

/** Plano da casa no painel do admin: plano, demonstração Pro, ajustes e uso. */
export async function PlanCard({ producer: p }: { producer: Producer }) {
  const usage = await planUsage(p.id);
  const limits = limitsFor(p);
  const eff = effectivePlan(p);
  const trial = isTrialActive(p);
  const keys: [LimitKey, keyof Producer][] = [
    ["staff", "limitStaff"],
    ["promoters", "limitPromoters"],
    ["listNames", "limitListNames"],
  ];

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="section-title">Plano</h2>
          <p className="text-sm text-slate-600">
            Em vigor: <b>{PLAN_LABEL[eff]}</b>
            {trial && p.proTrialUntil && (
              <>
                {" "}
                (demonstração até {dateTime(p.proTrialUntil)}, depois volta para {PLAN_LABEL[p.plan]})
              </>
            )}
            {" · "}taxa {p.feeBps != null ? `${(p.feeBps / 100).toLocaleString("pt-BR")}% (especial)` : `${env.platformFeePercent}% (padrão)`}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {keys.map(([k]) => {
          const lim = limits[k];
          const used = usage[k];
          const pct = lim ? Math.min(100, Math.round((used / lim) * 100)) : 0;
          return (
            <div key={k} className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase text-slate-500">{LIMIT_LABEL[k]}</p>
              <p className="font-bold">
                {used} / {fmt(lim)}
              </p>
              {lim != null && (
                <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                  <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                </div>
              )}
              {lim != null && used >= lim && <p className="mt-1 text-xs font-semibold text-red-700">No limite: boa hora para oferecer o Pro</p>}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">&quot;Nomes na lista&quot; mostra a maior lista entre os eventos atuais da casa.</p>

      <ActionForm action={setProducerPlan.bind(null, p.id)} className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="plan">
            Plano contratado
          </label>
          <select id="plan" name="plan" className="input" defaultValue={p.plan}>
            {(["FREE", "PLUS", "PRO"] as const).map((pl) => (
              <option key={pl} value={pl}>
                {PLAN_LABEL[pl]}: {fmt(PLAN_LIMITS[pl].staff)} portaria · {fmt(PLAN_LIMITS[pl].promoters)} promoters · {fmt(PLAN_LIMITS[pl].listNames)} nomes
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="trialDays">
            Liberar Pro completo por (dias)
          </label>
          <input id="trialDays" name="trialDays" type="number" min={0} max={365} className="input" placeholder="Ex.: 30" />
          {trial ? (
            <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" name="endTrial" /> Encerrar a demonstração agora
            </label>
          ) : (
            <p className="hint">Para mostrar tudo funcionando. Depois volta ao plano contratado.</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <p className="label">Ajustes só para esta casa</p>
          <p className="hint mb-2">Vazio = padrão do plano. 0 = ilimitado.</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {keys.map(([k, field]) => (
              <div key={k}>
                <label className="text-xs text-slate-600" htmlFor={field}>
                  {LIMIT_LABEL[k]}
                </label>
                <input id={field} name={field} type="number" min={0} className="input" defaultValue={(p[field] as number | null) ?? ""} placeholder={`padrão: ${fmt(PLAN_LIMITS[p.plan][k])}`} />
              </div>
            ))}
            <div>
              <label className="text-xs text-slate-600" htmlFor="feePercent">
                Taxa especial (%)
              </label>
              <input id="feePercent" name="feePercent" className="input" inputMode="decimal" defaultValue={p.feeBps != null ? String(p.feeBps / 100).replace(".", ",") : ""} placeholder={`padrão: ${env.platformFeePercent}`} />
            </div>
          </div>
        </div>
        <div className="sm:col-span-2">
          <SubmitButton>Salvar plano</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}
