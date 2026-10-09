"use server";

import { headers } from "next/headers";
import type { ActionState } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { addNames, ListError } from "@/lib/guestlist";
import { onlyDigits } from "@/lib/format";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/** A própria pessoa coloca o nome na lista (do promoter do link, ou da casa). */
export async function publicListSignup(eventId: string, code: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  const ip = clientIp(new Request("http://x", { headers: headers() }));
  if (!rateLimit(`lista:${ip}`, 5, 10 * 60_000)) return { error: "Muitas tentativas. Tente de novo em alguns minutos." };

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || !event.listPublicSignup) return { error: "Este evento não aceita nomes pelo site" };
  const adv = code ? await db.advertiser.findFirst({ where: { publicCode: code, producerId: event.producerId, active: true } }) : null;

  const name = String(form.get("name") ?? "");
  const phone = onlyDigits(String(form.get("phone") ?? ""));
  if (phone && (phone.length < 10 || phone.length > 13)) return { error: "WhatsApp inválido" };
  try {
    const r = await addNames({ eventId: event.id, advertiserId: adv?.id ?? null, names: [name], source: "PUBLIC", phone: phone || null });
    if (r.invalid) return { error: "Informe nome e sobrenome" };
    if (r.duplicates) return { ok: "Seu nome já estava na lista. É só chegar e falar o seu nome na portaria!" };
    return { ok: `Pronto! O nome ${name.trim()} está na lista${adv ? ` do ${adv.name}` : ""}. É só falar o seu nome na portaria.` };
  } catch (err) {
    return { error: err instanceof ListError ? err.message : "Não foi possível colocar o nome agora" };
  }
}
