/** Regras de valor compartilhadas entre o servidor e a tela de agendamento (sem dependências de servidor). */

/** Menor valor aceito no pagamento online (a InfinitePay recusa abaixo de R$ 1,00). */
export const MIN_ONLINE_CENTS = 100;

/** Sinal: a porcentagem do procedimento, nunca abaixo do mínimo online (nem acima do valor total). */
export function depositCents(totalCents: number, percent: number) {
  const pct = Math.min(100, Math.max(1, percent));
  const value = Math.round((totalCents * pct) / 100);
  return Math.min(totalCents, Math.max(value, MIN_ONLINE_CENTS));
}

/* ───────────── Promoção (ex.: Black Friday) ───────────── */

export type Promo = { enabled: boolean; label: string; start: string; end: string };

/** A promoção vale hoje? (datas YYYY-MM-DD no fuso do studio; vazias = sem limite) */
export function promoActive(p: Promo, today: string) {
  return p.enabled && (!p.start || today >= p.start) && (!p.end || today <= p.end);
}

/**
 * Preço que vale agora para um procedimento. Com a promoção ativa e um preço promocional
 * menor que o normal, devolve o promocional (e o normal para mostrar riscado).
 */
export function servicePrice(svc: { priceCents: number; promoPriceCents: number | null }, p: Promo, today: string) {
  const promo = svc.promoPriceCents;
  if (promoActive(p, today) && promo != null && promo >= 0 && promo < svc.priceCents) {
    return { priceCents: promo, fullPriceCents: svc.priceCents as number | null, promoLabel: p.label.trim() || "Promoção" };
  }
  return { priceCents: svc.priceCents, fullPriceCents: null as number | null, promoLabel: "" };
}
