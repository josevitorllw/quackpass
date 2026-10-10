"use client";

import { useEffect, useState } from "react";
import { quackQuack, createAudio } from "@/lib/quack";
import { DuckIcon } from "./Logo";

const SHOW_MS = 2400; // quanto tempo o patinho fica na tela
const LEAVE_MS = 650; // duração da saída

/**
 * Tela de boas-vindas logo após o login: o patinho cai, balança, faz "quack" e a tela some
 * revelando o sistema. Clique ou Esc para pular. Aparece uma vez por login.
 */
export function DuckSplash({ show, name }: { show: boolean; name: string }) {
  const [phase, setPhase] = useState<"show" | "leave" | "gone">(show ? "show" : "gone");

  useEffect(() => {
    if (!show) return;
    document.cookie = "qp_splash=; Max-Age=0; path=/"; // consome o aviso: recarregar a página não repete
    const t1 = setTimeout(() => setPhase("leave"), SHOW_MS);
    const t2 = setTimeout(() => setPhase("gone"), SHOW_MS + LEAVE_MS);

    // Som: o "quack" cai junto com o balão (1 s). Se o navegador bloquear o áudio automático,
    // toca no primeiro toque/tecla enquanto a tela ainda está aberta.
    const t0 = performance.now();
    const ctx = createAudio();
    let played = false;
    let cancelled = false;
    const play = () => {
      if (!ctx || played || cancelled || performance.now() - t0 > SHOW_MS - 200) return;
      played = true;
      const wait = Math.max(0, 1 - (performance.now() - t0) / 1000);
      quackQuack(ctx, ctx.currentTime + wait);
    };
    const unlock = () => {
      ctx?.resume().then(play).catch(() => {});
    };
    if (ctx) {
      ctx.resume().then(() => ctx.state === "running" && play()).catch(() => {});
      window.addEventListener("pointerdown", unlock, { once: true });
      window.addEventListener("keydown", unlock, { once: true });
    }

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      ctx?.close().catch(() => {});
    };
  }, [show]);

  useEffect(() => {
    if (phase === "gone") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPhase("gone");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      className={`qp-splash fixed inset-0 z-[100] grid cursor-pointer place-items-center bg-brand-400 ${phase === "leave" ? "qp-splash-leave" : ""}`}
      onClick={() => setPhase("gone")}
      role="status"
      aria-label="Entrando"
    >
      <div className="flex flex-col items-center">
        <div className="relative">
          <span className="qp-bubble absolute -right-16 -top-6 rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-sm font-extrabold text-slate-900 shadow-lg">
            Quack!
          </span>
          <div className="qp-duck">
            <DuckIcon className="h-32 w-32 drop-shadow-md" />
          </div>
        </div>
        <span className="qp-shadow mt-1 block h-3 w-24 rounded-[50%] bg-slate-900/20" />
        <p className="qp-welcome mt-6 text-center text-lg font-extrabold tracking-tight text-slate-900">Olá, {name}!</p>
        <p className="qp-welcome-sub text-sm font-medium text-slate-800/70">Preparando tudo pra você…</p>
      </div>
    </div>
  );
}
