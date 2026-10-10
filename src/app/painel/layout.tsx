import Link from "next/link";
import { AreaHeader } from "@/components/AreaHeader";
import { DuckSplash } from "@/components/DuckSplash";
import { requireProducer } from "@/lib/auth";
import { env } from "@/lib/env";
import { splashPending } from "@/lib/splash";
import { logout } from "../produtor/actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const NAV = [
  ["/painel", "Eventos"],
  ["/painel/anunciantes", "Anunciantes"],
  ["/painel/equipe", "Portaria"],
  ["/painel/conta", "Recebimento"],
] as const;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const producer = await requireProducer();
  return (
    <div className="min-h-screen">
      <DuckSplash show={splashPending()} name={producer.contactName?.split(" ")[0] || producer.name} />
      <AreaHeader label="Área do produtor" home="/painel">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">
            {label}
          </Link>
        ))}
        <a href={env.appUrl} target="_blank" className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100">
          Ver site ↗
        </a>
        <form action={logout}>
          <button className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100">Sair</button>
        </form>
      </AreaHeader>
      <div className="container-page py-6">
        <p className="mb-4 text-sm text-slate-500">
          Olá, <b className="text-slate-800">{producer.contactName || producer.name}</b> · {producer.name}
        </p>
        {!producer.recipientId && (
          <Link href="/painel/conta" className="card mb-6 block border-brand-200 bg-brand-50 text-sm">
            ⚠️ Cadastre sua conta bancária para começar a receber pelas vendas →
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}
