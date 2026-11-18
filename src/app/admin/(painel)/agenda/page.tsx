import Link from "next/link";
import { and, asc, gte, inArray, lte } from "drizzle-orm";
import { ChevronLeft, ChevronRight, Lock, Plus, Unlock } from "lucide-react";
import { toggleDayBlockAction } from "@/app/admin/actions";
import { AppointmentItem, PageHeader } from "@/components/admin/AppointmentItem";
import { SubmitButton } from "@/components/ui/client";
import { cleanupExpired, daySchedule, loadScheduleContext } from "@/lib/availability";
import { appointments, db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { addMonths, formatDateLong, formatMonth, isValidDate, minToTime, monthDates, todayInStudio, weekdayOf, WEEKDAYS_SHORT } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ mes?: string; dia?: string }> }) {
  const sp = await searchParams;
  const today = todayInStudio();
  const selected = sp.dia && isValidDate(sp.dia) ? sp.dia : today;
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : selected.slice(0, 7);
  const dates = monthDates(month);

  await cleanupExpired();
  const s = await getSettings();
  const from = dates[0] < selected ? dates[0] : selected;
  const to = dates[dates.length - 1] > selected ? dates[dates.length - 1] : selected;
  const [ctx, list] = await Promise.all([
    loadScheduleContext(s, from, to),
    db
      .select()
      .from(appointments)
      .where(
        and(
          gte(appointments.date, from),
          lte(appointments.date, to),
          inArray(appointments.status, ["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "CONFIRMED", "COMPLETED", "NO_SHOW"]),
        ),
      )
      .orderBy(asc(appointments.startMin)),
  ]);

  const byDay = new Map<string, typeof list>();
  for (const a of list) byDay.set(a.date, [...(byDay.get(a.date) ?? []), a]);

  const sched = daySchedule(ctx, selected);
  const override = ctx.overrides.get(selected);
  const dayList = byDay.get(selected) ?? [];
  const lead = weekdayOf(dates[0]);
  const link = (q: Record<string, string>) => `/admin/agenda?${new URLSearchParams(q)}`;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Calendário" title="Agenda">
        <Link href={`/admin/agendamentos/novo?data=${selected}`} className="btn btn-primary btn-sm">
          <Plus className="size-4" /> Agendar
        </Link>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="card p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <Link href={link({ mes: addMonths(month, -1) })} className="grid size-10 place-items-center rounded-full hover:bg-lavender-100" aria-label="Mês anterior">
              <ChevronLeft className="size-5" />
            </Link>
            <div className="text-center">
              <p className="font-display text-3xl">{formatMonth(month)}</p>
              {month !== today.slice(0, 7) && (
                <Link href={link({ dia: today })} className="text-xs text-lavender-700 hover:underline">
                  Voltar para hoje
                </Link>
              )}
            </div>
            <Link href={link({ mes: addMonths(month, 1) })} className="grid size-10 place-items-center rounded-full hover:bg-lavender-100" aria-label="Próximo mês">
              <ChevronRight className="size-5" />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[0.65rem] tracking-[0.15em] text-plum-600/60 uppercase">
            {WEEKDAYS_SHORT.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-1.5">
            {Array.from({ length: lead }, (_, i) => (
              <span key={i} />
            ))}
            {dates.map((date) => {
              const sc = daySchedule(ctx, date);
              const items = byDay.get(date) ?? [];
              const isSel = date === selected;
              const isToday = date === today;
              const special = ctx.overrides.get(date) && sc.open;
              return (
                <Link
                  key={date}
                  href={link({ mes: month, dia: date })}
                  className={[
                    "flex aspect-square flex-col rounded-2xl p-1.5 text-left transition sm:aspect-[1/0.9] sm:p-2",
                    isSel ? "bg-plum-900 text-white shadow-soft" : sc.open ? "bg-white hover:bg-lavender-100" : "bg-stone-100/70 text-plum-600/40 hover:bg-stone-100",
                    isToday && !isSel ? "ring-2 ring-lavender-400" : "",
                  ].join(" ")}
                >
                  <span className="flex items-center justify-between text-xs sm:text-sm">
                    <span className={isSel ? "font-medium" : ""}>{Number(date.slice(8))}</span>
                    {!sc.open && <Lock className="size-3 opacity-60" />}
                    {special && <span className={`size-1.5 rounded-full ${isSel ? "bg-champagne-300" : "bg-champagne-500"}`} title="Horário especial" />}
                  </span>
                  {items.length > 0 && (
                    <span className="mt-auto">
                      <span className={`hidden rounded-full px-1.5 py-0.5 text-[0.6rem] sm:inline-block ${isSel ? "bg-white/15" : "bg-lavender-100 text-lavender-700"}`}>
                        {items.length} {items.length === 1 ? "cliente" : "clientes"}
                      </span>
                      <span className="flex gap-0.5 sm:hidden">
                        {items.slice(0, 4).map((i) => (
                          <span key={i.id} className={`size-1.5 rounded-full ${isSel ? "bg-white" : "bg-lavender-500"}`} />
                        ))}
                      </span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-plum-600/70">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-white ring-1 ring-lavender-200" /> Aberto
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-stone-100" /> Fechado / bloqueado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-champagne-500" /> Horário especial
            </span>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <p className="eyebrow">{selected === today ? "Hoje" : "Dia selecionado"}</p>
          <h2 className="mt-2 font-display text-3xl">{formatDateLong(selected)}</h2>
          <p className="mt-1 text-sm text-plum-600/70">
            {sched.open
              ? `Atendimento ${minToTime(sched.startMin)}–${minToTime(sched.endMin)}${sched.breakStartMin != null && sched.breakEndMin != null ? ` · pausa ${minToTime(sched.breakStartMin)}–${minToTime(sched.breakEndMin)}` : ""}`
              : "Fechado para agendamentos"}
            {override?.note ? ` · ${override.note}` : ""}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {sched.open ? (
              <form action={toggleDayBlockAction.bind(null, selected, true)}>
                <SubmitButton className="btn btn-outline btn-sm" confirm={dayList.length ? "Este dia tem agendamentos. Bloquear mesmo assim? (os agendamentos existentes continuam)" : undefined}>
                  <Lock className="size-3.5" /> Bloquear dia
                </SubmitButton>
              </form>
            ) : override ? (
              <form action={toggleDayBlockAction.bind(null, selected, false)}>
                <SubmitButton className="btn btn-soft btn-sm">
                  <Unlock className="size-3.5" /> Liberar dia
                </SubmitButton>
              </form>
            ) : (
              <Link href={`/admin/horarios?abrir=${selected}`} className="btn btn-soft btn-sm">
                <Unlock className="size-3.5" /> Abrir com horário especial
              </Link>
            )}
            <Link href={`/admin/agendamentos/novo?data=${selected}`} className="btn btn-ghost btn-sm">
              <Plus className="size-3.5" /> Agendar neste dia
            </Link>
          </div>

          <div className="mt-6 border-t border-lavender-100 pt-3">
            {dayList.length === 0 ? (
              <p className="py-8 text-center text-sm text-plum-600/60">Nenhum atendimento neste dia.</p>
            ) : (
              <div className="-mx-3">
                {dayList.map((a) => (
                  <AppointmentItem key={a.id} a={a} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
