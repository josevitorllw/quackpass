"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronIcon, TicketIcon } from "./Icons";

export type Slide = { slug: string; href: string; title: string; when: string; where: string; image: string | null; accent: string; price: string | null };

const INTERVAL_MS = 5500;

/** Carrossel de destaques no topo: passa sozinho, pausa com o mouse em cima, setas, bolinhas e arrastar no celular. */
export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = slides.length;

  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (n < 2 || paused || reduced) return;
    const id = setTimeout(() => go(i + 1), INTERVAL_MS);
    return () => clearTimeout(id);
  }, [i, n, paused, reduced, go]);

  return (
    <div
      className="group relative overflow-hidden rounded-3xl bg-slate-900 shadow-lg"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Eventos em destaque"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s, idx) => (
          <div key={s.slug} className="relative h-[300px] w-full shrink-0 sm:h-[400px] lg:h-[460px]" aria-hidden={idx !== i} role="group" aria-label={`${idx + 1} de ${n}`}>
            {s.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover" loading={idx === 0 ? "eager" : "lazy"} />
            ) : (
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${s.accent}, #0f172a 85%)` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-5 sm:p-8 lg:p-10">
              <span className="rounded-full bg-brand-400 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-slate-900">{s.when}</span>
              <h2 className="max-w-2xl text-2xl font-extrabold leading-tight text-white drop-shadow sm:text-4xl lg:text-5xl">{s.title}</h2>
              <p className="text-sm text-slate-200 sm:text-base">{s.where}</p>
              <Link href={s.href} tabIndex={idx === i ? 0 : -1} className="btn-cta mt-1">
                <TicketIcon /> Garantir ingresso{s.price ? ` · ${s.price}` : ""}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button
            type="button"
            aria-label="Evento anterior"
            onClick={() => go(i - 1)}
            className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-900 opacity-0 shadow transition hover:bg-white group-hover:opacity-100 sm:block"
          >
            <ChevronIcon className="h-5 w-5 rotate-180" />
          </button>
          <button
            type="button"
            aria-label="Próximo evento"
            onClick={() => go(i + 1)}
            className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/85 p-2 text-slate-900 opacity-0 shadow transition hover:bg-white group-hover:opacity-100 sm:block"
          >
            <ChevronIcon className="h-5 w-5" />
          </button>
          <div className="absolute right-5 top-5 flex gap-1.5">
            {slides.map((s, idx) => (
              <button
                key={s.slug}
                type="button"
                aria-label={`Ir para o evento ${idx + 1}`}
                aria-current={idx === i}
                onClick={() => go(idx)}
                className={`h-2 rounded-full transition-all ${idx === i ? "w-6 bg-brand-400" : "w-2 bg-white/60 hover:bg-white"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
