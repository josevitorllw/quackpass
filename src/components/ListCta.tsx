"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Chamada para a lista na página do evento (mantém o promoter do link, se houver ?p=). */
export function ListCta({ slug, priceLabel, untilLabel }: { slug: string; priceLabel: string; untilLabel: string | null }) {
  const p = useSearchParams().get("p");
  return (
    <div className="card space-y-2">
      <p className="font-bold">Nome na lista</p>
      <p className="text-sm text-slate-600">
        Com o nome na lista você paga <b>{priceLabel}</b> na portaria{untilLabel ? ` até ${untilLabel}` : ""}.
      </p>
      <Link href={`/evento/${slug}/lista${p ? `?p=${encodeURIComponent(p)}` : ""}`} className="btn-secondary w-full">
        Colocar meu nome na lista
      </Link>
    </div>
  );
}
