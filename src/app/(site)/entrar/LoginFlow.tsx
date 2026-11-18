"use client";

import { ArrowLeft, Mail } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { sendCodeAction, verifyCodeAction, type LoginState } from "@/app/(site)/minha-conta/actions";
import { SubmitButton, FormPendingContext } from "@/components/ui/client";

export function LoginFlow() {
  const [sendState, send, sending] = useActionState(sendCodeAction, null);
  const [verifyState, verify, verifying] = useActionState(verifyCodeAction, null);
  const [email, setEmail] = useState("");
  const [changing, setChanging] = useState(false);

  const state: LoginState = verifyState ?? sendState;
  const onCodeStep = sendState?.step === "code" && !changing;

  if (!onCodeStep) {
    return (
      <FormPendingContext value={sending}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setChanging(false);
            const fd = new FormData(e.currentTarget);
            startTransition(() => send(fd));
          }}
          className="space-y-4"
        >
          <div>
            <label className="label" htmlFor="email">Seu e-mail</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="field" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-2 text-xs text-plum-600/60">Use o mesmo e-mail dos seus agendamentos.</p>
          </div>
          {sendState?.error && <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{sendState.error}</p>}
          <SubmitButton className="btn btn-primary w-full" pendingText="Enviando…">
            <Mail className="size-4" /> Receber código de acesso
          </SubmitButton>
        </form>
      </FormPendingContext>
    );
  }

  return (
    <FormPendingContext value={verifying}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => verify(fd));
        }}
        className="space-y-4"
      >
        <p className="rounded-2xl bg-lavender-50 px-4 py-3 text-sm text-plum-700">
          Enviamos um e-mail de acesso para <strong className="font-medium">{sendState.email}</strong>. Toque no link do e-mail (neste mesmo
          navegador) ou digite o código abaixo. Não chegou? Olhe o spam.
        </p>
        <input type="hidden" name="email" value={sendState.email} />
        <div>
          <label className="label" htmlFor="code">Código</label>
          <input
            id="code"
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            autoFocus
            className="field text-center font-display text-3xl tracking-[0.4em]"
            placeholder="••••••"
          />
        </div>
        {state?.error && <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{state.error}</p>}
        <SubmitButton className="btn btn-primary w-full" pendingText="Entrando…">
          Entrar
        </SubmitButton>
        <button type="button" onClick={() => setChanging(true)} className="btn btn-ghost btn-sm mx-auto flex">
          <ArrowLeft className="size-3.5" /> Usar outro e-mail / reenviar
        </button>
      </form>
    </FormPendingContext>
  );
}
