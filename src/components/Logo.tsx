import { env } from "@/lib/env";

/** Patinho (só o desenho). Usado na logo e na tela de boas-vindas. */
export function DuckIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {/* corpo */}
      <path d="M4 14.5c0-1.6 1.3-2.5 3-2.5h4.5c1.8 0 2.8-1.2 3.3-2.6.4-1 1.6-1.4 2.5-.8 2.6 1.6 3.7 4.2 3.2 6.6-.6 2.9-3.3 4.8-6.5 4.8H9c-2.8 0-5-1.9-5-5.5z" fill="#0f172a" />
      {/* cabeça */}
      <circle cx="8.5" cy="7.5" r="3.6" fill="#0f172a" />
      {/* bico */}
      <path className="qp-beak" d="M5.2 7.3L1.6 8.2l3.6 1.3z" fill="#f97316" />
      {/* olho */}
      <circle cx="8" cy="6.8" r="0.8" fill="#facc15" />
    </svg>
  );
}

/** Logo: patinho amarelo (o "quack" do nome). */
export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-400">
        <DuckIcon />
      </span>
      {env.companyName}
    </span>
  );
}
