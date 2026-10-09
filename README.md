# Quackpass

Plataforma de venda de ingressos para baladas, bares e eventos. Produtores cadastram seus eventos e vendem pela plataforma; a plataforma ganha uma taxa por ingresso vendido, sem mensalidade.

## As quatro áreas

Um único sistema (um deploy, um banco) com quatro áreas separadas, cada uma com endereço, visual e login próprios. O login de uma área não vale em outra.

| Área | Endereço sugerido | Quem usa | O que faz |
|---|---|---|---|
| **Site** | `quackpass.com.br` | Comprador | Eventos, compra, pedido, ingresso, reembolso pelo site |
| **Produtor** | `produtor.quackpass.com.br` | Dono da casa | Cadastro (pedido de parceria), eventos, lotes, cupons, anunciantes, pedidos, equipe da portaria, recebimento |
| **Portaria** | `portaria.quackpass.com.br` | Equipe da porta | Só check-in (QR ou lista) e consulta de quem comprou. Não vê valores e não altera nada |
| **Admin** | `admin.quackpass.com.br` | Você | Aprovação de produtores, eventos, pedidos de toda a plataforma, faturamento |

Para separar por endereço, aponte os subdomínios para o mesmo deploy e configure `APP_URL`, `PRODUCER_URL`, `STAFF_URL` e `ADMIN_URL`. Sem essas variáveis tudo funciona em um endereço só (`/`, `/painel`, `/portaria`, `/admin`).

### Aprovação de produtores
1. O produtor preenche o cadastro (dados da casa, WhatsApp, Instagram, cidade...).
2. Você recebe um e-mail (`ADMIN_NOTIFY_EMAIL`) e o cadastro aparece em **Admin → Produtores** com botão de WhatsApp.
3. Você conversa, anota o que combinou e clica em **Aprovar**. O produtor recebe um e-mail e o painel é liberado.
4. Antes disso ele só vê a tela "Cadastro em análise". **Bloquear** tira todos os eventos dele do ar na hora.

Crie o seu login de administrador com:
```bash
npm run admin:create -- voce@seudominio.com.br "Seu Nome" "uma-senha-forte"
```

## O que já tem

| Área | Funcionalidades |
|---|---|
| **Produtor** | Cadastro e login, conta de recebimento (split automático) |
| **Eventos** | Criar/editar, publicar/pausar/cancelar, pré-visualização do rascunho, quem paga a taxa. Todos os eventos são **+18** (o comprador confirma a idade no checkout) |
| **Página do evento personalizável** | Capa com upload, cor do evento, texto com formatação e **blocos**: texto, imagem, galeria de fotos, atrações/line-up, vídeo do YouTube, perguntas frequentes. Mapa do local e contatos do organizador |
| **Ingressos** | Tipos (Pista, VIP, Camarote...) com **lotes**: preço, quantidade, máximo por pedido, janela de vendas. O próximo lote abre sozinho quando o anterior esgota ou vence |
| **Anunciantes** | Produtor cadastra promoters/anunciantes com **comissão** (% da venda ou R$ por ingresso) e cria **cupons** vinculados a eles (% ou R$ de desconto, limite de usos, validade, comissão própria opcional). Link de divulgação `?cupom=CODIGO` aplica o desconto automaticamente. Relatório de comissão a pagar por anunciante |
| **Reembolso** | Por evento, o produtor define o **prazo** (até X horas antes) e **quem reembolsa**: o próprio site (cliente pede na página do pedido e o estorno é automático) ou só o produtor (cliente fala com a casa e o produtor reembolsa pelo painel). O produtor pode reembolsar qualquer pedido pelo painel a qualquer momento |
| **E-mail** | Ingressos com QR Code enviados por e-mail assim que o pagamento confirma; reenvio pelo cliente ou pelo produtor; e-mail de reembolso confirmado |
| **Checkout** | **Pix** (QR + copia-e-cola, confirmação automática), **cartão de crédito** (até 6x) e **débito** (com 3DS), com split entre produtor e plataforma |
| **Ingresso** | Gerado assim que o pagamento é confirmado, com QR Code único por ingresso e página individual para enviar a um amigo |
| **Painel de vendas** | Faturamento, ingressos por lote, vendas e comissões por anunciante, por forma de pagamento, lista de pedidos com busca, reembolso e reenvio de e-mail |
| **Páginas institucionais** | Termos de uso, privacidade, política de reembolso, central de ajuda e página "para produtores" (modelos: revise com um advogado) |
| **Portaria** | O produtor cria logins para a equipe. Leitura do QR pela câmera do celular (ou código digitado) com ✅ / ⚠️ já usado / ❌ inválido, lista de compradores com busca por nome, CPF (mascarado), e-mail ou código, e "dar entrada" manual. Registra quem liberou cada entrada |
| **Cancelamento de evento** | Para as vendas e reembolsa **todos** os compradores automaticamente (o cron termina o que faltar e tenta de novo os que falharem). Compradores recebem e-mail. Pix pago depois do cancelamento é reembolsado sozinho |
| **Senha** | "Esqueci minha senha" com link por e-mail (vale 1 hora, uso único) |

