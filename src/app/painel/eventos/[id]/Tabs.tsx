"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  ["", "Resumo"],
  ["/ingressos", "Ingressos e lotes"],
  ["/cupons", "Cupons"],
  ["/lista", "Lista"],
  ["/pedidos", "Pedidos"],
  ["/checkin", "Check-in"],
  ["/editar", "Editar"],
] as const;

export function Tabs({ base }: { base: string }) {
  const path = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map(([href, label]) => {
        const active = path === base + href;
        return (
          <Link
            key={href}
            href={base + href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${active ? "border-brand-400 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
