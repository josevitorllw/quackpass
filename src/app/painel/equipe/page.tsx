import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireProducer } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { dateTime } from "@/lib/format";
import { limitsFor } from "@/lib/plans";
import { createStaff, resetStaffPassword, toggleStaff } from "../actions";

export default async function StaffPage() {
  const producer = await requireProducer();
  const staff = await db.staffMember.findMany({ where: { producerId: producer.id }, orderBy: { createdAt: "asc" } });
  const portariaUrl = `${env.staffUrl}/portaria`;
  const limit = limitsFor(producer).staff;
  const activeCount = staff.filter((s) => s.active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Equipe da portaria</h1>
        <p className="text-sm text-slate-600">
          Crie um acesso para cada pessoa da porta. Eles entram em <b>{portariaUrl}</b> e só conseguem fazer check-in e consultar a lista de quem
          comprou. Não veem valores, não reembolsam e não alteram nada.
        </p>
      </div>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="section-title">Novo acesso</h2>
          <p className="text-sm text-slate-500">
            {activeCount} de {limit ?? "ilimitados"} acessos ativos no seu plano
            {limit != null && activeCount >= limit && (
              <>
                {" · "}
                <a href="/painel/plano" className="font-medium text-brand-700 underline">
                  liberar mais
                </a>
              </>
            )}
          </p>
        </div>
        <ActionForm action={createStaff} className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="name">
              Nome
            </label>
            <input id="name" name="name" className="input" required placeholder="Ex.: João (porta 1)" />
          </div>
          <div>
            <label className="label" htmlFor="login">
              Login
            </label>
            <input id="login" name="login" className="input lowercase" required placeholder="ex.: folks.porta1" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Senha
            </label>
            <input id="password" name="password" type="text" className="input" required minLength={6} autoComplete="off" />
          </div>
          <div className="flex items-end">
            <SubmitButton className="btn-primary w-full">Criar acesso</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Login</th>
              <th>Último acesso</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={s.active ? "" : "opacity-60"}>
                <td className="font-medium">{s.name}</td>
                <td className="font-mono text-sm">{s.login}</td>
                <td className="text-slate-500">{s.lastLoginAt ? dateTime(s.lastLoginAt) : "nunca"}</td>
                <td>{s.active ? <span className="badge bg-emerald-50 text-emerald-700">Ativo</span> : <span className="badge bg-slate-100 text-slate-600">Desativado</span>}</td>
                <td>
                  <div className="flex items-start justify-end gap-2">
                    <details className="text-left">
                      <summary className="btn-secondary cursor-pointer list-none px-3 py-1.5 text-xs">Trocar senha</summary>
                      <ActionForm action={resetStaffPassword.bind(null, s.id)} className="mt-2 flex gap-2">
                        <input name="password" className="input py-1.5" placeholder="Nova senha" minLength={6} required autoComplete="off" />
                        <SubmitButton className="btn-primary px-3 py-1.5 text-xs">Salvar</SubmitButton>
                      </ActionForm>
                    </details>
                    <form action={toggleStaff.bind(null, s.id)}>
                      <button className="btn-secondary px-3 py-1.5 text-xs">{s.active ? "Desativar" : "Reativar"}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-500">
                  Nenhum acesso criado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
