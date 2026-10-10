export function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dateTime(d: Date): string {
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** "R$ 1.234,56" | "1234,56" | "1234.56" -> centavos */
export function parseMoney(input: string): number {
  const clean = input.replace(/[^\d,.]/g, "");
  if (!clean) return NaN;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  return Math.round(Number(normalized) * 100);
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Converte "2026-12-31T23:00" (input datetime-local, horário de Brasília) em Date */
export function parseLocalDateTime(s: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toLocalInput(d: Date | null | undefined): string {
  if (!d) return "";
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

/** Dia e mês abreviado em Brasília, para o selo de data dos cards: { day: "12", month: "OUT" } */
export function dayMonth(d: Date): { day: string; month: string } {
  const tz = "America/Sao_Paulo";
  return {
    day: d.toLocaleString("pt-BR", { timeZone: tz, day: "2-digit" }),
    month: d.toLocaleString("pt-BR", { timeZone: tz, month: "short" }).replace(".", "").toUpperCase(),
  };
}
