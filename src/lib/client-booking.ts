import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { computeSlots, loadScheduleContext } from "@/lib/availability";
import { appointments, db, payments, type Appointment, type Settings } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateShort, formatStudioDateTime, minToTime, studioToDate } from "@/lib/time";

export class ClientActionError extends Error {}

/** Separa próximos horários (ativos e ainda não passados) do histórico. */
export function splitAppointments(list: Appointment[]) {
  const nowMs = Date.now();
  const isUpcoming = (a: Appointment) =>
    ["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "CONFIRMED"].includes(a.status) &&
    studioToDate(a.date, a.endMin).getTime() > nowMs &&
    !(a.status === "PENDING_PAYMENT" && a.expiresAt && a.expiresAt.getTime() < nowMs);
  return { upcoming: list.filter(isUpcoming).reverse(), history: list.filter((a) => !isUpcoming(a)) };
}

/** A cliente ainda pode mexer neste agendamento pela área dela? */
export function changePolicy(a: Appointment, s: Settings) {
  const hoursLeft = (studioToDate(a.date, a.startMin).getTime() - Date.now()) / 3_600_000;
  const active = ["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "CONFIRMED"].includes(a.status);
  const inTime = hoursLeft >= s.clientChangeHours;
  return {
    canCancel: active && (a.status === "PENDING_PAYMENT" || inTime),
    canReschedule: (a.status === "CONFIRMED" || a.status === "AWAITING_CONFIRMATION") && inTime,
    tooLate: active && !inTime && a.status !== "PENDING_PAYMENT",
    isFuture: hoursLeft > 0,
  };
}

const stamp = () => formatStudioDateTime(new Date());

async function ownedAppointment(id: string, email: string) {
  const a = await db.query.appointments.findFirst({ where: and(eq(appointments.id, id), eq(appointments.clientEmail, email)) });
  if (!a) throw new ClientActionError("Agendamento não encontrado.");
  return a;
}

export async function cancelByClient(id: string, email: string) {
  const [a, s] = await Promise.all([ownedAppointment(id, email), getSettings()]);
  if (!changePolicy(a, s).canCancel) {
    throw new ClientActionError(`Cancelamentos pela área da cliente só até ${s.clientChangeHours}h antes. Fale com o studio pelo WhatsApp.`);
  }
  await db
    .update(appointments)
    .set({ status: "CANCELLED", expiresAt: null, adminNotes: `${a.adminNotes}\nCancelado pela cliente em ${stamp()}.`.trim() })
    .where(eq(appointments.id, a.id));
  await db
    .update(payments)
    .set({ status: "CANCELLED" })
    .where(and(eq(payments.appointmentId, a.id), eq(payments.status, "PENDING")));
}

export async function rescheduleByClient(id: string, email: string, date: string, startMin: number) {
  const [a, s] = await Promise.all([ownedAppointment(id, email), getSettings()]);
  if (!changePolicy(a, s).canReschedule) {
    throw new ClientActionError(`Remarcações pela área da cliente só até ${s.clientChangeHours}h antes. Fale com o studio pelo WhatsApp.`);
  }
  const duration = a.endMin - a.startMin;
  await db.transaction(async (tx) => {
    // Trava os dois dias envolvidos (em ordem fixa, para não haver impasse).
    for (const d of [...new Set([a.date, date])].sort()) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`lb:${d}`}))`);
    }
    const ctx = await loadScheduleContext(s, date, date, a.id, tx);
    if (!computeSlots(ctx, date, duration).includes(startMin)) {
      throw new ClientActionError("Esse horário não está mais disponível. Escolha outro, por favor.");
    }
    await tx
      .update(appointments)
      .set({
        date,
        startMin,
        endMin: startMin + duration,
        adminNotes: `${a.adminNotes}\nRemarcado pela cliente em ${stamp()} (antes: ${formatDateShort(a.date)} ${minToTime(a.startMin)}).`.trim(),
      })
      .where(eq(appointments.id, a.id));
  });
}
