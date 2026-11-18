import { NextResponse, type NextRequest } from "next/server";
import { syncMercadoPagoPayment } from "@/lib/booking";
import { verifyWebhookSignature } from "@/lib/payments/mercadopago";
import { mercadoPagoConfigured } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Notificações do Mercado Pago. Nunca confiamos no corpo: buscamos o
 * pagamento na API do MP antes de confirmar qualquer coisa.
 */
export async function POST(req: NextRequest) {
  if (!mercadoPagoConfigured()) return NextResponse.json({ ok: true });

  const body = (await req.json().catch(() => ({}))) as { type?: string; action?: string; topic?: string; data?: { id?: string | number } };
  const sp = req.nextUrl.searchParams;
  const type = body.type ?? sp.get("type") ?? sp.get("topic");
  const dataId = String(body.data?.id ?? sp.get("data.id") ?? sp.get("id") ?? "");

  if (type !== "payment" || !dataId) return NextResponse.json({ ok: true });

  const valid = verifyWebhookSignature({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId: sp.get("data.id") ?? dataId,
  });
  if (!valid) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });

  try {
    await syncMercadoPagoPayment(dataId);
  } catch (err) {
    console.error("[webhook mercadopago]", err);
    return NextResponse.json({ error: "erro ao processar" }, { status: 500 }); // MP tenta de novo
  }
  return NextResponse.json({ ok: true });
}
