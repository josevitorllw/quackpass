"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/ActionForm";
import { createSession, destroySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { markSplash } from "@/lib/splash";

export async function staffLogin(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ip = clientIp(new Request("http://x", { headers: headers() }));
  if (!rateLimit(`staff-login:${ip}`, 10, 60_000)) return { error: "Muitas tentativas. Aguarde um minuto." };
  const login = String(form.get("login") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const staff = await db.staffMember.findUnique({ where: { login }, include: { producer: true } });
  if (!staff || !(await bcrypt.compare(password, staff.passwordHash))) return { error: "Login ou senha incorretos" };
  if (!staff.active || staff.producer.status !== "APPROVED") return { error: "Acesso desativado. Fale com o responsável pela casa." };
  await db.staffMember.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
  await createSession("staff", staff.id);
  markSplash();
  redirect("/portaria/eventos");
}

export async function staffLogout() {
  destroySession("staff");
  redirect("/portaria");
}
