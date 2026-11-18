import { NextResponse } from "next/server";
import { syncInfinitePayPayment } from "@/lib/booking";

export const dynamic = "force-dynamic";

/**
 * Aviso de pagamento da InfinitePay. O webhook não é assinado, então nunca confiamos no corpo:
 * syncInfinitePayPayment confirma com a InfinitePay (/payment_check) antes de aprovar.
 * Respostas fora de 2xx fazem a InfinitePay reenviar.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    order_nsu?: string;
    transaction_nsu?: string;
    invoice_slug?: string;
    slug?: string;
  } | null;
  const orderNsu = body?.order_nsu;
  const transactionNsu = body?.transaction_nsu;
  const slug = body?.invoice_slug ?? body?.slug;
  if (!orderNsu || !transactionNsu || !slug) return NextResponse.json({ error: "payload incompleto" }, { status: 400 });

  try {
    await syncInfinitePayPayment({ orderNsu, transactionNsu, slug });
  } catch (err) {
    console.error("[webhook infinitepay]", err);
    return NextResponse.json({ error: "erro ao confirmar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
