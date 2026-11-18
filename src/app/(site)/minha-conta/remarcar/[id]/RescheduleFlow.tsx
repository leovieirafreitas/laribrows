"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { rescheduleMyAppointmentAction } from "@/app/(site)/minha-conta/actions";
import { Calendar, type DayStatus } from "@/components/booking/Calendar";
import { addMonths, formatDateLong, minToTime } from "@/lib/time";

export function RescheduleFlow({ appointmentId, serviceId, today }: { appointmentId: string; serviceId: string; today: string }) {
  const router = useRouter();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const base = `/api/disponibilidade?servico=${serviceId}&excluir=${appointmentId}`;

  const daysKey = `${month}|${refreshKey}`;
  const [daysData, setDaysData] = useState<{ key: string; days: Record<string, DayStatus>; lastDate: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${base}&mes=${daysKey.split("|")[0]}`)
      .then((r) => r.json())
      .then((d: { days?: { date: string; status: DayStatus }[]; lastDate?: string }) => {
        if (alive) setDaysData({ key: daysKey, days: Object.fromEntries((d.days ?? []).map((x) => [x.date, x.status])), lastDate: d.lastDate ?? null });
      })
      .catch(() => alive && setDaysData({ key: daysKey, days: {}, lastDate: null }));
    return () => {
      alive = false;
    };
  }, [base, daysKey]);

  const slotsKey = date ? `${date}|${refreshKey}` : null;
  const [slotsData, setSlotsData] = useState<{ key: string; slots: number[] } | null>(null);
  useEffect(() => {
    if (!slotsKey) return;
    let alive = true;
    fetch(`${base}&data=${slotsKey.split("|")[0]}`)
      .then((r) => r.json())
      .then((d: { slots?: number[] }) => alive && setSlotsData({ key: slotsKey, slots: d.slots ?? [] }))
      .catch(() => alive && setSlotsData({ key: slotsKey, slots: [] }));
    return () => {
      alive = false;
    };
  }, [base, slotsKey]);

  const slots = slotsData?.key === slotsKey ? slotsData.slots : null;
  const maxMonth = daysData?.lastDate ? daysData.lastDate.slice(0, 7) : addMonths(today.slice(0, 7), 2);

  function confirm() {
    if (!date || time == null) return;
    setError(null);
    start(async () => {
      const r = await rescheduleMyAppointmentAction(appointmentId, date, time);
      if (!r.ok) {
        setError(r.message);
        setTime(null);
        setRefreshKey((k) => k + 1);
        return;
      }
      router.push("/minha-conta");
    });
  }

  return (
    <div className="card mt-8 grid gap-8 p-5 sm:p-8 md:grid-cols-[1.1fr_1fr]">
      <div>
        <h2 className="mb-5 font-display text-3xl">Novo dia</h2>
        <Calendar
          month={month}
          days={daysData?.days ?? {}}
          selected={date}
          loading={daysData?.key !== daysKey}
          canPrev={month > today.slice(0, 7)}
          canNext={month < maxMonth}
          onPrev={() => setMonth((m) => addMonths(m, -1))}
          onNext={() => setMonth((m) => addMonths(m, 1))}
          onSelect={(d) => {
            setDate(d);
            setTime(null);
          }}
        />
      </div>
      <div className="md:border-l md:border-lavender-100 md:pl-8">
        <h2 className="mb-5 font-display text-3xl">Novo horário</h2>
        {!date ? (
          <p className="text-sm text-plum-600/70">Escolha um dia disponível.</p>
        ) : slots == null ? (
          <p className="flex items-center gap-2 text-sm text-plum-600/70">
            <Loader2 className="size-4 animate-spin" /> Buscando horários…
          </p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-plum-600/70">Sem horários livres nesse dia.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-plum-700">{formatDateLong(date)}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-3">
              {slots.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={`rounded-full border py-2 text-sm transition ${time === t ? "border-plum-900 bg-plum-900 text-white" : "border-lavender-200 bg-white hover:border-lavender-500"}`}
                >
                  {minToTime(t)}
                </button>
              ))}
            </div>
          </>
        )}
        {error && <p className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <button type="button" className="btn btn-primary mt-8 w-full" disabled={!date || time == null || pending} onClick={confirm}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {date && time != null ? `Confirmar ${formatDateLong(date).split(",")[0].toLowerCase()} às ${minToTime(time)}` : "Confirmar novo horário"}
        </button>
      </div>
    </div>
  );
}
