"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { requestPasswordResetAction } from "../actions";
import { SubmitButton } from "@/components/ui/client";

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordResetAction, null);

  if (state?.sent) {
    return (
      <div className="mt-6 space-y-5">
        <div className="flex gap-3 rounded-2xl bg-lavender-50 px-4 py-3.5 text-sm leading-relaxed text-plum-700">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-lavender-600" />
          <p>
            Se <strong className="font-medium">{state.email}</strong> for o e-mail do painel, você vai receber um link para criar uma senha nova. Ele
            vale por 30 minutos. Não chegou? Olhe o spam.
          </p>
        </div>
        <Link href="/admin/login" className="btn btn-outline w-full">
          <ArrowLeft className="size-4" /> Voltar para entrar
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="username" defaultValue={state?.email} key={state?.email} className="field" />
      </div>
      {state?.error && <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{state.error}</p>}
      <SubmitButton className="btn btn-primary w-full" pendingText="Enviando…">
        Enviar link
      </SubmitButton>
      <Link href="/admin/login" className="flex items-center justify-center gap-1.5 text-xs tracking-wide text-plum-600/70 hover:text-plum-900">
        <ArrowLeft className="size-3.5" /> Voltar para entrar
      </Link>
    </form>
  );
}
