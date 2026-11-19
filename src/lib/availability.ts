import "server-only";
import { and, eq, gte, inArray, isNotNull, lte, ne, or } from "drizzle-orm";
import {
  appointments,
  dateOverrides,
  db,
  timeBlocks,
  workingHours,
  type Appointment,
  type DateOverride,
  type Settings,
  type TimeBlock,
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
  /** Horários bloqueados pelo studio (num dia ou toda semana). */
  blocks: Pick<TimeBlock, "date" | "weekday" | "startMin" | "endMin" | "note">[];
  now: { date: string; minutes: number };
};

/** Tudo que ocupa o dia: atendimentos marcados + horários bloqueados pelo studio. */
export function occupied(ctx: ScheduleContext, date: string) {
  const wd = weekdayOf(date);
  return [
    ...ctx.busy.filter((b) => b.date === date),
    ...ctx.blocks.filter((b) => b.date === date || (b.date == null && b.weekday === wd)),
  ].map((b) => ({ startMin: b.startMin, endMin: b.endMin }));
}

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
  const queries = [
    () => conn.select().from(workingHours),
    () =>
      conn
        .select()
        .from(dateOverrides)
        .where(and(gte(dateOverrides.date, from), lte(dateOverrides.date, to))),
    () =>
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
    () =>
      conn
        .select({ date: timeBlocks.date, weekday: timeBlocks.weekday, startMin: timeBlocks.startMin, endMin: timeBlocks.endMin, note: timeBlocks.note })
        .from(timeBlocks)
        .where(or(and(gte(timeBlocks.date, from), lte(timeBlocks.date, to)), isNotNull(timeBlocks.weekday))),
  ] as const;
  // Fora de transação: em paralelo (uma ida ao banco). Dentro de uma transação a conexão é única,
  // então as consultas vão em sequência.
  const inTransaction = conn !== db;
  let hours, overrides, busy, blocks;
  if (inTransaction) {
    hours = await queries[0]();
    overrides = await queries[1]();
    busy = await queries[2]();
    blocks = await queries[3]();
  } else {
    [hours, overrides, busy, blocks] = await Promise.all([queries[0](), queries[1](), queries[2](), queries[3]()]);
  }
  const nowMs = Date.now();
  return {
    settings: s,
    hours: new Map(hours.map((h) => [h.weekday, h])),
    overrides: new Map(overrides.map((o) => [o.date, o])),
    // Reservas aguardando pagamento só seguram o horário até expirar.
    busy: busy.filter((b) => b.status !== "PENDING_PAYMENT" || !b.expiresAt || b.expiresAt.getTime() > nowMs),
    blocks,
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
  const busyToday = occupied(ctx, date);

  // Intervalo 0 = "pela duração do procedimento": horários encostados, sem buracos.
  if (s.slotIntervalMin === 0) {
    return slotsByDuration(sched, busyToday, durationMin).filter((t) => day * 1440 + t >= earliestAbs);
  }

  const step = Math.max(5, s.slotIntervalMin);
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

/**
 * Horários pela duração do procedimento: em cada trecho livre do dia (entre a abertura, a pausa,
 * os atendimentos já marcados e o fechamento), um atendimento logo depois do outro.
 * Ex.: Design de 40 min, das 9h às 12h → 09:00, 09:40, 10:20, 11:00. Depois de um atendimento que
 * termina às 10:15, o próximo horário é 10:15.
 */
function slotsByDuration(
  sched: { startMin: number; endMin: number; breakStartMin: number | null; breakEndMin: number | null },
  busy: { startMin: number; endMin: number }[],
  durationMin: number,
) {
  const blocks = busy.map((b) => [b.startMin, b.endMin] as const);
  if (sched.breakStartMin != null && sched.breakEndMin != null && sched.breakEndMin > sched.breakStartMin) {
    blocks.push([sched.breakStartMin, sched.breakEndMin]);
  }
  blocks.sort((a, b) => a[0] - b[0]);

  const slots: number[] = [];
  let cursor = sched.startMin;
  const fill = (from: number, to: number) => {
    for (let t = from; t + durationMin <= to; t += durationMin) slots.push(t);
  };
  for (const [bs, be] of blocks) {
    if (be <= cursor) continue;
    if (bs > cursor) fill(cursor, Math.min(bs, sched.endMin));
    cursor = Math.max(cursor, be);
    if (cursor >= sched.endMin) break;
  }
  if (cursor < sched.endMin) fill(cursor, sched.endMin);
  return slots;
}

/** Verifica se um horário específico colide com outra reserva (ignora regras de antecedência). */
export function hasConflict(ctx: ScheduleContext, date: string, startMin: number, endMin: number) {
  return occupied(ctx, date).some((b) => startMin < b.endMin && endMin > b.startMin);
}

export function bookingRange(s: Settings) {
  const today = nowInStudio().date;
  return { from: today, to: addDays(today, s.bookingWindowDays) };
}

/**
 * Marca como EXPIRADAS as reservas que não foram pagas a tempo.
 * A disponibilidade já ignora reservas vencidas; isto só arruma o status para o painel,
 * então roda no máximo 1x por minuto (cada consulta ao banco custa caro).
 */
const cleanupMemo = globalThis as unknown as { __lbCleanupAt?: number };
export async function cleanupExpired() {
  if (cleanupMemo.__lbCleanupAt && Date.now() - cleanupMemo.__lbCleanupAt < 60_000) return;
  cleanupMemo.__lbCleanupAt = Date.now();
  // Arrumação não essencial: uma falha de rede aqui não pode derrubar a página.
  try {
    await db
      .update(appointments)
      .set({ status: "EXPIRED" })
      .where(and(eq(appointments.status, "PENDING_PAYMENT"), lte(appointments.expiresAt, new Date())));
  } catch (err) {
    cleanupMemo.__lbCleanupAt = 0; // tenta de novo na próxima
    console.error("[cleanupExpired]", (err as Error).message);
  }
}
