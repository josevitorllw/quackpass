import Link from "next/link";
import { TagIcon } from "./Icons";

/**
 * Caixa de cupom da home. É um formulário GET (`/?cupom=CODIGO`), então também funciona
 * como link de influencer: quem abrir `/?cupom=WESLEY` já vê o desconto nos eventos.
 */
export function CouponBox({ code, q, matches, discountText }: { code?: string; q?: string; matches: number; discountText?: string }) {
  const applied = !!code && matches > 0;
  const invalid = !!code && matches === 0;
  return (
    <div className="rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm">
      <p className="flex items-center gap-2 text-base font-extrabold text-slate-900">
        <TagIcon className="h-5 w-5 text-brand-700" /> Tem um cupom?
      </p>
      <p className="mt-1 text-sm text-slate-600">Use o código do seu influencer favorito e veja o preço com desconto.</p>
      <form action="/" className="mt-3 flex gap-2">
        {q && <input type="hidden" name="q" value={q} />}
        <input
          name="cupom"
          defaultValue={code}
          placeholder="SEU CUPOM"
          className="input font-semibold uppercase tracking-wide"
          aria-label="Código do cupom"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={40}
        />
        <button className="btn-primary shrink-0">Aplicar</button>
      </form>
      {applied && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✅ <b>{code}</b> aplicado{discountText ? ` (${discountText})` : ""} em {matches} {matches === 1 ? "evento" : "eventos"}.{" "}
          <Link href={q ? `/?q=${encodeURIComponent(q)}` : "/"} className="font-semibold underline">
            Remover
          </Link>
        </p>
      )}
      {invalid && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Cupom inválido, expirado ou sem validade nos eventos listados.</p>}
    </div>
  );
}
