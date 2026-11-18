import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CreditCard, QrCode } from "lucide-react";
import { simulatePaymentAction } from "@/app/(site)/agendamento/[id]/actions";
import { SubmitButton } from "@/components/ui/client";
import { db, payments } from "@/lib/db";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagamento (simulação)", robots: { index: false } };

/** Tela que imita o checkout para testar o fluxo sem gateway configurado. */
export default async function SimulatedCheckout({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const p = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!p || p.provider !== "simulated") notFound();

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <div className="card p-8 text-center">
        <p className="eyebrow">Ambiente de teste</p>
        <div className="mx-auto mt-5 grid size-14 place-items-center rounded-full bg-lavender-100 text-lavender-700">
          {p.method === "PIX" ? <QrCode className="size-6" /> : <CreditCard className="size-6" />}
        </div>
        <h1 className="display mt-4 text-3xl">Simular {p.method === "PIX" ? "PIX" : "cartão de crédito"}</h1>
        <p className="mt-2 font-display text-4xl">{formatBRL(p.amountCents)}</p>
        <p className="mt-4 text-sm leading-relaxed text-plum-700/80">
          Nenhuma cobrança real acontece aqui. Configure o Mercado Pago no arquivo <code>.env.local</code> para receber pagamentos de verdade.
        </p>
        {p.status === "PENDING" ? (
          <div className="mt-8 flex flex-col gap-3">
            <form action={simulatePaymentAction.bind(null, p.id, "approve")}>
              <SubmitButton className="btn btn-primary w-full">Aprovar pagamento</SubmitButton>
            </form>
            <form action={simulatePaymentAction.bind(null, p.id, "reject")}>
              <SubmitButton className="btn btn-outline w-full">Recusar pagamento</SubmitButton>
            </form>
          </div>
        ) : (
          <p className="mt-8 text-sm text-plum-700">Este pagamento já foi processado.</p>
        )}
      </div>
    </div>
  );
}
