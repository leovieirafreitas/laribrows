import "server-only";
import { toStudioIso } from "@/lib/time";

/**
 * Checkout Integrado da InfinitePay — PIX e cartão de crédito (até 12x) numa página segura deles.
 * Documentação: https://www.infinitepay.io/checkout-documentacao
 *
 * - Cria um link de pagamento por cobrança (order_nsu = id do nosso pagamento).
 * - A confirmação chega pelo webhook e/ou pelo retorno da cliente (redirect_url), mas o webhook
 *   NÃO é assinado: sempre confirmamos com `/payment_check` antes de aprovar.
 */
const API = (process.env.INFINITEPAY_API_URL || "https://api.checkout.infinitepay.io").replace(/\/$/, "");

export function infinitePayConfigured() {
  return Boolean(process.env.INFINITEPAY_HANDLE?.trim());
}

/** Com chave de API dá para ajustar cada link (sem endereço, taxa do cartão, validade). */
export function infinitePayHasApiKey() {
  return Boolean(process.env.INFINITEPAY_API_KEY?.trim());
}

/** InfiniteTag sem o "$". */
export function infinitePayHandle() {
  return (process.env.INFINITEPAY_HANDLE ?? "").trim().replace(/^\$/, "");
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const apiKey = process.env.INFINITEPAY_API_KEY?.trim();
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(apiKey ? { "X-Api-Key": apiKey } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!res.ok) {
    console.error("[infinitepay]", res.status, path, JSON.stringify(data));
    throw new Error(data?.message || data?.error || `InfinitePay respondeu ${res.status}`);
  }
  return data;
}

const isPublicUrl = (url: string) => url.startsWith("https://") && !url.includes("localhost");

/** "+5511999887766" a partir de qualquer formato de telefone brasileiro. */
function phoneE164(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (!d) return undefined;
  if (!d.startsWith("55")) d = `55${d}`;
  return `+${d}`;
}

export async function createCheckoutLink(opts: {
  orderNsu: string;
  amountCents: number;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  customer: { name: string; email: string; phone: string };
  expiresAt: Date;
  /** Até quantas parcelas o studio assume a taxa do cartão (0 = a cliente paga a taxa em todas). */
  cardFeeAbsorbedUpTo: number;
}) {
  const withKey = Boolean(process.env.INFINITEPAY_API_KEY?.trim());
  const body = {
    handle: infinitePayHandle(),
    items: [{ quantity: 1, price: opts.amountCents, description: opts.description.slice(0, 120) }],
    order_nsu: opts.orderNsu,
    redirect_url: opts.redirectUrl,
    ...(isPublicUrl(opts.webhookUrl) ? { webhook_url: opts.webhookUrl } : {}),
    customer: {
      name: opts.customer.name,
      ...(opts.customer.email ? { email: opts.customer.email } : {}),
      ...(phoneE164(opts.customer.phone) ? { phone_number: phoneE164(opts.customer.phone) } : {}),
    },
    // Com chave de API: sem etapa de endereço de entrega (é um serviço no studio), taxa do cartão
    // repassada conforme o painel, link válido só enquanto o horário está reservado e de pagamento único.
    // (Sem chave, vale o que estiver em Configurações do Checkout no app da InfinitePay.)
    ...(withKey
      ? {
          options: {
            require_delivery_address: false,
            assured_installments: Math.min(12, Math.max(0, Math.round(opts.cardFeeAbsorbedUpTo))),
            single_payment: true,
            valid_until: toStudioIso(opts.expiresAt),
          },
        }
      : {}),
  };
  const r = await call<Record<string, unknown>>("/links", body);
  // A documentação não fixa o nome do campo: aceitamos as variações comuns.
  const url = [r.url, r.link, r.checkout_url, r.payment_url, (r.data as Record<string, unknown> | undefined)?.url].find(
    (v): v is string => typeof v === "string" && v.startsWith("http"),
  );
  if (!url) {
    console.error("[infinitepay] resposta sem link:", JSON.stringify(r));
    throw new Error("A InfinitePay não devolveu o link de pagamento.");
  }
  return { url };
}

export type InfinitePayCheck = {
  paid: boolean;
  amountCents: number;
  paidAmountCents: number;
  installments: number;
  method: "PIX" | "CARD" | null;
};

/** Confirma na InfinitePay se o pagamento foi feito (fonte da verdade). */
export async function paymentCheck(opts: { orderNsu: string; transactionNsu: string; slug: string }): Promise<InfinitePayCheck> {
  const r = await call<{ success?: boolean; paid?: boolean; amount?: number; paid_amount?: number; installments?: number; capture_method?: string }>(
    "/payment_check",
    { handle: infinitePayHandle(), order_nsu: opts.orderNsu, transaction_nsu: opts.transactionNsu, slug: opts.slug },
  );
  return {
    paid: r.success === true && r.paid === true,
    amountCents: Number(r.amount ?? 0),
    paidAmountCents: Number(r.paid_amount ?? 0),
    installments: Number(r.installments ?? 1),
    method: r.capture_method === "pix" ? "PIX" : r.capture_method === "credit_card" ? "CARD" : null,
  };
}
