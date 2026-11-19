import Link from "next/link";
import { and, asc, gte, inArray, lte } from "drizzle-orm";
import { Plus } from "lucide-react";
import { AgendaBrowser, type AgendaDay } from "@/components/admin/AgendaBrowser";
import { PageHeader } from "@/components/admin/AppointmentItem";
import { cleanupExpired, daySchedule, loadScheduleContext } from "@/lib/availability";
import { appointments, db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isValidDate, minToTime, monthDates, todayInStudio, weekdayOf } from "@/lib/time";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ mes?: string; dia?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayInStudio();
  const wanted = sp.dia && isValidDate(sp.dia) ? sp.dia : null;
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : (wanted ?? today).slice(0, 7);
  const dates = monthDates(month);
  const selected = wanted?.startsWith(month) ? wanted : today.startsWith(month) ? today : dates[0];

  // O mês inteiro numa ida ao banco; escolher o dia acontece no navegador.
  const [, s] = await Promise.all([cleanupExpired(), getSettings()]);
  const [ctx, list] = await Promise.all([
    loadScheduleContext(s, dates[0], dates[dates.length - 1]),
    db
      .select()
      .from(appointments)
      .where(
        and(
          gte(appointments.date, dates[0]),
          lte(appointments.date, dates[dates.length - 1]),
          inArray(appointments.status, ["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "CONFIRMED", "COMPLETED", "NO_SHOW"]),
        ),
      )
      .orderBy(asc(appointments.startMin)),
  ]);

  const days: AgendaDay[] = dates.map((date) => {
    const sc = daySchedule(ctx, date);
    const o = ctx.overrides.get(date);
    return {
      date,
      open: sc.open,
      scheduleText: sc.open
        ? `Atendimento ${minToTime(sc.startMin)}–${minToTime(sc.endMin)}${sc.breakStartMin != null && sc.breakEndMin != null ? ` · pausa ${minToTime(sc.breakStartMin)}–${minToTime(sc.breakEndMin)}` : ""}`
        : "Fechado para agendamentos",
      note: o?.note ?? "",
      hasOverride: Boolean(o),
      blocks: ctx.blocks
        .filter((b) => b.date === date || (b.date == null && b.weekday === weekdayOf(date)))
        .sort((a, b) => a.startMin - b.startMin)
        .map((b) => ({ text: `${minToTime(b.startMin)}–${minToTime(b.endMin)}`, note: b.note, weekly: b.date == null })),
      items: list.filter((a) => a.date === date),
    };
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Calendário" title="Agenda">
        <Link href={`/admin/agendamentos/novo?data=${selected}`} className="btn btn-primary btn-sm">
          <Plus className="size-4" /> Agendar
        </Link>
      </PageHeader>
      {/* key: ao trocar de mês, o calendário começa do dia certo */}
      <AgendaBrowser key={month} month={month} today={today} days={days} initialSelected={selected} />
    </div>
  );
}
