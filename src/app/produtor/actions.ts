"use server";

import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/ActionForm";
import { createSession, destroySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { safely, sendLeadReceivedEmail, sendNewLeadEmail, sendPasswordResetEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { onlyDigits } from "@/lib/format";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { markSplash } from "@/lib/splash";

function ip() {
  return clientIp(new Request("http://x", { headers: headers() }));
}

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const signupSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da casa ou produtora").max(120),
  contactName: z.string().trim().min(3, "Informe o nome do responsável").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  phone: z.string().transform(onlyDigits).pipe(z.string().min(10, "WhatsApp inválido").max(13)),
  document: z.string().transform(onlyDigits).pipe(z.string().regex(/^(\d{11}|\d{14})$/, "CPF ou CNPJ inválido")),
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  state: z.string().trim().length(2, "UF com 2 letras").transform((s) => s.toUpperCase()),
  instagram: opt(60),
  venueType: opt(40),
  eventsPerMonth: opt(20),
  message: opt(1000),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres").max(100),
});

/** Cadastro = pedido de parceria. Fica PENDENTE até o dono da plataforma aprovar. */
export async function signup(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!rateLimit(`signup:${ip()}`, 5, 60_000)) return { error: "Muitas tentativas. Aguarde um minuto." };
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { password, ...data } = parsed.data;
  if (await db.producer.findUnique({ where: { email: data.email } })) {
    return { error: "Já existe um cadastro com este e-mail. Entre ou use \"Esqueci minha senha\"." };
  }
  const producer = await db.producer.create({
    data: { ...data, instagram: data.instagram?.replace(/^@/, "") ?? null, passwordHash: await bcrypt.hash(password, 10) },
  });
  await safely(() => sendNewLeadEmail(producer), `lead ${producer.id}`);
  await safely(() => sendLeadReceivedEmail(producer), `lead-recebido ${producer.id}`);
  await createSession("producer", producer.id);
  redirect("/produtor/aguardando");
}

export async function login(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!rateLimit(`login:${ip()}`, 10, 60_000)) return { error: "Muitas tentativas. Aguarde um minuto." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const producer = await db.producer.findUnique({ where: { email } });
  if (!producer || !(await bcrypt.compare(password, producer.passwordHash))) return { error: "E-mail ou senha incorretos" };
  if (producer.status === "BLOCKED") return { error: `Acesso bloqueado. Fale com ${env.supportEmail}.` };
  await createSession("producer", producer.id);
  markSplash();
  redirect(producer.status === "APPROVED" ? "/painel" : "/produtor/aguardando");
}

export async function logout() {
  destroySession("producer");
  redirect("/produtor/login");
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Sempre responde igual, exista ou não o e-mail (não revela quem tem cadastro). */
export async function forgotPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!rateLimit(`forgot:${ip()}`, 5, 15 * 60_000) || !rateLimit(`forgot:${email}`, 3, 60 * 60_000)) {
    return { error: "Muitas tentativas. Tente de novo mais tarde." };
  }
  const producer = await db.producer.findUnique({ where: { email } });
  if (producer && producer.status !== "BLOCKED") {
    const token = randomBytes(32).toString("base64url");
    await db.passwordResetToken.create({
      data: { producerId: producer.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60_000) },
    });
    const link = `${env.producerUrl}/produtor/redefinir-senha?token=${token}`;
    await safely(() => sendPasswordResetEmail(producer, link), `reset ${producer.id}`);
  }
  return { ok: "Se este e-mail tiver cadastro, enviamos um link para criar uma nova senha. Confira também o spam." };
}

export async function resetPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!rateLimit(`reset:${ip()}`, 10, 15 * 60_000)) return { error: "Muitas tentativas. Aguarde." };
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres" };
  if (password !== String(form.get("confirm") ?? "")) return { error: "As senhas não conferem" };

  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "Link inválido ou expirado. Peça um novo em \"Esqueci minha senha\"." };
  }
  // Marca como usado antes (o mesmo link não serve duas vezes) e invalida os outros links pendentes
  const used = await db.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count === 0) return { error: "Este link já foi usado." };
  await db.$transaction([
    db.producer.update({ where: { id: record.producerId }, data: { passwordHash: await bcrypt.hash(password, 10) } }),
    db.passwordResetToken.updateMany({ where: { producerId: record.producerId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  return { ok: "Senha alterada! Você já pode entrar com a nova senha." };
}
