"use client";

import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { completeProfileAction } from "../actions";
import { SubmitButton } from "@/components/ui/client";
import { PhoneHint } from "@/components/ui/PhoneHint";
import { formatPhone } from "@/lib/format";

export function CompleteProfileForm({ name, phone, email, next }: { name: string; phone: string; email: string; next: string }) {
  const [state, action] = useActionState(completeProfileAction, null);
  // Campos controlados: se der erro, o que foi digitado continua lá.
  const [nameValue, setNameValue] = useState(name);
  const [phoneValue, setPhoneValue] = useState(phone);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="cname">Nome completo</label>
        <input
          id="cname"
          name="name"
          required
          autoComplete="name"
          autoFocus={!name}
          className="field"
          placeholder="Nome e sobrenome"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="cphone">WhatsApp</label>
        <input
          id="cphone"
          name="phone"
          required
          inputMode="tel"
          autoComplete="tel-national"
          className="field"
          placeholder="(92) 99999-9999"
          value={phoneValue}
          onChange={(e) => setPhoneValue(formatPhone(e.target.value))}
        />
        <PhoneHint phone={phoneValue} extra="É por aqui que você recebe a confirmação e o lembrete dos horários." />
      </div>
      <div>
        <label className="label">E-mail</label>
        <input value={email} disabled className="field" />
      </div>
      {state?.error && <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{state.error}</p>}
      <SubmitButton className="btn btn-primary w-full" pendingText="Salvando…">
        Salvar e continuar <ArrowRight className="size-4" />
      </SubmitButton>
    </form>
  );
}
