import "server-only";
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import {
  appointments,
  dateOverrides,
  db,
  workingHours,
  type Appointment,
  type DateOverride,
  type Settings,
  type WorkingHour,
} from "@/lib/db";
import { addDays, dayIndex, nowInStudio, weekdayOf } from "@/lib/time";

/** Status que ocupam horário na agenda. */
export const BLOCKING_STATUSES = ["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "CONFIRMED", "COMPLETED"] as const;

type Busy = Pick<Appointment, "id" | "date" | "startMin" | "endMin" | "status" | "expiresAt">;

export type ScheduleContext = {
  settings: Settings;
  hours: Map<number, WorkingHour>;
  overrides: Map<string, DateOverride>;
  busy: Busy[];
  now: { date: string; minutes: number };
};

export type DaySchedule =
  | { open: false; reason: "closed" | "override" }
  | { open: true; startMin: number; endMin: number; breakStartMin: number | null; breakEndMin: number | null };

export async function loadScheduleContext(
  s: Settings,
  from: string,
  to: string,
  excludeAppointmentId?: string,
  conn: Pick<typeof db, "select"> = db,
): Promise<ScheduleContext> {
  const [hours, overrides, busy] = await Promise.all([
    conn.select().from(workingHours),
    conn
      .select()
      .from(dateOverrides)
      .where(and(gte(dateOverrides.date, from), lte(dateOverrides.date, to))),
    conn
      .select({
        id: appointments.id,
        date: appointments.date,
        startMin: appointments.startMin,
        endMin: appointments.endMin,
        status: appointments.status,
        expiresAt: appointments.expiresAt,
      })
      .from(appointments)
      .where(
        and(
          gte(appointments.date, from),
          lte(appointments.date, to),
          inArray(appointments.status, [...BLOCKING_STATUSES]),
          excludeAppointmentId ? ne(appointments.id, excludeAppointmentId) : undefined,
        ),
      ),
  ]);
  const nowMs = Date.now();
  return {
    settings: s,
    hours: new Map(hours.map((h) => [h.weekday, h])),
    overrides: new Map(overrides.map((o) => [o.date, o])),
    // Reservas aguardando pagamento só seguram o horário até expirar.
    busy: busy.filter((b) => b.status !== "PENDING_PAYMENT" || !b.expiresAt || b.expiresAt.getTime() > nowMs),
    now: nowInStudio(),
  };
}

export function daySchedule(ctx: ScheduleContext, date: string): DaySchedule {
  const o = ctx.overrides.get(date);
  const h = ctx.hours.get(weekdayOf(date));
  if (o) {
    if (o.isClosed) return { open: false, reason: "override" };
    // Horário especial: usa início/fim da exceção e mantém o intervalo do dia, se houver.
    return {
      open: true,
      startMin: o.startMin ?? h?.startMin ?? 9 * 60,
      endMin: o.endMin ?? h?.endMin ?? 18 * 60,
      breakStartMin: h?.isOpen ? h.breakStartMin : null,
      breakEndMin: h?.isOpen ? h.breakEndMin : null,
    };
  }
  if (!h?.isOpen) return { open: false, reason: "closed" };
  return {
    open: true,
    startMin: h.startMin,
    endMin: h.endMin,
    breakStartMin: h.breakStartMin,
    breakEndMin: h.breakEndMin,
  };
}

/** Horários (em minutos) disponíveis para um procedimento em uma data. */
export function computeSlots(ctx: ScheduleContext, date: string, durationMin: number, opts?: { ignoreRules?: boolean }) {
  const s = ctx.settings;
  const sched = daySchedule(ctx, date);
  if (!sched.open) return [];

  const today = dayIndex(ctx.now.date);
  const day = dayIndex(date);
  if (!opts?.ignoreRules) {
    if (day < today || day > today + s.bookingWindowDays) return [];
  }
  const earliestAbs = today * 1440 + ctx.now.minutes + (opts?.ignoreRules ? 0 : s.minAdvanceHours * 60);
  const step = Math.max(5, s.slotIntervalMin);
  const busyToday = ctx.busy.filter((b) => b.date === date);

  const slots: number[] = [];
  for (let t = sched.startMin; t + durationMin <= sched.endMin; t += step) {
    const end = t + durationMin;
    if (day * 1440 + t < earliestAbs) continue;
    if (sched.breakStartMin != null && sched.breakEndMin != null && t < sched.breakEndMin && end > sched.breakStartMin)
      continue;
    if (busyToday.some((b) => t < b.endMin && end > b.startMin)) continue;
    slots.push(t);
  }
  return slots;
}

/** Verifica se um horário específico colide com outra reserva (ignora regras de antecedência). */
export function hasConflict(ctx: ScheduleContext, date: string, startMin: number, endMin: number) {
  return ctx.busy.some((b) => b.date === date && startMin < b.endMin && endMin > b.startMin);
}

export function bookingRange(s: Settings) {
  const today = nowInStudio().date;
  return { from: today, to: addDays(today, s.bookingWindowDays) };
}

export async function cleanupExpired() {
  await db
    .update(appointments)
    .set({ status: "EXPIRED" })
    .where(and(eq(appointments.status, "PENDING_PAYMENT"), lte(appointments.expiresAt, new Date())));
}
