import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { promoterByToken } from "@/lib/promoter";

// O link tem um código secreto: não indexar e não vazar no "referer"
export const metadata: Metadata = { title: "Área do promoter", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function PromoterLayout({ children, params }: { children: React.ReactNode; params: { token: string } }) {
  const adv = await promoterByToken(params.token);
  if (!adv) notFound();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <a href={`/promoter/${params.token}`} className="flex items-center gap-2">
            <Logo />
          </a>
          <div className="text-right">
            <p className="text-xs uppercase text-slate-500">Promoter · {adv.producer.name}</p>
            <p className="font-semibold">{adv.name}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
