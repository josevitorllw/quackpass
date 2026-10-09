"use client";

import { useState } from "react";
import { Scanner } from "@/components/checkin/Scanner";
import { BuyerList } from "./BuyerList";
import { DoorList } from "./DoorList";

/** Tela da portaria: leitor de QR e lista de compradores. */
export function Door({ eventId, initialUsed, total, hasList }: { eventId: string; initialUsed: number; total: number; hasList: boolean }) {
  const [tab, setTab] = useState<"scan" | "list" | "door">("scan");
  return (
    <div className="space-y-4">
      <div className={`grid gap-1 rounded-xl bg-slate-900 p-1 ${hasList ? "grid-cols-3" : "grid-cols-2"}`} role="tablist">
        {(
          [
            ["scan", "Ler QR"],
            ["list", "Compradores"],
            ...(hasList ? ([["door", "Lista / Porta"]] as const) : []),
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-lg py-2.5 text-sm font-semibold ${tab === k ? "bg-brand-400 text-slate-900" : "text-slate-400"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Mantém o leitor montado (a câmera não reinicia ao trocar de aba) */}
      <div className={tab === "scan" ? "" : "hidden"}>
        <Scanner eventId={eventId} initialUsed={initialUsed} total={total} />
      </div>
      {tab === "list" && <BuyerList eventId={eventId} />}
      {tab === "door" && <DoorList eventId={eventId} />}
    </div>
  );
}
