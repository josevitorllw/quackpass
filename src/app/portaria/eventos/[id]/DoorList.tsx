"use client";

import { useCallback, useEffect, useState } from "react";

type Entry = { id: string; name: string; promoter: string | null; entered: { at: string; by: string } | null };
type Data = {
  listEnabled: boolean;
  prices: { list: number | null; door: number | null; listExpired: boolean; listValidUntil: string | null };
  counts: { names: number; entered: number; door: number };
  promoters: { id: string; name: string }[];
  entries: Entry[];
};
type Method = "CASH" | "PIX" | "CARD" | "FREE";
const METHODS: [Method, string][] = [
  ["CASH", "Dinheiro"],
  ["PIX", "Pix"],
  ["CARD", "Cartão"],
  ["FREE", "Cortesia"],
];

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const toCents = (v: string) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100);

/** Lista de nomes e venda na porta: registra quem pagou no balcão e para qual promoter conta. */
export function DoorList({ eventId }: { eventId: string }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<{ entry: Entry | null } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/portaria/eventos/${eventId}/lista?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [eventId, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  if (!data) return <p className="text-slate-400">Carregando...</p>;

  return (
    <div className="space-y-3">
      <div className="card grid grid-cols-3 gap-2 py-3 text-center">
        <div>
          <p className="text-xl font-black">{data.counts.names}</p>
          <p className="text-xs text-slate-400">na lista</p>
        </div>
        <div>
          <p className="text-xl font-black">{data.counts.entered}</p>
          <p className="text-xs text-slate-400">entraram da lista</p>
        </div>
        <div>
          <p className="text-xl font-black">{data.counts.door}</p>
          <p className="text-xs text-slate-400">pagaram na porta</p>
        </div>
      </div>

      <div className="rounded-xl bg-slate-900 p-3 text-sm">
        {data.prices.list != null && (
          <p>
            Na lista: <b>{brl(data.prices.list)}</b>
            {data.prices.listValidUntil && <> até {time(data.prices.listValidUntil)}</>}
            {data.prices.listExpired && <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300">horário da lista encerrado</span>}
          </p>
        )}
        {data.prices.door != null && (
          <p className="text-slate-400">
            Sem lista: <b className="text-slate-100">{brl(data.prices.door)}</b>
          </p>
        )}
      </div>

      {msg && <p className={`rounded-lg p-3 text-sm font-semibold ${msg.ok ? "bg-emerald-900/60 text-emerald-200" : "bg-red-900/60 text-red-200"}`}>{msg.text}</p>}

      <input className="input py-3 text-base" placeholder="Buscar nome na lista" value={q} onChange={(e) => setQ(e.target.value)} autoCorrect="off" aria-label="Buscar nome na lista" />
      <button className="btn-secondary w-full" onClick={() => setOpen({ entry: null })}>
        + Venda na porta sem lista
      </button>

      <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
        {data.entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{e.name}</p>
              <p className="text-xs text-slate-400">{e.promoter ? `Lista do ${e.promoter}` : "Lista da casa"}</p>
              {e.entered && (
                <p className="text-xs text-emerald-400">
                  Entrou às {time(e.entered.at)} · {e.entered.by}
                </p>
              )}
            </div>
            {e.entered ? (
              <span className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300">Já entrou</span>
            ) : (
              <button onClick={() => setOpen({ entry: e })} className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">
                Registrar entrada
              </button>
            )}
          </li>
        ))}
        {data.entries.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">{q ? "Nome não está na lista" : "Lista vazia"}</li>}
      </ul>

      {open && (
        <EntrySheet
          eventId={eventId}
          entry={open.entry}
          data={data}
          onClose={() => setOpen(null)}
          onDone={(text, ok) => {
            setMsg({ ok, text });
            setOpen(null);
            if (ok) setQ("");
            load();
          }}
        />
      )}
    </div>
  );
}

function EntrySheet({ eventId, entry, data, onClose, onDone }: { eventId: string; entry: Entry | null; data: Data; onClose: () => void; onDone: (t: string, ok: boolean) => void }) {
  const suggested = entry ? data.prices.list ?? data.prices.door : data.prices.door;
  const [value, setValue] = useState(suggested != null ? (suggested / 100).toFixed(2).replace(".", ",") : "");
  const [method, setMethod] = useState<Method>("CASH");
  const [name, setName] = useState("");
  const [promoter, setPromoter] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    const amountCents = method === "FREE" ? 0 : toCents(value || "0");
    if (method !== "FREE" && !(amountCents >= 0)) return onDone("Valor inválido", false);
    setBusy(true);
    const res = await fetch(`/api/portaria/eventos/${eventId}/porta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestListEntryId: entry?.id,
        name: entry ? undefined : name || undefined,
        advertiserId: entry ? undefined : promoter || undefined,
        amountCents,
        method,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) onDone(`✅ ${d.name}: entrada registrada${d.promoter ? ` (conta para ${d.promoter})` : ""}`, true);
    else onDone(`⚠️ ${d.error ?? "Erro"}`, false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-t-2xl bg-slate-900 p-5 sm:rounded-2xl">
        <div>
          <p className="text-xs uppercase text-slate-400">{entry ? "Entrada pela lista" : "Venda na porta"}</p>
          <p className="text-xl font-bold">{entry ? entry.name : "Sem nome na lista"}</p>
          {entry && <p className="text-sm text-slate-400">{entry.promoter ? `Conta para ${entry.promoter}` : "Lista da casa"} · confira o documento</p>}
        </div>
        {!entry && (
          <>
            <input className="input" placeholder="Nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <label className="label">Veio por algum promoter?</label>
              <select className="input" value={promoter} onChange={(e) => setPromoter(e.target.value)}>
                <option value="">Não / ninguém</option>
                {data.promoters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <div className="grid grid-cols-4 gap-2">
          {METHODS.map(([m, label]) => (
            <button key={m} type="button" onClick={() => setMethod(m)} className={`rounded-lg py-2.5 text-sm font-semibold ${method === m ? "bg-brand-400 text-slate-900" : "bg-slate-800 text-slate-200"}`}>
              {label}
            </button>
          ))}
        </div>
        {method !== "FREE" && (
          <div>
            <label className="label">Valor pago (R$)</label>
            <input className="input py-3 text-lg" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Voltar
          </button>
          <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" onClick={confirm} disabled={busy}>
            {busy ? "Registrando..." : "Confirmar entrada"}
          </button>
        </div>
      </div>
    </div>
  );
}
