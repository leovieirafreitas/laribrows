import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { toStudioIso } from "@/lib/time";

/**
 * Integração direta com a API REST do Mercado Pago.
 * - PIX: cria o pagamento e devolve o QR / copia-e-cola (confirmação automática).
 * - Cartão de crédito: Checkout Pro (página segura do Mercado Pago, com parcelamento).
 */
const API = "https://api.mercadopago.com";

function token() {
  const t = process.env.MP_ACCESS_TOKEN?.trim();
  if (!t) throw new Error("MP_ACCESS_TOKEN não configurado");
  return t;
}

async function mp<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[mercadopago]", res.status, path, JSON.stringify(body));
    throw new Error(body?.message || `Mercado Pago respondeu ${res.status}`);
  }
  return body as T;
}

const isPublicUrl = (url: string) => url.startsWith("https://") && !url.includes("localhost");

/** Formato aceito pelo MP: 2026-11-17T21:30:00.000-04:00 (fuso do studio). */
const mpDate = (d: Date) => toStudioIso(d);

export async function createPixPayment(opts: {
  amountCents: number;
  description: string;
  payerEmail: string;
  payerName: string;
  externalReference: string;
  expiresAt: Date;
  notificationUrl: string;
}) {
  const [firstName, ...rest] = opts.payerName.trim().split(/\s+/);
  const body = {
    transaction_amount: opts.amountCents / 100,
    description: opts.description,
    payment_method_id: "pix",
    external_reference: opts.externalReference,
    date_of_expiration: mpDate(opts.expiresAt),
    payer: { email: opts.payerEmail, first_name: firstName, last_name: rest.join(" ") || undefined },
    ...(isPublicUrl(opts.notificationUrl) ? { notification_url: opts.notificationUrl } : {}),
  };
  const r = await mp<{
    id: number;
    status: string;
    point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
  }>("/v1/payments", { method: "POST", body: JSON.stringify(body), idempotencyKey: opts.externalReference });
  return {
    id: String(r.id),
    status: r.status,
    pixCode: r.point_of_interaction?.transaction_data?.qr_code ?? "",
  };
}

export async function createCardCheckout(opts: {
  amountCents: number;
  title: string;
  payerEmail: string;
  payerName: string;
  externalReference: string;
  backUrl: string;
  notificationUrl: string;
  maxInstallments: number;
  expiresAt: Date;
  statementDescriptor?: string;
}) {
  const body = {
    items: [
      {
        id: opts.externalReference,
        title: opts.title,
        quantity: 1,
        currency_id: "BRL",
        unit_price: opts.amountCents / 100,
      },
    ],
    payer: { email: opts.payerEmail, name: opts.payerName },
    external_reference: opts.externalReference,
    statement_descriptor: (opts.statementDescriptor || "STUDIO").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 13).toUpperCase(),
    payment_methods: {
      excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "bank_transfer" }, { id: "debit_card" }],
      installments: Math.max(1, Math.min(12, opts.maxInstallments)),
    },
    back_urls: { success: opts.backUrl, failure: opts.backUrl, pending: opts.backUrl },
    ...(isPublicUrl(opts.backUrl) ? { auto_return: "approved" } : {}),
    ...(isPublicUrl(opts.notificationUrl) ? { notification_url: opts.notificationUrl } : {}),
    expires: true,
    expiration_date_to: mpDate(opts.expiresAt),
  };
  const r = await mp<{ id: string; init_point: string }>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { id: r.id, checkoutUrl: r.init_point };
}

export type MpPayment = {
  id: number;
  status: "pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back";
  external_reference: string | null;
  transaction_amount: number;
  payment_type_id: string;
};

export function getPayment(id: string) {
  return mp<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`);
}

/** Valida a assinatura x-signature dos webhooks (se MP_WEBHOOK_SECRET estiver definido). */
export function verifyWebhookSignature(opts: { xSignature: string | null; xRequestId: string | null; dataId: string }) {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  if (!opts.xSignature) return false;
  const parts = Object.fromEntries(
    opts.xSignature.split(",").map((p) => {
      const [k, v] = p.split("=").map((s) => s.trim());
      return [k, v];
    }),
  );
  if (!parts.ts || !parts.v1) return false;
  const dataId = /^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId;
  let manifest = `id:${dataId};`;
  if (opts.xRequestId) manifest += `request-id:${opts.xRequestId};`;
  manifest += `ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  } catch {
    return false;
  }
}
