/** Mensagem amigável depois de adicionar nomes à lista. */
export function listResultMessage(r: { added: number; duplicates: number; overLimit: number; invalid: number }): string {
  const parts = [`${r.added} nome(s) adicionado(s)`];
  if (r.duplicates) parts.push(`${r.duplicates} já estava(m) na lista`);
  if (r.overLimit) parts.push(`${r.overLimit} não entrou(aram) por causa do limite`);
  if (r.invalid) parts.push(`${r.invalid} ignorado(s): informe nome e sobrenome`);
  return parts.join(" · ");
}
