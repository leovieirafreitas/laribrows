"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus, Unlock } from "lucide-react";
import { toggleDayBlockAction } from "@/app/admin/actions";
import { AppointmentItem } from "@/components/admin/AppointmentItem";
import { SubmitButton } from "@/components/ui/client";
import type { Appointment } from "@/lib/db/schema";
import { addMonths, formatDateLong, formatMonth, weekdayOf, WEEKDAYS_SHORT } from "@/lib/time";

export type AgendaDay = {
  date: string;
  open: boolean;
  scheduleText: string;
  note: string;
  hasOverride: boolean;
  items: Appointment[];
};

/** Calendário do mês: trocar de dia é instantâneo (tudo já veio do servidor). */
export function AgendaBrowser({ month, today, days, initialSelected }: { month: string; today: string; days: AgendaDay[]; initialSelected: string }) {
  const [selected, setSelected] = useState(initialSelected);
  const day = days.find((d) => d.date === selected) ?? days[0];
  const lead = weekdayOf(days[0].date);
  const link = (q: Record<string, string>) => `/admin/agenda?${new URLSearchParams(q)}`;

  function pick(date: string) {
    setSelected(date);
    window.history.replaceState(null, "", link({ mes: month, dia: date }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <section className="card p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <Link href={link({ mes: addMonths(month, -1) })} prefetch className="grid size-10 place-items-center rounded-full hover:bg-lavender-100" aria-label="Mês anterior">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="text-center">
            <p className="font-display text-3xl">{formatMonth(month)}</p>
            {month !== today.slice(0, 7) ? (
              <Link href={link({ dia: today })} prefetch className="text-xs text-lavender-700 hover:underline">
                Voltar para hoje
              </Link>
            ) : (
              selected !== today && (
                <button type="button" onClick={() => pick(today)} className="text-xs text-lavender-700 hover:underline">
                  Voltar para hoje
                </button>
              )
            )}
          </div>
          <Link href={link({ mes: addMonths(month, 1) })} prefetch className="grid size-10 place-items-center rounded-full hover:bg-lavender-100" aria-label="Próximo mês">
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
          {days.map((d) => {
            const isSel = d.date === selected;
            const isToday = d.date === today;
            const special = d.hasOverride && d.open;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => pick(d.date)}
                className={[
                  "flex aspect-square flex-col rounded-2xl p-1.5 text-left transition sm:aspect-[1/0.9] sm:p-2",
                  isSel ? "bg-plum-900 text-white shadow-soft" : d.open ? "bg-white hover:bg-lavender-100" : "bg-stone-100/70 text-plum-600/40 hover:bg-stone-100",
                  isToday && !isSel ? "ring-2 ring-lavender-400" : "",
                ].join(" ")}
              >
                <span className="flex w-full items-center justify-between text-xs sm:text-sm">
                  <span className={isSel ? "font-medium" : ""}>{Number(d.date.slice(8))}</span>
                  {!d.open && <Lock className="size-3 opacity-60" />}
                  {special && <span className={`size-1.5 rounded-full ${isSel ? "bg-champagne-300" : "bg-champagne-500"}`} title="Horário especial" />}
                </span>
                {d.items.length > 0 && (
                  <span className="mt-auto">
                    <span className={`hidden rounded-full px-1.5 py-0.5 text-[0.6rem] sm:inline-block ${isSel ? "bg-white/15" : "bg-lavender-100 text-lavender-700"}`}>
                      {d.items.length} {d.items.length === 1 ? "cliente" : "clientes"}
                    </span>
                    <span className="flex gap-0.5 sm:hidden">
                      {d.items.slice(0, 4).map((i) => (
                        <span key={i.id} className={`size-1.5 rounded-full ${isSel ? "bg-white" : "bg-lavender-500"}`} />
                      ))}
                    </span>
                  </span>
                )}
              </button>
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
        <p className="eyebrow">{day.date === today ? "Hoje" : "Dia selecionado"}</p>
        <h2 className="mt-2 font-display text-3xl">{formatDateLong(day.date)}</h2>
        <p className="mt-1 text-sm text-plum-600/70">
          {day.scheduleText}
          {day.note ? ` · ${day.note}` : ""}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {day.open ? (
            <form action={toggleDayBlockAction.bind(null, day.date, true)}>
              <SubmitButton
                className="btn btn-outline btn-sm"
                confirm={day.items.length ? "Este dia tem agendamentos. Bloquear mesmo assim? (os agendamentos existentes continuam)" : undefined}
              >
                <Lock className="size-3.5" /> Bloquear dia
              </SubmitButton>
            </form>
          ) : day.hasOverride ? (
            <form action={toggleDayBlockAction.bind(null, day.date, false)}>
              <SubmitButton className="btn btn-soft btn-sm">
                <Unlock className="size-3.5" /> Liberar dia
              </SubmitButton>
            </form>
          ) : (
            <Link href={`/admin/horarios?abrir=${day.date}`} className="btn btn-soft btn-sm">
              <Unlock className="size-3.5" /> Abrir com horário especial
            </Link>
          )}
          <Link href={`/admin/agendamentos/novo?data=${day.date}`} className="btn btn-ghost btn-sm">
            <Plus className="size-3.5" /> Agendar neste dia
          </Link>
        </div>

        <div className="mt-6 border-t border-lavender-100 pt-3">
          {day.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-plum-600/60">Nenhum atendimento neste dia.</p>
          ) : (
            <div className="-mx-3">
              {day.items.map((a) => (
                <AppointmentItem key={a.id} a={a} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
