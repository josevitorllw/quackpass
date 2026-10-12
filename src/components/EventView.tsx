import type { Event, Producer } from "@prisma/client";
import { CalendarIcon, IdIcon, MailIcon, PhoneIcon, PinIcon, RefundIcon, ShieldIcon } from "@/components/Icons";
import { accentVars, parseContent, youtubeEmbed, type Block } from "@/lib/content";
import { refundPolicyText } from "@/lib/policy";
import { RichText } from "@/lib/text";

const longDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const time = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Página do evento (usada na página pública e na pré-visualização do produtor). */
export function EventView({
  event,
  producer,
  sidebar,
  notice,
}: {
  event: Event;
  producer: Pick<Producer, "name">;
  sidebar: React.ReactNode;
  notice?: React.ReactNode;
}) {
  const blocks = parseContent(event.content);
  const fullAddress = `${event.venueName}, ${event.address}, ${event.city} - ${event.state}`;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  return (
    <div style={accentVars(event.accentColor)}>
      {notice}
      <div className="container-page pt-6">
        <div className="overflow-hidden rounded-2xl bg-slate-200">
          {event.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.bannerUrl} alt={event.title} className="aspect-[16/9] w-full object-cover sm:aspect-[21/8]" />
          ) : (
            <div className="aspect-[16/9] w-full bg-[var(--accent)] opacity-90 sm:aspect-[21/8]" />
          )}
        </div>
      </div>

      {/* No celular: título → compra → conteúdo. No desktop: compra fixa na lateral. */}
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[1fr_400px] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          <div className="space-y-3">
            <span className="badge bg-slate-900 text-white">+{event.minAge} anos</span>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{event.title}</h1>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoItem icon={<CalendarIcon className="h-5 w-5 text-[var(--accent-ink)]" />} title={capitalize(longDate(event.startsAt))}>
                {time(event.startsAt)}
                {event.endsAt && ` às ${time(event.endsAt)}`}
              </InfoItem>
              <InfoItem icon={<PinIcon className="h-5 w-5 text-[var(--accent-ink)]" />} title={event.venueName}>
                <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {event.address}, {event.city}/{event.state}
                </a>
              </InfoItem>
            </div>
          </div>

          {event.status === "CANCELLED" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
              Este evento foi cancelado. Quem comprou recebe o reembolso integral.
            </div>
          )}
        </div>

        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="space-y-4 lg:sticky lg:top-20">
            {sidebar}
            <ul className="card space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <ShieldIcon className="h-5 w-5 shrink-0 text-emerald-600" /> Compra segura: os dados do cartão são enviados direto ao processador de pagamento.
              </li>
              <li className="flex gap-3">
                <MailIcon className="h-5 w-5 shrink-0 text-slate-500" /> Ingresso com QR Code enviado para o seu e-mail na hora.
              </li>
              <li className="flex gap-3">
                <RefundIcon className="h-5 w-5 shrink-0 text-slate-500" /> {refundPolicyText(event)}
              </li>
              <li className="flex gap-3">
                <IdIcon className="h-5 w-5 shrink-0 text-slate-500" /> Proibido para menores de {event.minAge} anos. Leve documento com foto.
              </li>
            </ul>
          </div>
        </aside>

        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">

          {event.description && (
            <section className="space-y-2">
              <h2 className="section-title">Sobre o evento</h2>
              <RichText text={event.description} className="text-slate-700" />
            </section>
          )}

          {blocks.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}

          {event.showMap && (
            <section className="space-y-2">
              <h2 className="section-title">Local</h2>
              <p className="text-slate-600">{fullAddress}</p>
              <iframe
                title="Mapa do local"
                src={`https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`}
                className="h-72 w-full rounded-xl border border-slate-200"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </section>
          )}

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="card space-y-2">
              <h2 className="font-bold">Organizador</h2>
              <p className="text-slate-700">{producer.name}</p>
              {event.contactPhone && (
                <a href={`https://wa.me/55${event.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                  <PhoneIcon /> {event.contactPhone}
                </a>
              )}
              {event.contactEmail && (
                <a href={`mailto:${event.contactEmail}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                  <MailIcon className="h-4 w-4" /> {event.contactEmail}
                </a>
              )}
              {event.contactInstagram && (
                <a href={`https://instagram.com/${event.contactInstagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="block text-sm text-slate-600 hover:text-slate-900">
                  Instagram: @{event.contactInstagram.replace(/^@/, "")}
                </a>
              )}
            </div>
            <div className="card space-y-2">
              <h2 className="font-bold">Política de reembolso</h2>
              <p className="text-sm text-slate-600">{refundPolicyText(event)}</p>
              <p className="text-xs text-slate-500">Ingressos já utilizados não podem ser reembolsados.</p>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function InfoItem({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-slate-600">{children}</p>
      </div>
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "text":
      return (
        <section className="space-y-2">
          {block.title && <h2 className="section-title">{block.title}</h2>}
          <RichText text={block.body} className="text-slate-700" />
        </section>
      );
    case "image":
      return (
        <figure className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.url} alt={block.caption} className="w-full rounded-xl" loading="lazy" />
          {block.caption && <figcaption className="text-center text-sm text-slate-500">{block.caption}</figcaption>}
        </figure>
      );
    case "gallery":
      return (
        <section className="space-y-3">
          {block.title && <h2 className="section-title">{block.title}</h2>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {block.images.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="aspect-square w-full rounded-lg object-cover transition hover:opacity-90" loading="lazy" />
              </a>
            ))}
          </div>
        </section>
      );
    case "lineup":
      return (
        <section className="space-y-3">
          <h2 className="section-title">{block.title}</h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {block.items.map((it, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-semibold">{it.name}</span>
                {it.detail && <span className="text-sm text-slate-500">{it.detail}</span>}
              </li>
            ))}
          </ul>
        </section>
      );
    case "video": {
      const src = youtubeEmbed(block.url);
      if (!src) return null;
      return (
        <iframe
          src={src}
          title="Vídeo do evento"
          className="aspect-video w-full rounded-xl"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      );
    }
  }
}
