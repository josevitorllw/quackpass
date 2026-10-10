import Link from "next/link";
import { AreaHeader } from "@/components/AreaHeader";
import { DuckSplash } from "@/components/DuckSplash";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { splashPending } from "@/lib/splash";
import { adminLogout } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const pending = await db.producer.count({ where: { status: "PENDING" } });
  const link = "rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100";
  return (
    <div className="min-h-screen">
      <DuckSplash show={splashPending()} name={admin.name || "admin"} />
      <AreaHeader label="Administração" home="/admin">
        <Link href="/admin" className={link}>
          Visão geral
        </Link>
        <Link href="/admin/produtores" className={link}>
          Produtores
          {pending > 0 && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">{pending}</span>}
        </Link>
        <Link href="/admin/eventos" className={link}>
          Eventos
        </Link>
        <Link href="/admin/pedidos" className={link}>
          Pedidos
        </Link>
        <form action={adminLogout}>
          <button className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100" title={admin.email}>
            Sair
          </button>
        </form>
      </AreaHeader>
      <div className="container-page py-6">{children}</div>
    </div>
  );
}
