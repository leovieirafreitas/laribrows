"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonth, monthDates, weekdayOf, WEEKDAYS_SHORT } from "@/lib/time";

export type DayStatus = "open" | "full" | "closed" | "past" | "out";

export function Calendar({
  month,
  days,
  selected,
  loading,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onSelect,
}: {
  month: string;
  days: Record<string, DayStatus>;
  selected: string | null;
  loading?: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (date: string) => void;
}) {
  const dates = monthDates(month);
  const lead = weekdayOf(dates[0]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onPrev} disabled={!canPrev} className="grid size-10 place-items-center rounded-full text-plum-700 transition hover:bg-lavender-100 disabled:opacity-25" aria-label="Mês anterior">
          <ChevronLeft className="size-5" />
        </button>
        <p className="font-display text-2xl">{formatMonth(month)}</p>
        <button type="button" onClick={onNext} disabled={!canNext} className="grid size-10 place-items-center rounded-full text-plum-700 transition hover:bg-lavender-100 disabled:opacity-25" aria-label="Próximo mês">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[0.65rem] tracking-[0.15em] text-plum-600/60 uppercase">
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div className={`mt-1 grid grid-cols-7 gap-1 transition-opacity ${loading ? "opacity-40" : ""}`}>
        {Array.from({ length: lead }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {dates.map((date) => {
          const st = days[date];
          const available = st === "open";
          const isSelected = selected === date;
          const day = Number(date.slice(8));
          return (
            <button
              key={date}
              type="button"
              disabled={!available}
              onClick={() => onSelect(date)}
              title={st === "full" ? "Sem horários livres" : st === "closed" ? "Fechado" : undefined}
              className={[
                "relative mx-auto grid aspect-square w-full max-w-12 place-items-center rounded-full text-sm transition",
                isSelected
                  ? "bg-plum-900 font-medium text-white shadow-soft"
                  : available
                    ? "bg-lavender-100 font-medium text-plum-900 hover:bg-lavender-300"
                    : st === "full"
                      ? "text-plum-600/40 line-through decoration-lavender-400"
                      : "text-plum-600/25",
              ].join(" ")}
            >
              {day}
              {available && !isSelected && <span className="absolute bottom-1.5 size-1 rounded-full bg-lavender-500" />}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-plum-600/70">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-lavender-100 ring-1 ring-lavender-300" /> Disponível
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-plum-900" /> Selecionado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-plum-600/40 line-through">12</span> Lotado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-plum-600/25">12</span> Indisponível
        </span>
      </div>
    </div>
  );
}
