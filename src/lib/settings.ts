import "server-only";
import { eq } from "drizzle-orm";
import { db, settings, type Settings } from "@/lib/db";
import { infinitePayConfigured } from "@/lib/payments/infinitepay";
import { depositCents, promoActive, type Promo } from "@/lib/pricing";
import { todayInStudio } from "@/lib/time";

async function loadSettings(): Promise<Settings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (row) return row;
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  return (await db.query.settings.findFirst({ where: eq(settings.id, 1) }))!;
}

/*
 * As configurações mudam raramente e são lidas em quase toda página:
 * guardamos em memória por 30s (e limpamos na hora quando o painel salva).
 */
const SETTINGS_TTL_MS = 30_000;
const memo = globalThis as unknown as { __lbSettings?: { at: number; value: Promise<Settings> } };

export function getSettings(): Promise<Settings> {
  const hit = memo.__lbSettings;
  if (hit && Date.now() - hit.at < SETTINGS_TTL_MS) return hit.value;
  const value = loadSettings().catch((err) => {
    memo.__lbSettings = undefined; // não guarda erro
    throw err;
  });
  memo.__lbSettings = { at: Date.now(), value };
  return value;
}

export function invalidateSettingsCache() {
  memo.__lbSettings = undefined;
}

export function mercadoPagoConfigured() {
  return Boolean(process.env.MP_ACCESS_TOKEN?.trim());
}

/** Quem processa PIX/cartão online: InfinitePay (preferida) ou Mercado Pago. */
export function onlineGateway(): "infinitepay" | "mercadopago" | null {
  if (infinitePayConfigured()) return "infinitepay";
  if (mercadoPagoConfigured()) return "mercadopago";
  return null;
}

export const GATEWAY_LABEL = { infinitepay: "InfinitePay", mercadopago: "Mercado Pago" } as const;

/**
 * Simulação de pagamentos (botão "aprovar" sem cobrar nada) só quando ligada de propósito
 * com ALLOW_PAYMENT_SIMULATION=true — use só no computador de testes, nunca no site publicado.
 */
export function paymentSimulationAllowed() {
  return !onlineGateway() && process.env.ALLOW_PAYMENT_SIMULATION === "true";
}

/** Formas de pagamento que funcionam de verdade agora (configuração do painel + credenciais). */
export function availableMethods(s: Settings) {
  const online = onlineGateway() !== null;
  const sim = paymentSimulationAllowed();
  const pixManual = s.pixProvider === "manual" && Boolean(s.pixKey);
  const pix = s.pixEnabled && (pixManual || online || sim);
  const card = s.cardEnabled && (online || sim);
  return {
    pix,
    card,
    /** Alguma forma vai cair na simulação. */
    simulation: !online && sim && ((s.pixEnabled && !pixManual) || s.cardEnabled),
    /** Algo foi ligado no painel mas não funciona por falta de credencial. */
    missingSetup: (s.pixEnabled && !pix) || (s.cardEnabled && !card),
  };
}

export function mercadoPagoIsTest() {
  return process.env.MP_ACCESS_TOKEN?.startsWith("TEST-") ?? false;
}

export { siteUrl } from "@/lib/env";

/** Valor cobrado no ato do agendamento. */
export function computeDueNow(s: Settings, totalCents: number, payOption: "DEPOSIT" | "FULL") {
  if (s.chargeMode === "none") return 0;
  if (s.chargeMode === "full") return totalCents;
  if (payOption === "FULL" && s.allowFullPayment) return totalCents;
  return depositCents(totalCents, s.depositPercent);
}

/**
 * Como a taxa do cartão aparece para a cliente (InfinitePay).
 * absorbedUpTo = até quantas parcelas o studio assume a taxa; acima disso, a InfinitePay soma a taxa ao valor.
 */
export function cardFeeText(absorbedUpTo: number) {
  if (absorbedUpTo >= 12) return { short: "Em até 12x sem acréscimo", long: "Cartão de crédito em até 12x sem acréscimo." };
  if (absorbedUpTo <= 0)
    return { short: "Em até 12x · com taxa do cartão", long: "No cartão de crédito, a taxa do cartão é somada ao valor (PIX sem acréscimo)." };
  return {
    short: `Até ${absorbedUpTo}x sem acréscimo`,
    long: `Cartão em até ${absorbedUpTo}x sem acréscimo; de ${absorbedUpTo + 1}x a 12x, a taxa do cartão é somada ao valor.`,
  };
}

/** Promoção configurada no painel (Procedimentos). */
export function promoOf(s: Settings): Promo {
  return { enabled: s.promoEnabled, label: s.promoLabel, start: s.promoStart, end: s.promoEnd };
}

/** Configuração pública, segura para mandar ao navegador. */
export function publicSettings(s: Settings) {
  return {
    studioName: s.studioName,
    chargeMode: s.chargeMode,
    depositPercent: s.depositPercent,
    allowFullPayment: s.allowFullPayment,
    // Só oferece à cliente o que funciona de verdade.
    pixEnabled: availableMethods(s).pix,
    cardEnabled: availableMethods(s).card,
    maxInstallments: s.maxInstallments,
    /** Textos curtos das opções de pagamento. */
    cardHint: onlineGateway() === "infinitepay" ? cardFeeText(s.cardFeeAbsorbedUpTo).short : s.maxInstallments > 1 ? `Em até ${s.maxInstallments}x` : "À vista",
    /** Aviso antes de ir para a página de pagamento externa (a InfinitePay só volta ao site com "Continuar"). */
    checkoutNote: onlineGateway() === "infinitepay" ? "Você vai para a página segura da InfinitePay. Depois de pagar, toque em “Continuar” na tela da InfinitePay para voltar ao site com o horário confirmado." : "",
    pixHint: onlineGateway() === "infinitepay" && s.cardFeeAbsorbedUpTo < 12 ? "Sem acréscimo · aprovação na hora" : "Aprovação na hora",
    cancellationPolicy: s.cancellationPolicy,
    promo: promoActive(promoOf(s), todayInStudio()) ? { label: s.promoLabel.trim() || "Promoção", end: s.promoEnd } : null,
  };
}
export type PublicSettings = ReturnType<typeof publicSettings>;
