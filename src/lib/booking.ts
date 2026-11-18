import "server-only";
import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { appointments, db, payments, services, type Appointment, type Payment, type Settings } from "@/lib/db";
import { BLOCKING_STATUSES, computeSlots, loadScheduleContext } from "@/lib/availability";
import { computeDueNow, getSettings, mercadoPagoConfigured, siteUrl } from "@/lib/settings";
import { buildPixCode } from "@/lib/payments/pix-brcode";
import * as mercadopago from "@/lib/payments/mercadopago";
import { formatDateShort, minToTime } from "@/lib/time";

export class BookingError extends Error {}

/** Reserva aguardando pagamento cujo prazo já passou. */
export function isHoldExpired(a: Pick<Appointment, "status" | "expiresAt">) {
  return a.status === "PENDING_PAYMENT" && a.expiresAt != null && a.expiresAt.getTime() < Date.now();
}

function shortCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `LB${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

export type CreateBookingInput = {
  serviceId: string;
  date: string;
  startMin: number;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  notes: string;
  method: "PIX" | "CARD" | null;
  payOption: "DEPOSIT" | "FULL";
};

/**
 * Cria a reserva (segurando o horário) e, se houver cobrança online,
 * gera o pagamento. Retorna para onde a cliente deve ir em seguida.
 */
export async function createBooking(input: CreateBookingInput) {
  const s = await getSettings();
  const service = await db.query.services.findFirst({
    where: and(eq(services.id, input.serviceId), eq(services.active, true)),
  });
  if (!service) throw new BookingError("Procedimento indisponível.");

  const dueNow = computeDueNow(s, service.priceCents, input.payOption);
  const needsPayment = dueNow > 0;
  if (needsPayment) {
    if (!input.method) throw new BookingError("Escolha a forma de pagamento.");
    if (input.method === "PIX" && !s.pixEnabled) throw new BookingError("PIX indisponível no momento.");
    if (input.method === "CARD" && !s.cardEnabled) throw new BookingError("Cartão indisponível no momento.");
  }

  const holdMinutes = Math.max(s.holdMinutes, input.method === "PIX" && usesMercadoPagoPix(s) ? 30 : 10);
  const expiresAt = needsPayment ? new Date(Date.now() + holdMinutes * 60_000) : null;

  // Transação: revalida o horário e grava, evitando duas reservas no mesmo slot.
  const appointment = await db.transaction(async (tx) => {
    // Trava as reservas do mesmo dia até o fim da transação (evita dois agendamentos simultâneos).
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`lb:${input.date}`}))`);
    const ctx = await loadScheduleContext(s, input.date, input.date, undefined, tx);
    const slots = computeSlots(ctx, input.date, service.durationMin);
    if (!slots.includes(input.startMin)) {
      throw new BookingError("Esse horário não está mais disponível. Escolha outro, por favor.");
    }
    const [row] = await tx
      .insert(appointments)
      .values({
        code: shortCode(),
        serviceId: service.id,
        serviceName: service.name,
        clientName: input.clientName.trim(),
        clientPhone: input.clientPhone.trim(),
        clientEmail: input.clientEmail.trim().toLowerCase(),
        notes: input.notes.trim(),
        date: input.date,
        startMin: input.startMin,
        endMin: input.startMin + service.durationMin,
        status: needsPayment ? "PENDING_PAYMENT" : "CONFIRMED",
        totalCents: service.priceCents,
        dueNowCents: dueNow,
        expiresAt,
      })
      .returning();
    return row;
  });

  if (!needsPayment) return { appointment, redirectTo: `/agendamento/${appointment.id}` };

  try {
    const payment = await createPayment(s, appointment, input.method!, dueNow);
    if (input.method === "CARD" && payment.checkoutUrl) {
      return { appointment, redirectTo: payment.checkoutUrl };
    }
    return { appointment, redirectTo: `/agendamento/${appointment.id}` };
  } catch (err) {
    // Libera o horário se o gateway falhar.
    await db.update(appointments).set({ status: "CANCELLED", adminNotes: "Falha ao gerar pagamento" }).where(eq(appointments.id, appointment.id));
    console.error("[booking] erro ao criar pagamento", err);
    throw new BookingError("Não foi possível gerar o pagamento agora. Tente novamente em instantes.");
  }
}

function usesMercadoPagoPix(s: Settings) {
  return s.pixProvider === "mercadopago" && mercadoPagoConfigured();
}

