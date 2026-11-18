"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { SubmitButton } from "@/components/ui/client";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="username" defaultValue={state?.email} key={state?.email} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
      </div>
      {state?.error && <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{state.error}</p>}
      <SubmitButton className="btn btn-primary w-full" pendingText="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
