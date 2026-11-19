"use client";

import { useState } from "react";
import { addTimeBlockAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/ui/client";
import { DateField, SelectField, TimeField } from "@/components/ui/pickers";
import { WEEKDAYS_LONG } from "@/lib/time";

/** Bloquear um intervalo de horário: num dia específico ou toda semana. */
export function TimeBlockForm({ today, initialDate }: { today: string; initialDate?: string }) {
  const [mode, setMode] = useState<"date" | "weekly">("date");
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <ActionForm action={addTimeBlockAction} resetOnSuccess className="mt-5 space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["date", "Um dia"],
            ["weekly", "Toda semana"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`rounded-2xl border px-3 py-2.5 text-sm transition ${mode === key ? "border-plum-900 bg-lavender-50 text-plum-900" : "border-lavender-200 bg-white text-plum-700 hover:border-lavender-300"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "date" ? (
        <div>
          <label className="label">Data</label>
          <DateField name="date" min={today} defaultValue={initialDate} />
        </div>
      ) : (
        <div>
          <label className="label">Dia da semana</label>
          <SelectField
            name="weekday"
            ariaLabel="Dia da semana"
            defaultValue="6"
            panelClassName="w-60"
            options={order.map((d) => ({ value: String(d), label: `Todo(a) ${WEEKDAYS_LONG[d].toLowerCase()}` }))}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Das</label>
          <TimeField name="start" defaultValue="18:00" ariaLabel="Início do bloqueio" />
        </div>
        <div>
          <label className="label">Até</label>
          <TimeField name="end" defaultValue="19:15" align="right" ariaLabel="Fim do bloqueio" />
        </div>
      </div>
      <div>
        <label className="label">Motivo (opcional)</label>
        <input name="note" className="field" placeholder="Ex.: Compromisso, curso, almoço tardio" maxLength={120} />
      </div>
      <SubmitButton className="btn btn-primary btn-sm">Bloquear horário</SubmitButton>
    </ActionForm>
  );
}
