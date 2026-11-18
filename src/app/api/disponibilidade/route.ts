import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { computeSlots, daySchedule, loadScheduleContext } from "@/lib/availability";
import { db, services } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { addDays, dayIndex, isValidDate, monthDates, nowInStudio } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * GET /api/disponibilidade?servico=ID&mes=2026-11 → dias do mês com/sem horário
 * GET /api/disponibilidade?servico=ID&data=2026-11-20 → horários livres do dia
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const serviceId = sp.get("servico") ?? "";
  const month = sp.get("mes");
  const date = sp.get("data");
  // Ao remarcar, o horário atual da própria cliente não deve bloquear os vizinhos.
  const exclude = sp.get("excluir") || undefined;

  const service = await db.query.services.findFirst({ where: and(eq(services.id, serviceId), eq(services.active, true)) });
  if (!service) return NextResponse.json({ error: "Procedimento não encontrado" }, { status: 404 });
  const s = await getSettings();

  if (date) {
    if (!isValidDate(date)) return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    const ctx = await loadScheduleContext(s, date, date, exclude);
    return NextResponse.json({ date, slots: computeSlots(ctx, date, service.durationMin) });
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Mês inválido" }, { status: 400 });
  const dates = monthDates(month);
  const ctx = await loadScheduleContext(s, dates[0], dates[dates.length - 1], exclude);
  const today = nowInStudio().date;
  const last = addDays(today, s.bookingWindowDays);

  const days = dates.map((d) => {
    if (dayIndex(d) < dayIndex(today)) return { date: d, status: "past" as const };
    if (dayIndex(d) > dayIndex(last)) return { date: d, status: "out" as const };
    if (!daySchedule(ctx, d).open) return { date: d, status: "closed" as const };
    return { date: d, status: computeSlots(ctx, d, service.durationMin).length ? ("open" as const) : ("full" as const) };
  });

  return NextResponse.json({ month, today, lastDate: last, days });
}