/** Gera um novo pagamento online para a reserva (PIX ou cartão). */
export async function createPayment(s: Settings, appt: Appointment, method: "PIX" | "CARD", amountCents: number) {
  const kind: Payment["kind"] = amountCents >= appt.totalCents ? "FULL" : "DEPOSIT";
  const paymentId = crypto.randomUUID();
  const description = `${appt.serviceName} · ${formatDateShort(appt.date)} ${minToTime(appt.startMin)}`;
  const expiresAt = appt.expiresAt ?? new Date(Date.now() + s.holdMinutes * 60_000);
  const backUrl = `${siteUrl()}/agendamento/${appt.id}`;
  const notificationUrl = `${siteUrl()}/api/webhooks/mercadopago`;

  let values: typeof payments.$inferInsert;

  if (method === "PIX") {
    if (s.pixProvider === "manual" && s.pixKey) {
      values = {
        id: paymentId,
        appointmentId: appt.id,
        provider: "pix_manual",
        method: "PIX",
        kind,
        amountCents,
        pixCode: buildPixCode({
          key: s.pixKey,
          amountCents,
          receiverName: s.pixReceiverName || s.studioName,
          receiverCity: s.pixReceiverCity || s.city || "Brasil",
          txid: appt.code,
        }),
      };
    } else if (mercadoPagoConfigured()) {
      const r = await mercadopago.createPixPayment({
        amountCents,
        description: `${s.studioName} · ${description}`,
        payerEmail: appt.clientEmail,
        payerName: appt.clientName,
        externalReference: paymentId,
        expiresAt,
        notificationUrl,
      });
      values = { id: paymentId, appointmentId: appt.id, provider: "mercadopago", providerRef: r.id, method: "PIX", kind, amountCents, pixCode: r.pixCode };
    } else {
      // Modo simulação (sem credenciais): QR de exemplo + botão para aprovar.
      values = {
        id: paymentId,
        appointmentId: appt.id,
        provider: "simulated",
        method: "PIX",
        kind,
        amountCents,
        pixCode: buildPixCode({ key: "simulacao@laribrows.com", amountCents, receiverName: s.studioName, receiverCity: "SAO PAULO", txid: appt.code }),
      };
    }
  } else {
    if (mercadoPagoConfigured()) {
      const r = await mercadopago.createCardCheckout({
        amountCents,
        title: `${s.studioName} · ${description}`,
        payerEmail: appt.clientEmail,
        payerName: appt.clientName,
        externalReference: paymentId,
        backUrl,
        notificationUrl,
        maxInstallments: s.maxInstallments,
        expiresAt,
        statementDescriptor: s.studioName,
      });
      values = { id: paymentId, appointmentId: appt.id, provider: "mercadopago", providerRef: `pref_${r.id}`, method: "CARD", kind, amountCents, checkoutUrl: r.checkoutUrl };
    } else {
      values = {
        id: paymentId,
        appointmentId: appt.id,
        provider: "simulated",
        method: "CARD",
        kind,
        amountCents,
        checkoutUrl: `/pagamento/simulado/${paymentId}`,
      };
    }
  }

  // Um pagamento pendente por vez: cancela os anteriores ainda pendentes.
  await db
    .update(payments)
    .set({ status: "CANCELLED" })
    .where(and(eq(payments.appointmentId, appt.id), eq(payments.status, "PENDING")));
  const [row] = await db.insert(payments).values(values).returning();
  return row;
}

/** Marca um pagamento como aprovado e confirma a reserva (idempotente). */
export async function approvePayment(paymentId: string, opts?: { providerRef?: string }) {
  return db.transaction(async (tx) => {
    const p = await tx.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!p || p.status === "APPROVED") return p;
    await tx
      .update(payments)
      .set({ status: "APPROVED", paidAt: new Date(), ...(opts?.providerRef ? { providerRef: opts.providerRef } : {}) })
      .where(eq(payments.id, paymentId));

    const appt = await tx.query.appointments.findFirst({ where: eq(appointments.id, p.appointmentId) });
    if (!appt) return p;
    const patch: Partial<Appointment> = { paidCents: appt.paidCents + p.amountCents };

    if (["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "EXPIRED", "CANCELLED"].includes(appt.status)) {
      // Pagamento caiu depois que a reserva expirou: confirma, mas avisa se o horário foi ocupado.
      if (appt.status === "EXPIRED" || appt.status === "CANCELLED") {
        const clash = await tx
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(
              eq(appointments.date, appt.date),
              ne(appointments.id, appt.id),
              inArray(appointments.status, [...BLOCKING_STATUSES]),
              lt(appointments.startMin, appt.endMin),
              gt(appointments.endMin, appt.startMin),
            ),
          );
        if (clash.length) {
          patch.adminNotes = `${appt.adminNotes}\n⚠️ Pagamento recebido após a reserva expirar e o horário já foi ocupado. Entre em contato para remarcar.`.trim();
        }
      }
      patch.status = "CONFIRMED";
      patch.expiresAt = null;
    }
    await tx.update(appointments).set(patch).where(eq(appointments.id, appt.id));
    return p;
  });
}

export async function rejectPayment(paymentId: string, status: "REJECTED" | "CANCELLED" = "REJECTED") {
  await db
    .update(payments)
    .set({ status })
    .where(and(eq(payments.id, paymentId), eq(payments.status, "PENDING")));
}

/** Consulta o Mercado Pago e atualiza o pagamento local. */
export async function syncMercadoPagoPayment(mpPaymentId: string) {
  const mp = await mercadopago.getPayment(mpPaymentId);
  if (!mp.external_reference) return null;
  const local = await db.query.payments.findFirst({ where: eq(payments.id, mp.external_reference) });
  if (!local) return null;
  if (mp.status === "approved") {
    // Confere o valor antes de aprovar.
    if (Math.round(mp.transaction_amount * 100) < local.amountCents) {
      console.warn("[mercadopago] valor pago menor que o esperado", mpPaymentId);
      return local;
    }
    await approvePayment(local.id, { providerRef: String(mp.id) });
  } else if (mp.status === "rejected" || mp.status === "cancelled") {
    // No cartão a cliente pode tentar de novo no checkout; só marca PIX como rejeitado.
    if (local.method === "PIX") await rejectPayment(local.id, mp.status === "rejected" ? "REJECTED" : "CANCELLED");
  }
  return local;
}

/** Usado pela tela da cliente: se ainda está pendente, pergunta ao gateway. */
export async function refreshPendingPayment(p: Payment) {
  if (p.status !== "PENDING" || p.provider !== "mercadopago" || !p.providerRef || p.providerRef.startsWith("pref_")) return;
  try {
    await syncMercadoPagoPayment(p.providerRef);
  } catch (err) {
    console.error("[mercadopago] falha ao consultar pagamento", err);
  }
}
