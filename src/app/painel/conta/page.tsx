import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireProducer } from "@/lib/auth";
import { env } from "@/lib/env";
import { feePercentFor } from "@/lib/plans";
import { saveBankAccount } from "../actions";

export default async function AccountPage({ searchParams }: { searchParams: { erro?: string } }) {
  const producer = await requireProducer();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-black">Recebimento</h1>
        <p className="text-sm text-slate-500">
          O valor de cada venda é dividido automaticamente (split): a sua parte vai direto para a sua conta pelo gateway de
          pagamento, e a taxa de serviço ({feePercentFor(producer).toLocaleString("pt-BR")}%, mínimo de R$ {(env.platformFeeMinCents / 100).toFixed(2).replace(".", ",")}{" "}
          por ingresso) fica com a plataforma. Sem mensalidade.
        </p>
      </div>
      {searchParams.erro === "sem-recebedor" && (
        <div className="card border-red-200 text-sm text-red-700">Cadastre sua conta bancária antes de publicar um evento pago.</div>
      )}
      {producer.recipientId && (
        <div className="card border-emerald-200 text-sm text-emerald-700">✅ Recebimento ativo ({producer.recipientId})</div>
      )}
      <ActionForm action={saveBankAccount} className="card grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Titular da conta</label>
          <input name="bankHolder" className="input" required defaultValue={producer.bankHolder ?? producer.name} />
          <p className="mt-1 text-xs text-slate-500">A conta precisa estar no mesmo CPF/CNPJ do cadastro ({producer.document}).</p>
        </div>
        <div>
          <label className="label">Banco (código)</label>
          <input name="bankCode" className="input" required placeholder="341" defaultValue={producer.bankCode ?? ""} />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select name="bankAccountType" className="input" defaultValue={producer.bankAccountType ?? "checking"}>
            <option value="checking">Conta corrente</option>
            <option value="savings">Poupança</option>
          </select>
        </div>
        <div>
          <label className="label">Agência (sem dígito)</label>
          <input name="bankBranch" className="input" required defaultValue={producer.bankBranch ?? ""} />
        </div>
        <div className="grid grid-cols-[1fr_70px] gap-2">
          <div>
            <label className="label">Conta</label>
            <input name="bankAccount" className="input" required defaultValue={producer.bankAccount ?? ""} />
          </div>
          <div>
            <label className="label">Dígito</label>
            <input name="bankAccountDigit" className="input" required defaultValue={producer.bankAccountDigit ?? ""} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <SubmitButton>{producer.recipientId ? "Atualizar dados" : "Ativar recebimento"}</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
