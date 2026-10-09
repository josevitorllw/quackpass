"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { addNames, ListError } from "@/lib/guestlist";
import { listResultMessage } from "@/lib/list-messages";
import { promoterByToken } from "@/lib/promoter";

export async function promoterAddNames(token: string, eventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const adv = await promoterByToken(token);
  if (!adv) return { error: "Link inválido. Peça um novo link para a casa." };
  const event = await db.event.findFirst({ where: { id: eventId, producerId: adv.producerId } });
  if (!event) return { error: "Evento não encontrado" };
  try {
    const r = await addNames({ eventId: event.id, advertiserId: adv.id, names: String(form.get("names") ?? "").split("\n"), source: "PROMOTER" });
    revalidatePath(`/promoter/${token}/evento/${event.id}`);
    return { ok: listResultMessage(r) };
  } catch (err) {
    return { error: err instanceof ListError ? err.message : "Erro ao adicionar nomes" };
  }
}

export async function promoterRemoveName(token: string, eventId: string, entryId: string) {
  const adv = await promoterByToken(token);
  if (!adv) return;
  // Só remove nomes dele que ainda não entraram
  await db.guestListEntry.deleteMany({ where: { id: entryId, eventId, advertiserId: adv.id, doorSale: null } });
  revalidatePath(`/promoter/${token}/evento/${eventId}`);
}
