"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "../actions";
import { SubmitButton } from "@/components/ui/client";

export function NewPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      {/* Ajuda o gerenciador de senhas do celular/navegador a salvar a senha no e-mail certo. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <div>
        <label className="label" htmlFor="password">Nova senha</label>
        <input id="password" name="password" type="password" required autoComplete="new-password" placeholder="Mínimo 8 caracteres" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Repita a nova senha</label>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className="field" />
      </div>
      {state?.error && <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{state.error}</p>}
      <SubmitButton className="btn btn-primary w-full" pendingText="Salvando…">
        Salvar e entrar
      </SubmitButton>
    </form>
  );
}