## Modelo de cobrança

- Taxa de serviço: `PLATFORM_FEE_PERCENT` (padrão **10%**) com mínimo de `PLATFORM_FEE_MIN_CENTS` (padrão **R$ 3,00**) por ingresso pago. Ingresso gratuito não paga taxa.
- Por evento, o produtor escolhe **quem paga a taxa**: o comprador (somada ao total) ou o próprio produtor (descontada do repasse).
- O pagamento é dividido na hora pelo gateway (**split**): a parte do produtor vai para o recebedor dele e a taxa vai para o recebedor da plataforma. A plataforma paga a tarifa do gateway e responde por chargeback (configurável em `src/lib/payments/pagarme.ts`).

Exemplo: ingresso de R$ 50 com taxa paga pelo comprador → comprador paga R$ 55, produtor recebe R$ 50, plataforma recebe R$ 5 (menos a tarifa do gateway).

## Feito para aguentar fluxo

- **Sem venda a mais:** a reserva de estoque é um `UPDATE ... WHERE sold + n <= quantity` atômico no Postgres. Testado com 100 compras simultâneas disputando 20 ingressos: exatamente 20 vendidos.
- **Reserva com tempo:** o pedido segura os ingressos por `ORDER_RESERVATION_MINUTES` (padrão 15). Se o Pix não for pago, um cron devolve o estoque e o uso do cupom.
- **Pagamento idempotente:** confirmar o mesmo pagamento duas vezes (webhook repetido, polling) emite os ingressos uma única vez. Webhooks repetidos são descartados pela tabela `WebhookEvent`.
- **Não confia no webhook:** o corpo do webhook só diz qual pedido mudou; o status real é sempre consultado na API do gateway.
- **Check-in à prova de duplicidade:** vários leitores ao mesmo tempo nunca deixam o mesmo QR entrar duas vezes.
- **Reembolso à prova de duplicidade:** o pedido é travado (`REFUNDING`) antes de chamar o gateway. Testado com 5 pedidos de reembolso simultâneos: exatamente 1 estorno.
- **Página do evento em cache (ISR, 15s):** picos de acesso na divulgação não batem no banco a cada visita. O estoque real é conferido no checkout.
- **Stateless:** o app pode rodar em várias instâncias atrás de um load balancer (sessão em JWT assinado no cookie).
- **Dados do cartão nunca passam pelo servidor:** o navegador envia direto para a Pagar.me e recebe um token.
- Índices em todas as consultas quentes, rate limit no checkout, cupom, login e cadastro.

- **Comissão "congelada" no pedido:** mudar a comissão de um anunciante vale só para vendas novas; as antigas mantêm o valor combinado.

### Para escalar mais (quando precisar)

1. **Banco:** Postgres gerenciado (Neon, Supabase, RDS) com pooler (PgBouncer/Supavisor). Use a URL com pooler em `DATABASE_URL` e a direta em `DIRECT_URL`.
2. **Rate limit distribuído:** o atual é em memória, por instância. Com várias instâncias, troque por Redis (`@upstash/ratelimit`) em `src/lib/ratelimit.ts`.
3. **Imagens:** hoje ficam no Postgres (tabela `Upload`) e são servidas com cache imutável de 1 ano, então uma CDN (Cloudflare, Vercel) absorve quase todo o tráfego. Com muito volume, migre para S3/R2 trocando `src/app/api/uploads`.
4. **Fila de e-mail:** hoje o e-mail sai na mesma requisição que confirma o pagamento (uma falha no envio nunca derruba o pagamento). Com muito volume, mova o envio para uma fila (ex.: Inngest, BullMQ).

## Rodando no seu computador

Você precisa instalar uma vez:
- **Node.js 20 ou mais novo**: https://nodejs.org (versão LTS)
- **Docker Desktop**: https://www.docker.com/products/docker-desktop (roda o banco de dados)

Depois:

1. Baixe o projeto: no GitHub, botão verde **Code → Download ZIP**, e descompacte. (Ou `git clone https://github.com/josevitorllw/quackpass.git`.)
2. Abra o **Docker Desktop** e deixe ele aberto.
3. Abra um terminal **dentro da pasta do projeto** (no Windows: abra a pasta, clique na barra de endereço, digite `cmd` e Enter).
4. Rode, um de cada vez:

```bash
docker compose up -d db        # liga o banco de dados
copy .env.example .env         # Windows  (no Mac/Linux: cp .env.example .env)
npm install                    # instala as dependências (só na primeira vez)
npx prisma migrate deploy      # cria as tabelas
npm run db:seed                # cria os dados de demonstração
npm run dev                    # liga o site
```

