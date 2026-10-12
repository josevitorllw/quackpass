import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Dados de demonstração.
// Produtor: produtor@demo.com / demo12345 · Admin: admin@demo.com / admin12345 · Portaria: folks.porta / porta123
async function main() {
  const producer = await db.producer.upsert({
    where: { email: "produtor@demo.com" },
    update: {},
    create: {
      name: "Folks Bar",
      email: "produtor@demo.com",
      passwordHash: await bcrypt.hash("demo12345", 10),
      document: "12345678909",
      phone: "41999999999",
      recipientId: "mock_rp_demo",
      status: "APPROVED",
      contactName: "Carlos Folks",
      city: "Curitiba",
      state: "PR",
    },
  });

  // Administrador da plataforma (em produção, crie com: npm run admin:create)
  await db.adminUser.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: { email: "admin@demo.com", name: "Admin Demo", passwordHash: await bcrypt.hash("admin12345", 10) },
  });
  // Acesso de portaria: login "folks.porta" / senha "porta123"
  await db.staffMember.upsert({
    where: { login: "folks.porta" },
    update: {},
    create: { producerId: producer.id, name: "João (porta)", login: "folks.porta", passwordHash: await bcrypt.hash("porta123", 10) },
  });
  // Um cadastro pendente, para ver o fluxo de aprovação
  await db.producer.upsert({
    where: { email: "novacasa@demo.com" },
    update: {},
    create: {
      name: "Nova Casa Bar",
      contactName: "Mariana Souza",
      email: "novacasa@demo.com",
      passwordHash: await bcrypt.hash("demo12345", 10),
      document: "12345678909",
      phone: "41988887777",
      city: "Curitiba",
      state: "PR",
      instagram: "novacasabar",
      venueType: "Bar",
      eventsPerMonth: "5 a 10",
      message: "Casa para 400 pessoas, fazemos festas toda sexta e sábado.",
    },
  });

  if (await db.event.findUnique({ where: { slug: "4-anos-folks-curitiba" } })) return;

  const startsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const event = await db.event.create({
    data: {
      producerId: producer.id,
      slug: "4-anos-folks-curitiba",
      title: "4 Anos Folks Curitiba",
      description:
        "A maior festa do ano está chegando! Para comemorar 4 anos de casa, preparamos **3 ambientes**, open bar e convidados especiais.\n\n- Open bar de chopp e drinks até 1h\n- 3 pistas: sertanejo, funk e eletrônica\n- Área VIP com camarote",
      venueName: "Folks Bar",
      address: "Rua Exemplo, 123 - Batel",
      city: "Curitiba",
      state: "PR",
      startsAt,
      status: "PUBLISHED",
      accentColor: "#7c3aed",
      contactPhone: "(41) 99999-9999",
      contactEmail: "contato@folksbar.com.br",
      contactInstagram: "folksbar",
      refundMode: "SELF_SERVICE",
      refundDeadlineHours: 48,
      // Lista: R$ 20 na porta até 2h30 depois do início; sem lista, R$ 50
      listEnabled: true,
      listPriceCents: 2000,
      doorPriceCents: 5000,
      listValidUntil: new Date(startsAt.getTime() + 2.5 * 3_600_000),
      content: [
        {
          type: "lineup",
          title: "Atrações",
          items: [
            { name: "DJ Alok Cover", detail: "23h" },
            { name: "Banda Sertaneja Raiz", detail: "00h30" },
            { name: "MC Convidado", detail: "02h" },
          ],
        },
      ],
      ticketTypes: {
        create: [
          {
            name: "Pista",
            sortOrder: 0,
            batches: {
              create: [
                { name: "1º lote", priceCents: 4000, quantity: 100, sortOrder: 0 },
                { name: "2º lote", priceCents: 6000, quantity: 200, sortOrder: 1 },
              ],
            },
          },
          {
            name: "VIP",
            description: "Área exclusiva + open bar premium",
            sortOrder: 1,
            batches: { create: [{ name: "Lote único", priceCents: 15000, quantity: 50, maxPerOrder: 4 }] },
          },
        ],
      },
    },
  });

  // Wesley ganha 10% por venda
  const wesley = await db.advertiser.create({
    data: {
      producerId: producer.id,
      name: "Wesley Promoter",
      instagram: "@wesley",
      commissionType: "PERCENT",
      commissionValue: 1000,
      // Na lista: R$ 3,00 por pessoa que entrar
      listCommissionType: "FIXED",
      listCommissionValue: 300,
      accessToken: "demo-wesley-link-secreto",
      publicCode: "wesley",
    },
  });
  await db.coupon.create({ data: { eventId: event.id, advertiserId: wesley.id, code: "WESLEY", discountType: "PERCENT", value: 10 } });
  console.log("Seed ok:", event.slug);
}

main().finally(() => db.$disconnect());
