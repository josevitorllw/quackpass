import type { CSSProperties } from "react";
import { z } from "zod";

/** Blocos que o produtor monta na página do evento. Guardados em Event.content (JSON). */
const url = z.string().trim().max(500).refine((u) => u.startsWith("/api/uploads/") || /^https:\/\//.test(u), "URL inválida");

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), title: z.string().max(120).default(""), body: z.string().max(8000).default("") }),
  z.object({ type: z.literal("image"), url, caption: z.string().max(200).default("") }),
  z.object({ type: z.literal("gallery"), title: z.string().max(120).default(""), images: z.array(url).max(24) }),
  z.object({
    type: z.literal("lineup"),
    title: z.string().max(120).default("Atrações"),
    items: z.array(z.object({ name: z.string().max(120), detail: z.string().max(120).default("") })).max(40),
  }),
  z.object({ type: z.literal("video"), url: z.string().trim().max(300) }),
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];

export const contentSchema = z.array(blockSchema).max(40);

/** Ignora blocos inválidos ou de tipos que não existem mais (ex.: o antigo "perguntas frequentes"). */
export function parseContent(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((b) => {
    const parsed = blockSchema.safeParse(b);
    return parsed.success ? [parsed.data] : [];
  }).slice(0, 40);
}

/** Aceita links do YouTube (watch, youtu.be, shorts) e devolve a URL de embed. */
export function youtubeEmbed(input: string): string | null {
  try {
    const u = new URL(input);
    let id: string | null = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    else if (u.hostname.endsWith("youtube.com")) {
      id = u.searchParams.get("v") ?? u.pathname.match(/^\/(shorts|embed)\/([\w-]+)/)?.[2] ?? null;
    }
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

/**
 * Cores pré-aprovadas para a página do evento.
 * fg = cor do texto em cima da cor (botões); ink = a cor usada como texto/ícone sobre fundo branco.
 * Assim o amarelo fica legível: botão amarelo com texto escuro e textos em dourado escuro.
 */
export const ACCENT_COLORS = [
  { value: "#facc15", name: "Amarelo", fg: "#0f172a", ink: "#a16207" },
  { value: "#1d4ed8", name: "Azul", fg: "#ffffff", ink: "#1d4ed8" },
  { value: "#0f766e", name: "Verde-petróleo", fg: "#ffffff", ink: "#0f766e" },
  { value: "#15803d", name: "Verde", fg: "#ffffff", ink: "#15803d" },
  { value: "#7c3aed", name: "Roxo", fg: "#ffffff", ink: "#7c3aed" },
  { value: "#be123c", name: "Vermelho", fg: "#ffffff", ink: "#be123c" },
  { value: "#c2410c", name: "Laranja", fg: "#ffffff", ink: "#c2410c" },
  { value: "#0f172a", name: "Preto", fg: "#ffffff", ink: "#0f172a" },
];

export const DEFAULT_ACCENT = ACCENT_COLORS[0].value;

/** Variáveis CSS da cor do evento: --accent (fundo), --accent-fg (texto no fundo), --accent-ink (texto no branco). */
export function accentVars(color: string): CSSProperties {
  const c = ACCENT_COLORS.find((a) => a.value === color) ?? { value: color, fg: "#ffffff", ink: color };
  return { "--accent": c.value, "--accent-fg": c.fg, "--accent-ink": c.ink } as CSSProperties;
}