5. Abra **http://localhost:3000** no navegador.

Para desligar: `Ctrl + C` no terminal. Para ligar de novo outro dia: abra o Docker Desktop, rode `docker compose up -d db` e `npm run dev`.

Neste modo nada é cobrado de verdade:
- **Pix:** a tela do pedido mostra o botão "[DEV] Simular pagamento".
- **Cartão:** qualquer número é aprovado; números terminados em `0002` são recusados.
- **E-mails:** não são enviados, aparecem no terminal.

Logins de demonstração:
- Produtor: `produtor@demo.com` / `demo12345` em `/painel` (há também um cadastro pendente, `novacasa@demo.com`)
- Admin: `admin@demo.com` / `admin12345` em `/admin`
- Portaria: `folks.porta` / `porta123` em `/portaria`

Para ver o conteúdo dos e-mails, defina `EMAIL_PREVIEW_DIR` no `.env` (ex.: `EMAIL_PREVIEW_DIR="emails"`): cada e-mail é salvo como HTML nessa pasta.

Demo: `http://localhost:3000/evento/4-anos-folks-curitiba?cupom=WESLEY`

## Colocando em produção com a Pagar.me

1. Crie a conta em [pagar.me](https://pagar.me) e peça a ativação de **Marketplace / Split** e dos meios **Pix, crédito e débito**.
2. No painel da Pagar.me, pegue as chaves (`sk_...` e `pk_...`) e o **recipient_id da sua conta** (o recebedor que fica com a taxa).
3. Configure as variáveis:
   ```
   PAYMENT_PROVIDER="pagarme"
   PAGARME_SECRET_KEY="sk_..."
   PAGARME_PUBLIC_KEY="pk_..."
   PAGARME_PLATFORM_RECIPIENT_ID="rp_..."
   PAGARME_WEBHOOK_USER="..."        # invente um usuário
   PAGARME_WEBHOOK_PASSWORD="..."    # e uma senha forte
   APP_URL="https://seudominio.com.br"
   CRON_SECRET="..."
   ```
4. No painel da Pagar.me, crie um webhook para `https://seudominio.com.br/api/webhooks/pagarme` com **Basic Auth** (o usuário/senha acima) e os eventos `order.paid`, `order.payment_failed`, `order.canceled`, `charge.paid`, `charge.refunded`, `charge.payment_failed`.
5. Libere o domínio do site para tokenização de cartão no painel da Pagar.me.
6. Configure o e-mail: crie uma conta num serviço de SMTP (o [Resend](https://resend.com) é simples), **verifique o seu domínio** (registros SPF/DKIM, para não cair no spam) e preencha `SMTP_URL` e `EMAIL_FROM`.
7. Preencha os dados da empresa (`COMPANY_LEGAL_NAME`, `COMPANY_CNPJ`, `SUPPORT_EMAIL`): eles aparecem no rodapé, nos termos e nos e-mails e passam confiança.
8. Agende `GET /api/cron/expire-orders` a cada minuto com o header `Authorization: Bearer <CRON_SECRET>`. Na Vercel isso já está no `vercel.json` (cron por minuto exige plano Pro; no plano grátis use um cron externo).
9. Cada produtor ativa o recebimento em **Painel → Recebimento**: isso cria o recebedor dele na Pagar.me com a conta bancária informada.

> Teste tudo primeiro com as chaves de **sandbox** (`sk_test_...`). Em especial o **débito**, que depende da autenticação 3DS do banco e precisa ser validado no sandbox antes de ir ao ar.

### Deploy

- **Vercel** + Postgres gerenciado: importe o repositório, configure as variáveis e rode `npx prisma migrate deploy` na primeira vez (ou no build).
- **Docker** (Railway, Render, Fly.io, AWS, VPS): o `Dockerfile` já aplica as migrations ao iniciar.

## Estrutura

```
prisma/schema.prisma              Modelo de dados
src/lib/orders.ts                 Criação do pedido, reserva de estoque, confirmação, expiração
src/lib/pricing.ts                Cálculo de desconto, taxa e split; lote vigente
src/lib/payments/                 Gateway (pagarme.ts real, mock.ts para dev)
src/app/evento/[slug]/            Página pública + checkout
src/app/pedido/[id]/              Pix / ingressos gerados
src/app/ingresso/[code]/          Ingresso individual com QR
src/app/painel/                   Painel do produtor (eventos, lotes, cupons, anunciantes, pedidos, check-in, recebimento)
src/app/api/                      checkout, cupom, status do pedido, webhook, check-in, cron
```

## Próximos passos sugeridos

- Envio do ingresso por WhatsApp
- Check-in sem internet (lista baixada no celular)
- Transferência de titularidade do ingresso
- Lista VIP / nome na lista
- Acesso do anunciante para ver as próprias vendas
- Painel administrativo da plataforma
