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

/**
 * DDD + número, sem o +55 nem zeros na frente. O celular costuma preencher "+55 92 99999-9999"
 * (13 dígitos): o 55 só é tratado como DDI quando sobra mais que um telefone (11 dígitos),
 * porque 55 também é DDD (RS).
 */
export function nationalPhone(v: string) {
  let d = onlyDigits(v).replace(/^0+/, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2).replace(/^0+/, "");
  return d;
}

/** Telefone brasileiro completo (DDD + 8 ou 9 dígitos)? */
export function isValidPhone(v: string) {
  const n = nationalPhone(v).length;
  return n === 10 || n === 11;
}

/** "5592999887766" (DDI 55 + DDD + número), ou "" se não for um telefone brasileiro completo. */
export function phoneWithCountry(v: string) {
  return isValidPhone(v) ? `55${nationalPhone(v)}` : "";
}

export function formatPhone(v: string) {
  const d = nationalPhone(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Link wa.me com DDI 55 */
export function whatsappLink(phone: string, text?: string) {
  const d = phoneWithCountry(phone) || onlyDigits(phone);
  if (!d) return "";
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
