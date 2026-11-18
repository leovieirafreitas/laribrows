"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approvePayment, createPayment, rejectPayment } from "@/lib/booking";
import { appointments, db, payments } from "@/lib/db";
import { availableMethods, getSettings, paymentSimulationAllowed } from "@/lib/settings";

/** Cliente avisa que fez o PIX (modo chave PIX manual) → vai para conferência do studio. */
export async function markPixSentAction(appointmentId: string) {
  const appt = await db.query.appointments.findFirst({ where: eq(appointments.id, appointmentId) });
  if (!appt || appt.status !== "PENDING_PAYMENT") return;
  const p = await db.query.payments.findFirst({
    where: and(eq(payments.appointmentId, appointmentId), eq(payments.status, "PENDING")),
    orderBy: desc(payments.createdAt),
  });
  if (p?.provider !== "pix_manual") return;
  await db.update(appointments).set({ status: "AWAITING_CONFIRMATION", expiresAt: null }).where(eq(appointments.id, appointmentId));
  revalidatePath(`/agendamento/${appointmentId}`);
}

/** Troca a forma de pagamento enquanto a reserva está segura. */
export async function switchMethodAction(appointmentId: string, method: "PIX" | "CARD") {
  const appt = await db.query.appointments.findFirst({ where: eq(appointments.id, appointmentId) });
  if (!appt || appt.status !== "PENDING_PAYMENT" || (appt.expiresAt && appt.expiresAt.getTime() < Date.now())) return;
  const s = await getSettings();
  const methods = availableMethods(s);
  if ((method === "PIX" && !methods.pix) || (method === "CARD" && !methods.card)) return;
  const p = await createPayment(s, appt, method, appt.dueNowCents);
  if (method === "CARD" && p.checkoutUrl) redirect(p.checkoutUrl);
  revalidatePath(`/agendamento/${appointmentId}`);
}

/** Somente no modo simulação (sem Mercado Pago configurado). */
export async function simulatePaymentAction(paymentId: string, outcome: "approve" | "reject") {
  // Só vale onde a simulação foi ligada de propósito (computador de testes).
  if (!paymentSimulationAllowed()) return;
  const p = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!p || p.provider !== "simulated") return;
  if (outcome === "approve") await approvePayment(p.id);
  else await rejectPayment(p.id);
  redirect(`/agendamento/${p.appointmentId}`);
}
