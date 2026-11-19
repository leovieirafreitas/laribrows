"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { cancelMyAppointmentAction, updateProfileAction } from "./actions";
import { SubmitButton } from "@/components/ui/client";
import { PhoneHint } from "@/components/ui/PhoneHint";
import { formatPhone } from "@/lib/format";

export function CancelButton({ appointmentId, paid }: { appointmentId: string; paid: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className="btn btn-danger btn-sm"
        onClick={() => {
          const msg = paid
            ? "Cancelar este horário? O valor já pago segue a política do studio (fale com a gente sobre reembolso ou crédito)."
            : "Cancelar este horário?";
          if (!window.confirm(msg)) return;
          start(async () => {
            const r = await cancelMyAppointmentAction(appointmentId);
            if (!r.ok) setError(r.message);
          });
        }}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" />} Cancelar
      </button>
      {error && <p className="w-full text-xs text-rose-700 sm:max-w-40">{error}</p>}
    </>
  );
}

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action] = useActionState(updateProfileAction, null);
  const [phoneValue, setPhoneValue] = useState(formatPhone(phone));
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="pname">Nome completo</label>
        <input id="pname" name="name" defaultValue={name} className="field" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="pphone">WhatsApp</label>
        <input
          id="pphone"
          name="phone"
          value={phoneValue}
          onChange={(e) => setPhoneValue(formatPhone(e.target.value))}
          className="field"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(92) 99999-9999"
        />
        <PhoneHint phone={phoneValue} />
      </div>
      <div>
        <label className="label">E-mail</label>
        <input value={email} disabled className="field" />
      </div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <SubmitButton className="btn btn-primary btn-sm">Salvar dados</SubmitButton>
        {state && (
          <p className={`flex items-center gap-1.5 text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
            {state.ok ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
