"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** Contagem regressiva ao vivo. Passa de 1 hora vira vermelha para dar urgência. */
export function Countdown({ target, label, endedText = "Encerrado" }: { target: string; label: string; endedText?: string }) {
  const [left, setLeft] = useState<number | null>(null); // null até montar (evita diferença entre servidor e navegador)

  useEffect(() => {
    const end = new Date(target).getTime();
    const tick = () => setLeft(end - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  let segments: [string, string][] = [];
  if (left !== null && left > 0) {
    const s = Math.floor(left / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    segments = d > 0 ? [[pad(d), "d"], [pad(h), "h"], [pad(m), "min"]] : [[pad(h), "h"], [pad(m), "min"], [pad(s % 60), "s"]];
  }
  const urgent = left !== null && left > 0 && left < 3_600_000;
  const ended = left !== null && left <= 0;

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {ended ? (
        <p className="text-sm font-bold text-slate-700">{endedText}</p>
      ) : (
        <div className="flex gap-1" aria-label={`${label} ${segments.map(([v, u]) => v + u).join(" ")}`}>
          {(left === null ? [["--", "h"], ["--", "min"], ["--", "s"]] : segments).map(([v, u]) => (
            <span
              key={u}
              className={`rounded-md px-1.5 py-1 text-sm font-extrabold tabular-nums text-white ${urgent ? "animate-pulse bg-red-600" : "bg-slate-900"}`}
            >
              {v}
              <small className="ml-0.5 text-[10px] font-semibold opacity-70">{u}</small>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
