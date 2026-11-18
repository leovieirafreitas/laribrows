const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number) {
  return brl.format(cents / 100);
}

/** "R$ 150,00" → 15000. Aceita "150", "150,5", "1.250,00". */
export function parseBRL(value: string) {
  const clean = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

export function formatPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Link wa.me com DDI 55 */
export function whatsappLink(phone: string, text?: string) {
  let d = onlyDigits(phone);
  if (!d) return "";
  if (!d.startsWith("55")) d = `55${d}`;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function instagramLink(handle: string) {
  const h = handle.replace(/^@/, "").trim();
  return h ? `https://instagram.com/${h}` : "";
}
