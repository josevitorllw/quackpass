import { env } from "@/lib/env";

export const metadata = { title: "Venda ingressos do seu evento" };

export default function ForProducers() {
  const fee = `${env.platformFeePercent}%`;
  return (
    <div>
      <section className="border-b border-slate-200 bg-white">
        <div className="container-page max-w-4xl space-y-5 py-16 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Venda os ingressos da sua casa sem mensalidade</h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Crie a página do seu evento do seu jeito, divulgue com seus promoters e receba direto na sua conta. Você só paga quando vende.
          </p>
          <p className="mx-auto max-w-2xl text-sm text-slate-500">
            Preencha o cadastro e a nossa equipe entra em contato pelo WhatsApp para conhecer a sua casa e liberar o seu acesso.
          </p>
          <div className="flex justify-center gap-3">
            <a href={`${env.producerUrl}/produtor/cadastro`} className="btn-primary px-6 py-3 text-base">
              Quero ser parceiro
            </a>
            <a href={`${env.producerUrl}/produtor/login`} className="btn-secondary px-6 py-3 text-base">
              Já sou parceiro
            </a>
          </div>
        </div>
      </section>
      <section className="container-page grid gap-5 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Sem mensalidade", `Taxa de ${fee} por ingresso vendido (mínimo de R$ ${(env.platformFeeMinCents / 100).toFixed(2).replace(".", ",")}). Você escolhe se repassa a taxa ao comprador.`],
          ["Dinheiro direto na sua conta", "O pagamento é dividido automaticamente: a sua parte vai para a sua conta bancária."],
          ["Página do seu jeito", "Fotos, textos, atrações, vídeo e a cor da sua marca."],
          ["Promoters com comissão", "Cupom para cada promoter, com comissão configurável e relatório de quanto cada um vendeu."],
          ["Lotes automáticos", "Quando um lote esgota ou vence, o próximo abre sozinho."],
          ["Check-in pelo celular", "Sua equipe valida os QR Codes na porta pela câmera do celular, sem app."],
        ].map(([t, d]) => (
          <div key={t} className="card">
            <h2 className="font-bold">{t}</h2>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
