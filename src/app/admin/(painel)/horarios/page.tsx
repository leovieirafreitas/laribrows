import { asc, gte, isNotNull, or } from "drizzle-orm";
import { Clock, Trash2 } from "lucide-react";
import { addOverrideAction, deleteOverrideAction, deleteTimeBlockAction, saveWorkingHoursAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/AppointmentItem";
import { TimeBlockForm } from "@/components/admin/TimeBlockForm";
import { SubmitButton } from "@/components/ui/client";
import { DateField, TimeField } from "@/components/ui/pickers";
import { dateOverrides, db, timeBlocks, workingHours } from "@/lib/db";
import { formatDateCompact, isValidDate, minToTime, todayInStudio, WEEKDAYS_LONG } from "@/lib/time";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Horários e bloqueios" };

export default async function HorariosPage({ searchParams }: { searchParams: Promise<{ abrir?: string; bloquear?: string }> }) {
  await requireAdmin();
  const { abrir, bloquear } = await searchParams;
  const today = todayInStudio();
  const [hours, overrides, blocks] = await Promise.all([
    db.select().from(workingHours),
    db.select().from(dateOverrides).where(gte(dateOverrides.date, today)).orderBy(asc(dateOverrides.date)),
    db
      .select()
      .from(timeBlocks)
      .where(or(gte(timeBlocks.date, today), isNotNull(timeBlocks.weekday)))
      .orderBy(asc(timeBlocks.weekday), asc(timeBlocks.date), asc(timeBlocks.startMin)),
  ]);
  const byDay = new Map(hours.map((h) => [h.weekday, h]));
  // Semana começando na segunda
  const order = [1, 2, 3, 4, 5, 6, 0];
  const openDate = abrir && isValidDate(abrir) ? abrir : "";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Disponibilidade" title="Horários e bloqueios" />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="card p-5 sm:p-6">
          <h2 className="font-display text-2xl">Horário padrão da semana</h2>
          <p className="mt-1 text-sm text-plum-600/70">Os horários livres do site são gerados a partir daqui.</p>
          <ActionForm action={saveWorkingHoursAction} className="mt-5">
            <div className="divide-y divide-lavender-100">
              {order.map((d) => {
                const h = byDay.get(d);
                return (
                  <div key={d} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[9rem_1fr]">
                    <label className="flex items-center gap-2.5 text-sm font-medium text-plum-800">
                      <input type="checkbox" name={`open_${d}`} defaultChecked={h?.isOpen ?? false} className="peer size-4 accent-plum-900" />
                      {WEEKDAYS_LONG[d]}
                    </label>
                    <div className="col-span-2 flex flex-wrap items-center gap-2 text-sm sm:col-span-1">
                      <TimeField name={`start_${d}`} defaultValue={minToTime(h?.startMin ?? 540)} className="w-28 px-3 py-2" ariaLabel={`Início — ${WEEKDAYS_LONG[d]}`} />
                      <span className="text-plum-600/50">às</span>
                      <TimeField name={`end_${d}`} defaultValue={minToTime(h?.endMin ?? 1080)} className="w-28 px-3 py-2" ariaLabel={`Fim — ${WEEKDAYS_LONG[d]}`} />
                      <span className="ml-1 text-xs text-plum-600/50">pausa</span>
                      <TimeField name={`break_start_${d}`} defaultValue={h?.breakStartMin != null ? minToTime(h.breakStartMin) : ""} allowEmpty placeholder="—" className="w-28 px-3 py-2" ariaLabel={`Início da pausa — ${WEEKDAYS_LONG[d]}`} />
                      <span className="text-plum-600/50">–</span>
                      <TimeField name={`break_end_${d}`} defaultValue={h?.breakEndMin != null ? minToTime(h.breakEndMin) : ""} allowEmpty placeholder="—" align="right" className="w-28 px-3 py-2" ariaLabel={`Fim da pausa — ${WEEKDAYS_LONG[d]}`} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-plum-600/60">Marque os dias em que o studio atende. Deixe a pausa em branco se não houver intervalo.</p>
            <SubmitButton className="btn btn-primary btn-sm mt-4">Salvar horários</SubmitButton>
          </ActionForm>
        </section>

        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <h2 className="font-display text-2xl">Bloquear ou abrir datas</h2>
            <p className="mt-1 text-sm text-plum-600/70">Folgas, feriados, férias ou um dia com horário diferente.</p>
            <ActionForm action={addOverrideAction} resetOnSuccess className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">De</label>
                  <DateField name="from" min={today} defaultValue={openDate} />
                </div>
                <div>
                  <label className="label">Até (opcional)</label>
                  <DateField name="to" min={today} placeholder="Mesmo dia" align="right" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-lavender-200 bg-white px-3 py-2.5 text-sm has-checked:border-plum-900 has-checked:bg-lavender-50">
                  <input type="radio" name="type" value="closed" defaultChecked={!openDate} className="accent-plum-900" /> Fechado
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-lavender-200 bg-white px-3 py-2.5 text-sm has-checked:border-plum-900 has-checked:bg-lavender-50">
                  <input type="radio" name="type" value="special" defaultChecked={!!openDate} className="accent-plum-900" /> Horário especial
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Início (especial)</label>
                  <TimeField name="start" defaultValue="09:00" ariaLabel="Início do horário especial" />
                </div>
                <div>
                  <label className="label">Fim (especial)</label>
                  <TimeField name="end" defaultValue="18:00" align="right" ariaLabel="Fim do horário especial" />
                </div>
              </div>
              <div>
                <label className="label">Motivo (opcional)</label>
                <input name="note" className="field" placeholder="Ex.: Feriado, curso, férias" />
              </div>
              <SubmitButton className="btn btn-primary btn-sm">Salvar</SubmitButton>
            </ActionForm>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="font-display text-2xl">Bloquear horários</h2>
            <p className="mt-1 text-sm text-plum-600/70">
              Fecha só um pedaço do dia (ex.: sábado das 18:00 às 19:15). O site deixa de oferecer horários que caiam nesse intervalo.
            </p>
            <TimeBlockForm today={today} initialDate={bloquear && isValidDate(bloquear) ? bloquear : undefined} />
            {blocks.length > 0 && (
              <ul className="mt-5 divide-y divide-lavender-100 border-t border-lavender-100">
                {blocks.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-2.5">
                    <Clock className="size-4 shrink-0 text-lavender-500" />
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-plum-800">
                        {b.date ? formatDateCompact(b.date) : `Todo(a) ${WEEKDAYS_LONG[b.weekday ?? 0].toLowerCase()}`} · {minToTime(b.startMin)}–{minToTime(b.endMin)}
                      </p>
                      {b.note && <p className="text-xs text-plum-600/70">{b.note}</p>}
                    </div>
                    <form action={deleteTimeBlockAction.bind(null, b.id)}>
                      <SubmitButton
                        className="grid size-8 cursor-pointer place-items-center rounded-full text-plum-600/50 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remover bloqueio"
                      >
                        <Trash2 className="size-4" />
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="font-display text-2xl">Próximas exceções</h2>
            {overrides.length === 0 ? (
              <p className="mt-3 text-sm text-plum-600/70">Nenhuma data bloqueada ou especial.</p>
            ) : (
              <ul className="mt-3 divide-y divide-lavender-100">
                {overrides.map((o) => (
                  <li key={o.date} className="flex items-center gap-3 py-2.5">
                    <span className={`size-2 rounded-full ${o.isClosed ? "bg-stone-400" : "bg-champagne-500"}`} />
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-plum-800">{formatDateCompact(o.date)}</p>
                      <p className="text-xs text-plum-600/70">
                        {o.isClosed ? "Fechado" : `Especial ${minToTime(o.startMin ?? 0)}–${minToTime(o.endMin ?? 0)}`}
                        {o.note ? ` · ${o.note}` : ""}
                      </p>
                    </div>
                    <form action={deleteOverrideAction.bind(null, o.date)}>
                      <SubmitButton className="grid size-8 cursor-pointer place-items-center rounded-full text-plum-600/50 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="size-4" />
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
