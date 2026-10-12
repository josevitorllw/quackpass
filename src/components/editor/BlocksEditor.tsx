"use client";

import { useState } from "react";
import type { Block, BlockType } from "@/lib/content";
import { ImageInput } from "./ImageInput";
import { uploadImage } from "./upload";

const LABELS: Record<BlockType, string> = {
  text: "Texto",
  image: "Imagem",
  gallery: "Galeria de fotos",
  lineup: "Atrações / line-up",
  video: "Vídeo do YouTube",
};

const EMPTY: Record<BlockType, () => Block> = {
  text: () => ({ type: "text", title: "", body: "" }),
  image: () => ({ type: "image", url: "", caption: "" }),
  gallery: () => ({ type: "gallery", title: "Fotos", images: [] }),
  lineup: () => ({ type: "lineup", title: "Atrações", items: [{ name: "", detail: "" }] }),
  video: () => ({ type: "video", url: "" }),
};

/** Editor dos blocos da página do evento. Salva tudo como JSON num input escondido. */
export function BlocksEditor({ name, initial }: { name: string; initial: Block[] }) {
  const [blocks, setBlocks] = useState<Block[]>(initial);

  const update = (i: number, b: Block) => setBlocks((bs) => bs.map((x, j) => (j === i ? b : x)));
  const move = (i: number, d: -1 | 1) =>
    setBlocks((bs) => {
      const j = i + d;
      if (j < 0 || j >= bs.length) return bs;
      const c = [...bs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const remove = (i: number) => setBlocks((bs) => bs.filter((_, j) => j !== i));

  // Remove blocos vazios antes de salvar
  const clean = blocks.filter((b) => {
    if (b.type === "text") return b.title.trim() || b.body.trim();
    if (b.type === "image" || b.type === "video") return b.url.trim();
    if (b.type === "gallery") return b.images.length > 0;
    if (b.type === "lineup") return b.items.some((i) => i.name.trim());
    return true;
  }).map((b) =>
    b.type === "lineup" ? { ...b, items: b.items.filter((i) => i.name.trim()) } : b,
  );

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(clean)} />
      {blocks.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
          Monte a página do seu evento adicionando blocos abaixo: textos, fotos, atrações e vídeo.
        </p>
      )}
      {blocks.map((b, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold text-slate-700">{LABELS[b.type]}</span>
            <div className="flex gap-1">
              <IconBtn label="Mover para cima" onClick={() => move(i, -1)} disabled={i === 0}>
                ↑
              </IconBtn>
              <IconBtn label="Mover para baixo" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}>
                ↓
              </IconBtn>
              <IconBtn label="Remover bloco" onClick={() => remove(i)}>
                ✕
              </IconBtn>
            </div>
          </div>
          <div className="space-y-3 p-3">
            <BlockFields block={b} onChange={(nb) => update(i, nb)} />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABELS) as BlockType[]).map((t) => (
          <button key={t} type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setBlocks((bs) => [...bs, EMPTY[t]()])}>
            + {LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

function IconBtn({ children, label, ...rest }: { children: React.ReactNode; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} className="grid h-7 w-7 place-items-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30" {...rest}>
      {children}
    </button>
  );
}

function BlockFields({ block: b, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (b.type) {
    case "text":
      return (
        <>
          <input className="input" placeholder="Título (opcional)" value={b.title} onChange={(e) => onChange({ ...b, title: e.target.value })} />
          <textarea className="input min-h-32" placeholder="Escreva aqui..." value={b.body} onChange={(e) => onChange({ ...b, body: e.target.value })} />
          <p className="hint">Dica: **negrito**, *itálico*, [link](https://...) e listas com &quot;- &quot; no começo da linha.</p>
        </>
      );
    case "image":
      return (
        <>
          <ImageInput value={b.url} onChange={(url) => onChange({ ...b, url })} aspect="aspect-video" />
          <input className="input" placeholder="Legenda (opcional)" value={b.caption} onChange={(e) => onChange({ ...b, caption: e.target.value })} />
        </>
      );
    case "gallery":
      return <GalleryFields block={b} onChange={onChange} />;
    case "lineup":
      return (
        <>
          <input className="input" placeholder="Título" value={b.title} onChange={(e) => onChange({ ...b, title: e.target.value })} />
          {b.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input className="input" placeholder="Nome (ex.: DJ Fulano)" value={it.name} onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <input className="input" placeholder="Detalhe (ex.: 23h)" value={it.detail} onChange={(e) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)) })} />
              <IconBtn label="Remover" onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== i) })}>
                ✕
              </IconBtn>
            </div>
          ))}
          <button type="button" className="text-sm font-medium text-brand-700" onClick={() => onChange({ ...b, items: [...b.items, { name: "", detail: "" }] })}>
            + Adicionar atração
          </button>
        </>
      );
    case "video":
      return <input className="input" placeholder="Link do YouTube (ex.: https://youtu.be/...)" value={b.url} onChange={(e) => onChange({ ...b, url: e.target.value })} />;
  }
}

function GalleryFields({ block: b, onChange }: { block: Extract<Block, { type: "gallery" }>; onChange: (b: Block) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, 24 - b.images.length)) {
      try {
        urls.push(await uploadImage(f));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha no envio");
      }
    }
    onChange({ ...b, images: [...b.images, ...urls] });
    setBusy(false);
  }
  return (
    <>
      <input className="input" placeholder="Título (opcional)" value={b.title} onChange={(e) => onChange({ ...b, title: e.target.value })} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {b.images.map((src, i) => (
          <div key={src + i} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="aspect-square w-full rounded-lg object-cover" />
            <button type="button" aria-label="Remover foto" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-xs shadow" onClick={() => onChange({ ...b, images: b.images.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
        <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 text-center text-xs text-slate-500 hover:border-brand-500">
          {busy ? "Enviando..." : "+ Fotos"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(e) => add(e.target.files)} />
        </label>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </>
  );
}
